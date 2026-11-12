import copy
import unittest
from pydantic import ValidationError
from openai.lib._pydantic import to_strict_json_schema
from core.candidate_evidence import profile_errors
from core.editorial_repair import (coherent_repair_targets, biography_delta_contract,
    expand_biography_delta, apply_valid_corrections)
from test_editorial_execution import linked_case


class ProfileBindingRepairTests(unittest.TestCase):
    def fixture(self):
        p,s,v=linked_case();c=v['candidates'][0];person=p['lawyers'][0]
        person['bio']='Sofia advises Example Energy on workforce matters.'
        c['submission_bio']='Sofia advises a confidential business on workforce matters.'
        c['profile_coverage']=[{'reference':'P01','source_quote':person['bio'],
            'entity_name':'Example Energy','relationship':'client','decision':'generalize',
            'privacy_basis':{'kind':'client_register','matter_id':'wrong','source_quote':'Another Business'},
            'public_quote':c['submission_bio'],'reason':'Preserve the work without the restricted name.'}]
        p['matters'].append({'id':'correct','client':'Example Energy','publication_route':'E'})
        targets={'candidates/0/submission_bio':{'current_value':c['submission_bio'],
            'problem':'Repair the privacy evidence and retain the supported work.',
            'source_evidence':{'person':person}}}
        return p,s,v,targets

    def delta(self,target):
        c=target['current_value'];item=copy.deepcopy(c['profile_coverage'][0])
        item.pop('reference');item.pop('source_quote')
        item['privacy_basis']={'kind':'client_register','matter_id':'correct','source_quote':'Example Energy'}
        return {'submission_bio':c['submission_bio'],'profile_coverage':{'P01':item},
                'submission_case_coverage':None}

    def test_own_restriction_can_be_repaired_without_changing_source_or_person(self):
        p,s,v,t=self.fixture();original=copy.deepcopy((p,s,v))
        targets=coherent_repair_targets(v,t,p);target=targets['candidates/0']
        self.assertEqual(set(target['profile_binding_repairs']),{'P01'})
        delta=self.delta(target);schema=biography_delta_contract(target)
        schema.model_validate(delta);to_strict_json_schema(schema)
        changed=expand_biography_delta(target,delta)
        self.assertEqual(profile_errors(p['lawyers'][0],changed,p),[])
        for field in ('reference','source_quote','entity_name','relationship'):
            self.assertEqual(changed['profile_coverage'][0][field],v['candidates'][0]['profile_coverage'][0][field])
        for field in ('name','suggested_ranking','supporting_matters','submission_case_coverage'):
            self.assertEqual(changed[field],v['candidates'][0][field])
        self.assertEqual((p,s,v),original)

    def test_schema_keeps_original_units_and_unrelated_candidate_fields_out(self):
        p,s,v,t=self.fixture();target=coherent_repair_targets(v,t,p)['candidates/0']
        for field in ('source_quote','reference'):
            delta=self.delta(target);delta['profile_coverage']['P01'][field]='Invented'
            with self.assertRaises(ValidationError):biography_delta_contract(target).model_validate(delta)
        delta=self.delta(target);delta['name']='Another Person'
        with self.assertRaises(ValidationError):biography_delta_contract(target).model_validate(delta)

    def test_unrelated_entity_permission_and_fuzzy_alias_still_fail(self):
        p,s,v,t=self.fixture();p['matters'].append({'id':'other','client':'Another Business','publication_route':'E'})
        target=coherent_repair_targets(v,t,p)['candidates/0']
        for basis in ({'kind':'client_register','matter_id':'other','source_quote':'Another Business'},
                      {'kind':'profile_restriction','matter_id':'','source_quote':'Invented permission'},
                      {'kind':'client_register','matter_id':'correct','source_quote':'Example Energi'}):
            delta=self.delta(target);delta['profile_coverage']['P01']['privacy_basis']=basis
            with self.assertRaises(ValueError):expand_biography_delta(target,delta)
        delta=self.delta(target);delta['profile_coverage']['P01']['entity_name']='Another Business'
        with self.assertRaises(ValueError):expand_biography_delta(target,delta)

    def test_valid_binding_remains_output_only(self):
        p,s,v,t=self.fixture();v['candidates'][0]['profile_coverage'][0]['privacy_basis']={'kind':'client_register','matter_id':'correct','source_quote':'Example Energy'}
        target=coherent_repair_targets(v,t,p)['candidates/0']
        self.assertNotIn('profile_binding_repairs',target)
        delta=self.delta(target)
        with self.assertRaises(ValidationError):biography_delta_contract(target).model_validate(delta)

    def test_omit_is_not_a_duplicate_but_material_office_still_cannot_disappear(self):
        p,s,v,t=self.fixture();person=p['lawyers'][0];c=v['candidates'][0]
        person['bio']='Sofia advises Example Energy and Another Business on workforce matters.'
        c['submission_bio']='Sofia advises Example Energy on workforce matters.'
        first=copy.deepcopy(c['profile_coverage'][0]);first.update(source_quote=person['bio'],decision='retain',privacy_basis=None,public_quote=c['submission_bio'])
        second={**first,'entity_name':'Another Business','decision':'omit','public_quote':'','reason':'Non-material client example; work preserved.'}
        c['profile_coverage']=[first,second]
        self.assertEqual(profile_errors(person,c,p),[])
        c['profile_coverage'].append(copy.deepcopy(first))
        self.assertTrue(any('duplicated' in e for e in profile_errors(person,c,p)))
        c['profile_coverage']=[second];person['bio']='Sofia served as Director at Another Business.'
        second['source_quote']=person['bio']
        self.assertTrue(any('material' in e for e in profile_errors(person,c,p)))

    def test_changed_binding_invalidates_review_unit_hash(self):
        from core.field_review import units_for
        p,s,v,t=self.fixture();target=coherent_repair_targets(v,t,p)['candidates/0']
        before=units_for({"package":p,"strategy":s,"development":v});fixed=copy.deepcopy(v)
        fixed['candidates'][0]=expand_biography_delta(target,self.delta(target))
        after=units_for({"package":p,"strategy":s,"development":fixed})
        old=next(u for u in before if u['field']=='candidates/0/submission_bio')
        new=next(u for u in after if u['field']=='candidates/0/submission_bio')
        self.assertNotEqual(old['hash'],new['hash'])

    def test_initial_repair_exposes_derived_binding_and_preserves_headship_fix_when_alias_stays_unproven(self):
        from core.editorial_repair import repair_targets, repair_result_contract, project_repair_result
        p,s,v,_=self.fixture();c=v['candidates'][0]
        p['filing_details']={'heads':[{'name':c['name']}]}
        raw=repair_targets(p,s,v);targets=coherent_repair_targets(v,raw,p)
        target=targets['candidates/0']
        self.assertIn('profile_coverage',target['mutable_fields'])
        self.assertEqual(set(target['profile_binding_repairs']),{'P01'})
        self.assertEqual(target['confirmed_head_function']['name'],c['name'])
        delta=self.delta(target)
        delta['submission_bio']='Sofia is Head of Department and advises a confidential business on workforce matters.'
        delta['profile_coverage']['P01']['public_quote']=delta['submission_bio']
        delta['profile_coverage']['P01']['privacy_basis']={'kind':'client_register','matter_id':'wrong','source_quote':'Another Business'}
        answer={'results':{'T01':{'path':'candidates/0','status':'corrected','value':delta,'reason':'State confirmed headship; retain unproven alias for observation.'}},'source_notes':[]}
        repair_result_contract(targets).model_validate(answer)
        projected=project_repair_result(answer,targets)
        fixed,failures=apply_valid_corrections(v,targets,projected,p,s)
        self.assertEqual(failures,{})
        self.assertIn('Head of Department',fixed['candidates'][0]['submission_bio'])
        self.assertEqual(fixed['candidates'][0]['profile_coverage'][0]['privacy_basis'],c['profile_coverage'][0]['privacy_basis'])

if __name__=='__main__':unittest.main()
