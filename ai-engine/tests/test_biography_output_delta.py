import copy
import unittest
from pydantic import ValidationError
from openai.lib._pydantic import to_strict_json_schema
from core.editorial_repair import coherent_repair_targets, repair_result_contract, project_repair_result, apply_corrections, repair_targets, repair_development, TASK
from unittest.mock import patch
from test_editorial_execution import linked_case


class BiographyDeltaTests(unittest.TestCase):
    def test_initial_output_binding_repair_uses_the_immutable_native_delta(self):
        for broken in ('profile','personal','both'):
            with self.subTest(broken=broken):
                p,s,v=linked_case();good=copy.deepcopy(v['candidates'][0]);c=v['candidates'][0]
                if broken in ('profile','both'):c['profile_coverage'][0]['public_quote']='A generated quotation absent from the BIO.'
                if broken in ('personal','both'):c['submission_case_coverage'][0]['public_quote']='Another absent output quotation.'
                before=copy.deepcopy((p,s,v));targets=repair_targets(p,s,v)
                self.assertEqual(set(targets),{'candidates/0'})
                self.assertEqual(set(targets['candidates/0']['mutable_fields']),{'submission_bio','profile_coverage','submission_case_coverage'})
                delta={'submission_bio':good['submission_bio'],
                    'profile_coverage':{u['reference']:{k:u[k] for k in ('decision','public_quote','reason')} for u in good['profile_coverage']},
                    'submission_case_coverage':{f'S{i+1:02d}':u['public_quote'] for i,u in enumerate(good['submission_case_coverage'])}}
                answer={'results':{'T01':{'path':'candidates/0','status':'corrected','value':delta,'reason':'Use the actual BIO passages for the same sources.'}},'source_notes':[]}
                def invoke(state,role,schema,instruction,payload):
                    schema.model_validate(answer)
                    self.assertTrue(state['source_only_repair'])
                    return answer,[{'role':'repair','usage':{'total_tokens':10}}]
                with patch('core.review_graph.invoke_role',side_effect=invoke) as model:
                    result=repair_development({'package':p,'strategy':s},v,targets)
                model.assert_called_once();self.assertTrue(result['development_validated'],result.get('errors'))
                self.assertEqual(result['development']['candidates'][0],good)
                self.assertEqual((p,s,v),before)

    def test_invalid_source_category_or_attribution_keeps_the_full_repair_scope(self):
        for fault in ('profile_source','category','support_source','support_person','duplicate_support','missing_role','missing_internal_field'):
            with self.subTest(fault=fault):
                p,s,v=linked_case();c=v['candidates'][0]
                c['profile_coverage'][0]['public_quote']='Absent output quotation.'
                if fault=='profile_source':c['profile_coverage'][0]['source_quote']='Invented career evidence.'
                elif fault=='category':c['suggested_ranking']='Candidate'
                elif fault=='support_source':c['supporting_matters'][0]['source_quote']='Invented mandate evidence.'
                elif fault=='support_person':p['matters'][0]['leadPartner']='Another Person';p['matters'][0]['source_excerpt']='Another Person led this mandate.'
                elif fault=='duplicate_support':c['supporting_matters'].append(copy.deepcopy(c['supporting_matters'][0]))
                elif fault=='missing_role':c['supporting_matters'][0]['personal_role']=''
                else:c['recommended_action']=''
                target=repair_targets(p,s,v)['candidates/0']
                self.assertNotIn('mutable_fields',target)

    def test_repair_prompt_limits_whole_candidate_instructions_to_the_full_schema(self):
        self.assertIn('WITHOUT mutable_fields',TASK)
        self.assertIn('the whole-candidate instructions do not authorize',TASK)
        self.assertIn('Only a required primary_contribution may quote new original evidence',TASK)

    def fixture(self):
        p,s,v=linked_case();c=v['candidates'][0]
        targets=coherent_repair_targets(v,{'candidates/0/submission_bio':{'current_value':c['submission_bio'],
            'problem':'Correct only this BIO wording.','source_evidence':{'person':p['lawyers'][0]}}})
        value={'submission_bio':'\n'+c['submission_bio'],'profile_coverage':None,'submission_case_coverage':None}
        answer={'results':{'T01':{'path':'candidates/0','status':'corrected','value':value,'reason':'Correct the authorized BIO.'}},'source_notes':[]}
        return p,s,v,targets,answer

    def test_native_delta_preserves_every_immutable_field_and_original_binding(self):
        p,s,v,targets,answer=self.fixture();schema=repair_result_contract(targets)
        parsed=schema.model_validate(answer).model_dump()
        fixed=apply_corrections(v,targets,project_repair_result(parsed,targets))
        old=v['candidates'][0];new=fixed['candidates'][0]
        for field in old:
            if field!='submission_bio':self.assertEqual(new[field],old[field])
        self.assertEqual(new['submission_bio'],'\n'+old['submission_bio'])
        self.assertEqual(fixed['matters'],v['matters'])

    def test_model_cannot_emit_a_category_identity_or_source_mutation(self):
        p,s,v,targets,answer=self.fixture();schema=repair_result_contract(targets)
        for field in ('name','recommendation','suggested_ranking','supporting_matters','source_quote','matter_id'):
            bad=copy.deepcopy(answer);bad['results']['T01']['value'][field]='Forbidden change'
            with self.assertRaises(ValidationError):schema.model_validate(bad)
        properties=[]
        def walk(node):
            if isinstance(node,dict):
                properties.extend(node.get('properties',{}));[walk(x) for x in node.values()]
            elif isinstance(node,list):[walk(x) for x in node]
        walk(to_strict_json_schema(schema))
        self.assertNotIn('source_quote',properties);self.assertNotIn('suggested_ranking',properties)

    def test_keyed_output_updates_cannot_drop_or_replace_source_units(self):
        p,s,v,targets,answer=self.fixture();c=v['candidates'][0];value=answer['results']['T01']['value']
        value['profile_coverage']={u['reference']:{k:u[k] for k in ('decision','public_quote','reason')} for u in c['profile_coverage']}
        value['submission_case_coverage']={f'S{i+1:02d}':u['public_quote'] for i,u in enumerate(c['submission_case_coverage'])}
        schema=repair_result_contract(targets)
        fixed=apply_corrections(v,targets,project_repair_result(schema.model_validate(answer).model_dump(),targets))
        self.assertEqual(fixed['candidates'][0]['profile_coverage'],c['profile_coverage'])
        self.assertEqual(fixed['candidates'][0]['submission_case_coverage'],c['submission_case_coverage'])
        for field in ('profile_coverage','submission_case_coverage'):
            bad=copy.deepcopy(answer);bad['results']['T01']['value'][field]={}
            with self.assertRaises(ValidationError):schema.model_validate(bad)
