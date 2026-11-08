import copy
import unittest
from unittest.mock import patch
from core.biography_obligations import personal_bindings
from core.editorial_repair import coherent_repair_targets, apply_valid_corrections, repair_targets, repair_development, biography_delta_contract
from test_personal_quality_contract import complete_case
from test_surgical_repair_postconditions import native_answer


class TransactionalBiographyRepairTests(unittest.TestCase):
    def test_exact_duplicate_references_are_located_and_not_frozen(self):
        p,s,v=complete_case();c=v['candidates'][0]
        c['submission_case_coverage'][1]['public_quote']=c['submission_case_coverage'][0]['public_quote']
        rows=personal_bindings(p,c)
        self.assertEqual(rows[0]['duplicate_with'],['S02'])
        self.assertEqual(rows[1]['duplicate_with'],['S01'])
        target=coherent_repair_targets(v,repair_targets(p,s,v),package=p)['candidates/0']
        self.assertNotIn(c['submission_case_coverage'][0]['public_quote'],target['preserve_generated_quotes'])
        self.assertIn(c['submission_case_coverage'][2]['public_quote'],target['preserve_generated_quotes'])
        self.assertIn('PUBLIC B9',target['public_biography_policy'])

    def test_native_schema_names_the_immutable_matter_for_each_output_key(self):
        p,s,v=complete_case();c=v['candidates'][0]
        schema=biography_delta_contract({'current_value':c,'mutable_fields':['submission_bio','submission_case_coverage']}).model_json_schema()
        import json
        text=json.dumps(schema)
        for link in c['submission_case_coverage']:self.assertIn('matter_id '+link['matter_id'],text)

    def accept(self,mutate):
        p,s,v=complete_case();before=copy.deepcopy((p,s,v));c=copy.deepcopy(v['candidates'][0]);mutate(p,c)
        # Keep the intentionally extended source as the same immutable input
        # for both before/after comparisons.
        source_before=copy.deepcopy(p)
        targets=coherent_repair_targets(v,{'candidates/0':{'current_value':v['candidates'][0]},'b10':{'current_value':v['b10']}},package=p)
        fixes={'corrections':[{'path':'candidates/0','value':c,'reason':'Repair profile'},
                              {'path':'b10','value':v['b10']+' The team combines these capabilities.','reason':'Overview'},
                              {'path':'institutional_execution','value':v['institutional_execution'],'reason':'Valid unchanged quotes'}],'unresolved':[]}
        result,errors=apply_valid_corrections(v,targets,fixes,p,s)
        self.assertEqual(p,source_before);self.assertEqual(v,before[2])
        self.assertIn('combines these capabilities',result['b10'])
        return p,s,v,result,errors

    def test_new_duplicate_rolls_back_candidate_but_keeps_independent_progress(self):
        def mutate(p,c):c['submission_case_coverage'][1]['public_quote']=c['submission_case_coverage'][0]['public_quote']
        p,s,v,result,errors=self.accept(mutate)
        self.assertEqual(result['candidates'],v['candidates'])
        self.assertIn('duplicate_output_quote',errors['candidates/0'])
        self.assertIn('S02',errors['candidates/0'])

    def test_new_confidential_metrics_never_replace_the_previous_bio(self):
        def mutate(p,c):
            source='The acquisition integrated more than 4,200 employees.'
            p['matters'][0].update(publication_route='E',resolved_publication_status='confidential',source_excerpt=p['matters'][0]['source_excerpt']+' '+source)
            c['submission_bio']+=' '+source
        p,s,v,result,errors=self.accept(mutate)
        self.assertEqual(result['candidates'],v['candidates'])
        self.assertIn('confidential_public_metrics',errors['candidates/0'])

    def test_safe_added_contribution_is_accepted_without_false_approval(self):
        def mutate(p,c):c['submission_bio']+=' Her practice combines these distinct legal contributions.'
        p,s,v,result,errors=self.accept(mutate)
        self.assertEqual(errors,{})
        self.assertNotEqual(result['candidates'],v['candidates'])
        self.assertNotIn('approved_artifact',result)

    def test_a_new_auditor_phrase_is_not_committed_as_progress(self):
        def mutate(p,c):c['submission_bio']+=' The supplied biography confirms her qualifications.'
        p,s,v,result,errors=self.accept(mutate)
        self.assertEqual(result['candidates'],v['candidates'])
        self.assertIn('submission_voice',errors['candidates/0'])

    def test_parent_binding_repair_also_receives_grammar_obligation(self):
        p,s,v=complete_case();c=v['candidates'][0]
        bad='Sofia is the Partner of the employment practice.'
        p['lawyers'][0]['bio']+=' '+bad;c['submission_bio']+=' '+bad
        c['submission_case_coverage'][0]['public_quote']='Absent output quote.'
        target=coherent_repair_targets(v,repair_targets(p,s,v),package=p)['candidates/0']
        self.assertTrue(any('is the Partner of' in q for q in target['rejected_quotes']))
        self.assertFalse(any('is the Partner of' in q for q in target['preserve_generated_quotes']))

    def test_rejected_delta_is_localized_in_one_retry_and_usage_is_not_reset(self):
        p,s,v=complete_case();c=v['candidates'][0]
        targets={'candidates/0':{'current_value':c,'mutable_fields':['submission_bio','profile_coverage','submission_case_coverage']}}
        calls=[]
        def invoke(state,role,schema,instruction,payload):
            calls.append(copy.deepcopy(payload));target=payload['repair_targets']['candidates/0']
            value={'submission_bio':c['submission_bio']+' The practice combines these contributions.','profile_coverage':None,
                   'submission_case_coverage':{f'S{i+1:02d}':link['public_quote'] for i,link in enumerate(c['submission_case_coverage'])}}
            if len(calls)==1:value['submission_case_coverage']['S02']=value['submission_case_coverage']['S01']
            else:
                self.assertIn('duplicate_output_quote',target['problem']);self.assertIn('S02',target['problem'])
                self.assertEqual(target['current_value'],c)
                self.assertEqual(set(payload['repair_targets']),{'candidates/0'})
            answer=native_answer({'corrections':[{'path':'candidates/0','value':value,'reason':'Correct references'}],'unresolved':[]},payload['target_references'])
            schema.model_validate(answer)
            return answer,state.get('trace',[])+[{'usage':{'total_tokens':17}}]
        with patch('core.review_graph.invoke_role',side_effect=invoke):result=repair_development({'package':p,'strategy':s},v,targets)
        self.assertEqual(len(calls),2);self.assertTrue(result['development_validated'],result['errors'])
        self.assertEqual(sum(x['usage']['total_tokens'] for x in result['trace']),34)
        self.assertNotIn('approved_artifact',result)
