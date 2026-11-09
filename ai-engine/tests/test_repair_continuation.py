import copy
import json
import unittest
from unittest.mock import patch
from core.editorial_repair import repair_development,repair_targets
from core.repair_continuation import resume_repair
from core.editorial_development import develop
from core.review_graph import EditorialResponseError
from test_biography_depth import depth_case
from test_surgical_repair_postconditions import native_answer


class RepairContinuationTests(unittest.TestCase):
    def setup_case(self):
        p,s,v=depth_case()
        valid=copy.deepcopy(v['candidates'][0]['submission_case_coverage'])
        v['candidates'][0]['submission_case_coverage'][0]['public_quote']='Absent output proof.'
        v['candidates']=[copy.deepcopy(v['candidates'][0]) for _ in range(3)]
        return p,s,v,valid

    def invoke(self,valid,fail_at=None):
        calls=[]
        def call(state,role,schema,instruction,payload):
            paths=list(payload['repair_targets']);calls.append(paths)
            if len(calls)==fail_at:
                error=EditorialResponseError('Unknown response',{'usage':{'unknown_calls':1}})
                error.trace_history=state['trace']+[error.trace]
                raise error
            edits=[]
            for path,t in payload['repair_targets'].items():
                c=t['current_value']
                edits.append({'path':path,'value':{'submission_bio':c['submission_bio'],
                    'profile_coverage':None,'biography_depth':c['biography_depth'],
                    'submission_case_coverage':None if len(calls)==1 else {f'S{i+1:02d}':x['public_quote'] for i,x in enumerate(valid)}},
                    'reason':'Repair output references against retained prose.'})
            answer=native_answer({'corrections':edits,'unresolved':[]},payload['target_references'])
            schema.model_validate(answer)
            return answer,state.get('trace',[])+[{'usage':{'total_tokens':11},'provider_request_id':f'saved-{len(calls)}'}]
        return calls,call

    def test_one_paid_group_per_saved_step_and_no_replenished_round(self):
        p,s,v,valid=self.setup_case();calls,invoke=self.invoke(valid)
        state={'package':p,'strategy':s,'durable_repair_steps':True}
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            result=repair_development(state,v,repair_targets(p,s,v))
            self.assertEqual(len(calls),1)
            self.assertFalse(result['development_validated'])
            self.assertEqual(len(result['repair_continuation']['pending_groups']),3)
            # JSON round trips emulate an independent request/process, not
            # in-memory state surviving a network timeout.
            for remaining in (2,1,0):
                saved=json.loads(json.dumps(result))
                result=develop({**state,**saved,'development_reusable':True})
                self.assertEqual(len(calls),4-remaining)
                self.assertEqual(len((result.get('repair_continuation') or {}).get('pending_groups',[])),remaining)
            self.assertIsNone(result['repair_continuation'])
            self.assertEqual(result['repair_report']['residual_requests'],3)
            self.assertEqual(result['repair_report']['surgical_retries'],1)
            self.assertEqual(sum(t['usage']['total_tokens'] for t in result['trace']),44)
            self.assertEqual(calls,[['candidates/0','candidates/1','candidates/2'],['candidates/0'],['candidates/1'],['candidates/2']])
            for candidate in result['development']['candidates']:
                self.assertEqual(candidate['submission_case_coverage'],valid)

    def test_unknown_group_preserves_prior_deltas_and_blocks_remaining(self):
        p,s,v,valid=self.setup_case();calls,invoke=self.invoke(valid,fail_at=3)
        state={'package':p,'strategy':s,'durable_repair_steps':True}
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            first=repair_development(state,v,repair_targets(p,s,v))
            second=resume_repair({**state,**first,'development_reusable':True})
            result=resume_repair({**state,**second,'development_reusable':True})
        self.assertEqual(len(calls),3)
        self.assertIsNone(result['repair_continuation'])
        self.assertFalse(result['development_validated'])
        self.assertTrue(result['development_repair_unlocatable'])
        self.assertEqual(result['development']['candidates'][0]['submission_case_coverage'],valid)
        self.assertEqual(result['trace'][-1]['usage']['unknown_calls'],1)
        self.assertEqual(sum(t['usage'].get('total_tokens',0) for t in result['trace']),22)

    def test_stale_proposal_or_duplicate_group_stops_before_provider(self):
        p,s,v,valid=self.setup_case();calls,invoke=self.invoke(valid)
        state={'package':p,'strategy':s,'durable_repair_steps':True}
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            first=repair_development(state,v,repair_targets(p,s,v))
        changed=copy.deepcopy(first);changed['development']['b10']='A later draft.'
        duplicate=copy.deepcopy(first);duplicate['repair_continuation']['pending_groups'].append(copy.deepcopy(duplicate['repair_continuation']['pending_groups'][0]))
        for item in (changed,duplicate):
            with patch('core.review_graph.invoke_role',side_effect=AssertionError('No provider call')):
                result=resume_repair({**state,**item,'development_reusable':True})
            self.assertFalse(result['development_validated'])
            self.assertIsNone(result['repair_continuation'])

    def test_own_subject_binding_requires_unique_unchanged_predicate(self):
        from core.candidate_evidence import bind_public_quote
        quote='Sofia leads the negotiations and coordinates the litigation strategy across several jurisdictions.'
        text='He also leads the negotiations and coordinates the litigation strategy across several jurisdictions.'
        self.assertEqual(bind_public_quote(quote,text,'Sofia Vega'),text.rstrip('.'))
        self.assertIn(bind_public_quote('She leads the negotiations.', 'Sofia Vega leads the negotiations.', 'Sofia Vega'),'Sofia Vega leads the negotiations.')
        self.assertEqual(bind_public_quote(quote,text,'Other Person'),quote)
        self.assertEqual(bind_public_quote(quote,text.replace('leads','led'),'Sofia Vega'),quote)
        self.assertEqual(bind_public_quote(quote,text.replace('leads','does not lead'),'Sofia Vega'),quote)
        self.assertEqual(bind_public_quote(quote,text+' '+text,'Sofia Vega'),quote)

    def test_graph_persists_continuation_and_does_not_call_writer(self):
        from core.review_graph import run_editorial_stage
        p,s,v,valid=self.setup_case();calls,invoke=self.invoke(valid)
        state={'package':p,'strategy':s,'development':v,'development_reusable':True,
            'selection_validated':True,'selection_review_validated':True}
        with patch('core.review_graph.invoke_role',side_effect=invoke),patch('core.review_graph.writer',side_effect=AssertionError('No premature Audit')):
            result=run_editorial_stage('development',state)
        self.assertTrue(result['durable_repair_steps'])
        self.assertEqual(result['repair_continuation']['version'],'bounded-residual-v1')
        self.assertEqual(len(calls),1)
        self.assertFalse(result['development_validated'])
        self.assertFalse(result['release_verdict']['passed'])

    def test_preservation_allows_sentence_extension_but_not_lost_credential(self):
        from core.editorial_repair import apply_corrections
        from test_editorial_development import DEV
        before=copy.deepcopy(DEV)
        span='She served as Legal Director at Example Staffing.'
        before['candidates'][0]['submission_bio']=span
        target={'candidates/0/submission_bio':{'current_value':span,'preserve_generated_quotes':[span]}}
        def correction(text):return {'corrections':[{'path':'candidates/0/submission_bio','value':text,'reason':'Extend sourced career scope.'}],'unresolved':[]}
        fixed=apply_corrections(before,target,correction(span[:-1]+', overseeing regional operations.'))
        self.assertIn('Legal Director at Example Staffing,',fixed['candidates'][0]['submission_bio'])
        with self.assertRaisesRegex(ValueError,'Restore these exact spans'):
            apply_corrections(before,target,correction('She served as legal adviser at an employer.'))
