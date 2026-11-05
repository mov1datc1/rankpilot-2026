"""Generated wording is repaired by evidence and postcondition, not edit count."""
import copy
import unittest
from unittest.mock import patch
from core.editorial_development import develop, submission_voice_paths
from core.editorial_repair import repair_rejected_development
from test_editorial_development import PACKAGE, STRATEGY, DEV

BAD='The source materials contain inconsistent nonessential sector descriptors.'


class SurgicalRepairPostconditionTests(unittest.TestCase):
    def fixture(self):
        proposal=copy.deepcopy(DEV)
        proposal['matters'][0]['text']+=' '+BAD
        defect={'owner':'rankpilot','severity':'warning','scope':'submission',
                'code':'UNSUPPORTED_CLAIM','matter_id':'m1','field_path':'matters/0/text',
                'source_quote':'The team prevented a strike.', 'artifact_quote':BAD,
                'message':'Remove the unsupported editorial explanation; retain the legal work.'}
        return proposal,defect

    def run_repair(self,answers,trace=None):
        proposal,defect=self.fixture();before=copy.deepcopy((proposal,PACKAGE,STRATEGY))
        payloads=[]
        def invoke(state,role,schema,instruction,payload):
            payloads.append(copy.deepcopy(payload))
            answer=answers[len(payloads)-1]
            schema.model_validate(answer)
            return answer,list(state.get('trace',[]))+[{'role':'repair','usage':{'total_tokens':10}}]
        with patch('core.review_graph.invoke_role',side_effect=invoke) as model:
            result=repair_rejected_development({'package':PACKAGE,'strategy':STRATEGY,'trace':trace or []},proposal,[defect])
        self.assertEqual((proposal,PACKAGE,STRATEGY),before)
        self.assertNotIn('approved_artifact',result)
        return result,payloads,model

    def answer(self,text):
        return {'corrections':[{'path':'matters/0/text','value':text,'reason':'Preserve work and withdraw generated commentary.'}],'unresolved':[]}

    def test_warning_is_repaired_in_the_same_stage_without_waiting_for_final_escalation(self):
        proposal,defect=self.fixture()
        with patch('core.editorial_repair.repair_rejected_development',return_value={}) as repair:
            develop({'package':PACKAGE,'strategy':STRATEGY,'development':proposal,
                     'development_reusable':True,'repair_feedback':[defect]})
        repair.assert_called_once()
        self.assertEqual(repair.call_args.args[1],proposal)
        self.assertIn(defect,repair.call_args.args[2])

    def test_editorial_rationale_is_detected_before_rendering_without_removing_legal_work(self):
        proposal,_=self.fixture()
        self.assertIn('matters/0/text',submission_voice_paths(proposal))
        self.assertEqual(submission_voice_paths(DEV),[])

    def test_good_first_repair_keeps_the_exact_claim_and_uses_only_own_source(self):
        result,payloads,model=self.run_repair([self.answer(DEV['matters'][0]['text'])])
        model.assert_called_once()
        self.assertTrue(result['development_validated'])
        target=payloads[0]['repair_targets']['matters/0/text']
        self.assertEqual(target['rejected_quotes'],[BAD])
        evidence=target['source_evidence']
        self.assertEqual(evidence.get('matter',evidence)['id'],'m1')
        self.assertNotIn('package',target['source_evidence'])
        self.assertEqual(result['development'],DEV)

    def test_changed_paragraph_with_surviving_claim_gets_one_narrow_retry(self):
        ineffective=DEV['matters'][0]['text']+' '+BAD+' Additional wording.'
        result,payloads,model=self.run_repair([self.answer(ineffective),self.answer(DEV['matters'][0]['text'])])
        self.assertEqual(model.call_count,2)
        self.assertEqual(set(payloads[1]['repair_targets']),{'matters/0/text'})
        self.assertIsNone(payloads[1]['shared_source_evidence'])
        self.assertNotIn('package',payloads[1])
        self.assertEqual(result['development'],DEV)
        self.assertTrue(result['development_validated'])
        self.assertEqual(result['repair_report']['surgical_retries'],1)
        self.assertEqual(sum(t['usage']['total_tokens'] for t in result['trace']),20)

    def test_unchanged_response_is_not_success_and_can_use_the_same_narrow_retry(self):
        proposal,_=self.fixture()
        result,_,model=self.run_repair([self.answer(proposal['matters'][0]['text']),self.answer(DEV['matters'][0]['text'])])
        self.assertEqual(model.call_count,2)
        self.assertTrue(result['development_validated'])

    def test_second_failure_never_buys_a_third_call_or_approves(self):
        bad=self.answer(DEV['matters'][0]['text']+' '+BAD+' Still unsupported.')
        result,_,model=self.run_repair([bad,bad])
        self.assertEqual(model.call_count,2)
        self.assertFalse(result['development_validated'])
        self.assertEqual(result['repair_report']['failed_paths'],['matters/0/text'])

    def test_unknown_previous_consumption_prevents_the_additional_call(self):
        bad=self.answer(DEV['matters'][0]['text']+' '+BAD+' Still unsupported.')
        result,_,model=self.run_repair([bad],trace=[{'usage':{'unknown_calls':1}}])
        model.assert_not_called()
        self.assertFalse(result['development_validated'])
        self.assertEqual(result['trace'][0]['usage'],{'unknown_calls':1})

    def test_real_missing_evidence_does_not_trigger_the_extra_call(self):
        result,_,model=self.run_repair([{'corrections':[],'unresolved':['No faithful correction can be formulated.']}])
        model.assert_called_once()
        self.assertFalse(result['development_validated'])

    def test_retry_preserves_other_corrected_fields_and_narrows_the_schema(self):
        from core.editorial_repair import repair_development
        from pydantic import ValidationError
        targets={'matters/0/text':{'current_value':DEV['matters'][0]['text']+' '+BAD,'source_evidence':{'id':'m1'},'rejected_quotes':[BAD]},
                 'c2':{'current_value':'Old coverage wording.','source_evidence':{'department':'Grounded coverage.'}}}
        proposal=copy.deepcopy(DEV);proposal['c2']=targets['c2']['current_value'];proposal['matters'][0]['text']=targets['matters/0/text']['current_value']
        first={'corrections':[{'path':'c2','value':DEV['c2'],'reason':'Grounded coverage.'},
                              {'path':'matters/0/text','value':proposal['matters'][0]['text']+' Changed.','reason':'Ineffective.'}],'unresolved':[]}
        calls=[]
        def invoke(state,role,schema,instruction,payload):
            calls.append(payload)
            if len(calls)==2:
                self.assertEqual(set(payload['repair_targets']),{'matters/0/text'})
                with self.assertRaises(ValidationError):
                    schema.model_validate({'corrections':[{'path':'c2','value':'Unrequested rewrite.','reason':'No.'}],'unresolved':[]})
            return (first if len(calls)==1 else self.answer(DEV['matters'][0]['text'])),list(state.get('trace',[]))+[{'usage':{'total_tokens':10}}]
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            result=repair_development({'package':PACKAGE,'strategy':STRATEGY},proposal,targets)
        self.assertEqual(result['development'],DEV)
        self.assertTrue(result['development_validated'])
        self.assertEqual(set(result['repair_report']['corrected_paths']),set(targets))

    def test_second_call_deadline_or_transport_failure_keeps_known_usage_and_rejection(self):
        proposal,defect=self.fixture()
        for transport in (False,True):
            error=TimeoutError('Before request or provider response unavailable')
            if transport:error.trace_history=[{'usage':{'total_tokens':10}},{'usage':{'unknown_calls':1}}]
            first=self.answer(proposal['matters'][0]['text']+' Changed elsewhere.')
            with patch('core.review_graph.invoke_role',side_effect=[(first,[{'usage':{'total_tokens':10}}]),error]) as model:
                result=repair_rejected_development({'package':PACKAGE,'strategy':STRATEGY},proposal,[defect])
            self.assertEqual(model.call_count,2)
            self.assertFalse(result['development_validated'])
            self.assertEqual(result['trace'][0]['usage'],{'total_tokens':10})
            if transport:self.assertEqual(result['trace'][-1]['usage'],{'unknown_calls':1})
