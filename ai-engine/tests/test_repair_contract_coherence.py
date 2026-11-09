"""Cross-boundary failures: source proof, actual prose and bounded recovery."""
import copy
import unittest
from unittest.mock import patch

from core.editorial_execution import personal_case_errors, personal_argument_requirement
from core.editorial_repair import (
    coherent_repair_targets, apply_corrections, repair_development,
)
from test_personal_quality_contract import complete_case
import test_personal_evidence_capacity as capacity_fixtures
from test_surgical_repair_postconditions import native_answer


class RepairContractCoherenceTests(unittest.TestCase):
    def test_recovery_can_fix_category_source_and_output_binding_together(self):
        from core.editorial_repair import repair_targets
        p,s,v=complete_case();good=copy.deepcopy(v['candidates'][0]);c=v['candidates'][0]
        c['category_assessment']['career_stage_evidence']=['Invented career evidence.']
        c['submission_case_coverage'][0]['public_quote']='Absent output quotation.'
        before=copy.deepcopy((p,s,v));calls=[]
        def invoke(state,role,schema,instruction,payload):
            calls.append(copy.deepcopy(payload))
            target=payload['repair_targets']['candidates/0']
            self.assertNotIn('mutable_fields',target, 'Invalid category evidence must remain repairable on recovery')
            value=copy.deepcopy(c if len(calls)==1 else good)
            value['submission_bio']+=' Her practice combines these contributions.'
            answer=native_answer({'corrections':[{'path':'candidates/0','value':value,'reason':'Repair source and output evidence.'}], 'unresolved':[]},payload['target_references'])
            schema.model_validate(answer)
            return answer,list(state.get('trace',[]))+[{'usage':{'total_tokens':17}}]
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            result=repair_development({'package':p,'strategy':s},v,repair_targets(p,s,v))
        self.assertEqual(len(calls),2)
        self.assertTrue(result['development_validated'],result['errors'])
        self.assertEqual((p,s,v),before)
        self.assertEqual(result['development']['candidates'][0]['category_assessment'],good['category_assessment'])
        self.assertEqual(sum(t['usage']['total_tokens'] for t in result['trace']),34)

    def test_absent_output_reference_is_not_immutable_biography_text(self):
        p,s,v=complete_case();c=v['candidates'][0]
        absent='A generated quotation that was never written in the biography.'
        c['submission_case_coverage'][0]['public_quote']=absent
        c['profile_coverage'][0]['public_quote']=absent
        target={'candidates/0':{'current_value':c,'problem':'Repair invalid output references.'}}
        coherent=coherent_repair_targets(v,target,package=p)
        spans=coherent['candidates/0']['preserve_generated_quotes']
        self.assertNotIn(absent,spans)
        self.assertTrue(spans)
        self.assertTrue(all(span in c['submission_bio'] for span in spans))
        self.assertTrue(personal_case_errors(p,c,s))  # Absence still needs repair.

    def test_present_but_foreign_source_reference_is_not_protected(self):
        p,s,v=complete_case();c=v['candidates'][0]
        bad='An ungrounded individual result.';c['submission_bio']+=' '+bad
        c['submission_case_coverage'].append({'matter_id':'missing','source_quote':'Not a source','public_quote':bad})
        targets=coherent_repair_targets(v,{'candidates/0':{'current_value':c}},package=p)
        self.assertNotIn(bad,targets['candidates/0']['preserve_generated_quotes'])
        self.assertTrue(personal_case_errors(p,c,s))

    def test_actual_credential_cannot_be_erased_while_repairing_ghost_quote(self):
        p,s,v=complete_case();c=v['candidates'][0]
        c['submission_case_coverage'][0]['public_quote']='Absent generated proof.'
        targets=coherent_repair_targets(v,{'candidates/0':{'current_value':c}},package=p)
        fixed=copy.deepcopy(c);fixed['submission_bio']='Only a generic replacement.'
        with self.assertRaisesRegex(ValueError,'unaffected evidenced'):
            apply_corrections(v,targets,{'corrections':[{'path':'candidates/0','value':fixed,'reason':'Invalid contraction.'}],'unresolved':[]})

    def test_not_proposed_team_member_does_not_need_invented_personal_results(self):
        p,c=capacity_fixtures.PersonalEvidenceCapacityTests().participation()
        c.update(recommendation='do_not_present',suggested_ranking='Not proposed in this practice area')
        self.assertEqual(personal_argument_requirement(p,c),0)
        self.assertEqual(personal_case_errors(p,c),[])
        c['recommendation']='present'
        self.assertTrue(personal_case_errors(p,c))

    def exercise_recovery(self,narrow=False,blocked_other=False,second_fails=False,unknown=False):
        p,s,v=complete_case();before=copy.deepcopy((p,s,v));c=v['candidates'][0]
        target={'current_value':c,'problem':'Improve the personal argument without losing its evidence.'}
        if narrow:target['mutable_fields']=['submission_bio','profile_coverage','submission_case_coverage']
        targets={'candidates/0':target,'b10':{'current_value':v['b10'],'problem':'Develop the overview.'}}
        if blocked_other:targets['c2']={'current_value':v['c2'],'problem':'Requires a missing source confirmation.'}
        new_bio=c['submission_bio']+' Her practice combines these distinct contributions.'
        calls=[]
        def invoke(state,role,schema,instruction,payload):
            calls.append(copy.deepcopy(payload))
            value=copy.deepcopy(c)
            value['submission_bio']=('A regressive generic biography.' if len(calls)==1 or second_fails else new_bio)
            if narrow:value={'submission_bio':value['submission_bio'],'profile_coverage':None,'submission_case_coverage':None}
            if len(calls)==1:
                corrections=[{'path':'candidates/0','value':value,'reason':'Repair the profile.'},
                    {'path':'b10','value':v['b10']+' The department combines those services.','reason':'Develop overview.'},
                    {'path':'institutional_execution','value':v['institutional_execution'],'reason':'The original quotes remain valid.'}]
            else:
                self.assertEqual(set(payload['repair_targets']),{'candidates/0'})
                self.assertEqual(payload['repair_targets']['candidates/0'].get('mutable_fields'),target.get('mutable_fields'))
                self.assertIsNone(payload['shared_source_evidence'])
                corrections=[{'path':'candidates/0','value':value,'reason':'Keep supported material and correct only this profile.'}]
            answer=native_answer({'corrections':corrections,'unresolved':['Missing original confirmation.'] if blocked_other else []},payload['target_references'])
            schema.model_validate(answer)
            usage={'unknown_calls':1} if unknown else {'total_tokens':17}
            return answer,list(state.get('trace',[]))+[{'role':'repair','usage':usage}]
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            result=repair_development({'package':p,'strategy':s},v,targets)
        self.assertEqual((p,s,v),before)
        self.assertIn('department combines',result['development']['b10'])
        self.assertNotIn('approved_artifact',result)
        return result,calls,new_bio

    def test_full_candidate_and_narrow_bio_each_get_only_one_scoped_recovery(self):
        for narrow in (False,True):
            with self.subTest(narrow=narrow):
                result,calls,bio=self.exercise_recovery(narrow=narrow)
                self.assertEqual(len(calls),2)
                self.assertTrue(result['development_validated'],result['errors'])
                self.assertEqual(result['development']['candidates'][0]['submission_bio'],bio)
                self.assertEqual(result['repair_report']['retry_paths'],['candidates/0'])
                self.assertEqual(sum(t['usage']['total_tokens'] for t in result['trace']),34)

    def test_independent_unresolved_field_does_not_block_valid_candidate_recovery(self):
        result,calls,bio=self.exercise_recovery(blocked_other=True)
        self.assertEqual(len(calls),2)
        self.assertEqual(result['development']['candidates'][0]['submission_bio'],bio)
        self.assertFalse(result['development_validated'])
        self.assertEqual(result['repair_report']['failed_paths'],['c2'])
        self.assertTrue(result['repair_report']['unresolved'])
        self.assertIn('candidates/0',result['repair_report']['corrected_paths'])

    def test_failed_second_repair_preserves_progress_and_never_buys_a_third(self):
        result,calls,_=self.exercise_recovery(second_fails=True)
        self.assertEqual(len(calls),2)
        self.assertFalse(result['development_validated'])
        self.assertEqual(result['repair_report']['failed_paths'],['candidates/0'])
        self.assertIn('candidates/0',result['repair_report']['application_errors'])

    def test_unknown_first_response_usage_does_not_buy_a_recovery(self):
        result,calls,_=self.exercise_recovery(unknown=True)
        self.assertEqual(len(calls),1)
        self.assertFalse(result['development_validated'])
        self.assertEqual(result['repair_report']['surgical_retries'],0)
        self.assertEqual(result['trace'][0]['usage'],{'unknown_calls':1})

    def test_mixed_full_and_narrow_profiles_recover_in_one_batch(self):
        import json
        from core.editorial_development import development_errors
        p,s,v=complete_case()
        encoded=json.dumps([p,s,v]).replace('Sofia','Lucia').replace('Vega','Torres')
        for mid in ('m1','m2','m3','m4'):encoded=encoded.replace('"'+mid+'"','"n'+mid[1:]+'"')
        p2,s2,v2=json.loads(encoded)
        p['lawyers']+=p2['lawyers'];p['matters']+=p2['matters']
        s['matters']+=s2['matters'];v['matters']+=v2['matters'];v['candidates']+=v2['candidates'];v['comparisons']+=v2['comparisons']
        self.assertEqual(development_errors(p,s,v),[])
        before=copy.deepcopy((p,s,v));fields=['submission_bio','profile_coverage','submission_case_coverage']
        targets={'candidates/0':{'current_value':v['candidates'][0]},
                 'candidates/1':{'current_value':v['candidates'][1],'mutable_fields':fields},
                 'b10':{'current_value':v['b10']}}
        calls=[]
        def invoke(state,role,schema,instruction,payload):
            calls.append(copy.deepcopy(payload));corrections=[]
            for i in (0,1):
                value=copy.deepcopy(v['candidates'][i])
                value['submission_bio']=('An invalid contraction.' if len(calls)==1 else value['submission_bio']+' These contributions underpin her practice.')
                if i==1:value={'submission_bio':value['submission_bio'],'profile_coverage':None,'submission_case_coverage':None}
                corrections.append({'path':f'candidates/{i}','value':value,'reason':'Restore the source-backed personal argument.'})
            if len(calls)==1:
                corrections.extend([{'path':'b10','value':v['b10']+' The department combines these services.','reason':'Complete overview.'},
                                    {'path':'institutional_execution','value':v['institutional_execution'],'reason':'Retain unchanged valid quotations.'}])
            else:
                self.assertEqual(set(payload['repair_targets']),{'candidates/0','candidates/1'})
                self.assertIsNone(payload['repair_targets']['candidates/0'].get('mutable_fields'))
                self.assertEqual(payload['repair_targets']['candidates/1']['mutable_fields'],fields)
            answer=native_answer({'corrections':corrections,'unresolved':[]},payload['target_references'])
            schema.model_validate(answer)
            return answer,list(state.get('trace',[]))+[{'usage':{'total_tokens':17}}]
        with patch('core.review_graph.invoke_role',side_effect=invoke):result=repair_development({'package':p,'strategy':s},v,targets)
        self.assertEqual(len(calls),2);self.assertTrue(result['development_validated'],result['errors'])
        self.assertIn('department combines',result['development']['b10'])
        self.assertEqual((p,s,v),before)
