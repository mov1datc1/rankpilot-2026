import copy
import unittest
from pydantic import ValidationError
from openai.lib._pydantic import to_strict_json_schema
from core.editorial_repair import coherent_repair_targets, repair_result_contract, project_repair_result, apply_corrections
from test_editorial_execution import linked_case


class BiographyDeltaTests(unittest.TestCase):
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
