import copy
import unittest
from core.participation_contract import participation_requirement, participation_errors, INSTRUCTION
from core.editorial_case import obligations, prepare_case
from core.editorial_repair import repair_targets, biography_delta_contract, expand_biography_delta, apply_corrections
from test_editorial_execution import linked_case


def fixture():
    p,s,v=linked_case();c=v['candidates'][0]
    c.update(recommendation='develop',suggested_ranking='Category pending',category_missing_criterion='No individual contribution supplied',
             supporting_matters=[],submission_case_coverage=[])
    for m in p['matters']:
        m['leadPartner']='Alex Rivera';m['teamMembers']='Other team members: Sofia Vega.'
    return p,s,v


class ParticipationContractTests(unittest.TestCase):
    def test_missing_membership_is_detected_before_final_review_without_demanding_results(self):
        p,s,v=fixture();c=v['candidates'][0];before=copy.deepcopy((p,s,v))
        requirement=participation_requirement(p,s,c)
        self.assertTrue(participation_errors(p,s,c))
        self.assertEqual(requirement['evidence_kind'],'team_membership')
        checks=obligations(p,s,v)
        self.assertEqual(next(o for o in checks if o['id']==requirement['id'])['instruction'],INSTRUCTION)
        prepared=prepare_case({'package':p,'strategy':s})['case_requirements']['participation_requirements']
        self.assertEqual(prepared['instruction'],INSTRUCTION)
        self.assertEqual(prepared['people'][c['name']],requirement['sources'])
        self.assertEqual((p,s,v),before)

    def test_append_repair_cannot_change_identity_category_or_promote_membership(self):
        p,s,v=fixture();c=v['candidates'][0]
        target=repair_targets(p,s,v)['candidates/0']
        self.assertIn('append_participation',target)
        schema=biography_delta_contract(target)
        self.assertNotIn('name',schema.model_fields)
        self.assertNotIn('suggested_ranking',schema.model_fields)
        quote='Sofia participates in the employment team advising on collective negotiations.'
        delta={'submission_bio':c['submission_bio']+' '+quote,'participation_quote':quote,'submission_case_coverage':None}
        fixed=expand_biography_delta(target,delta)
        result=apply_corrections(v,{'candidates/0':target},{'corrections':[{'path':'candidates/0','value':fixed,'reason':'Preserve sourced membership'}]})
        self.assertEqual(participation_errors(p,s,result['candidates'][0]),[])
        self.assertEqual(result['candidates'][0]['suggested_ranking'],c['suggested_ranking'])
        checks=obligations(p,s,result)
        check=next(o for o in checks if o['id']=='personal_case:0:0')
        self.assertIn('do not invent leadership',check['instruction'])
        self.assertFalse(any(o['id'].startswith('personal_audit:0:') for o in checks))
        for field,value in [('name','Someone Else'),('suggested_ranking','Established Individual')]:
            bad=copy.deepcopy(fixed);bad[field]=value
            with self.assertRaises(ValueError):
                apply_corrections(v,{'candidates/0':target},{'corrections':[{'path':'candidates/0','value':bad,'reason':'Invalid promotion'}]})

    def test_foreign_name_excluded_matter_and_omitted_directory_profile_are_not_obligations(self):
        p,s,v=fixture();c=v['candidates'][0]
        for m in p['matters']:m['teamMembers']='Other team members: Sofia Vega Morales.'
        self.assertIsNone(participation_requirement(p,s,c))
        p,s,v=fixture();c=v['candidates'][0]
        for d in s['matters']:d['disposition']='exclude'
        self.assertIsNone(participation_requirement(p,s,c))
        p,s,v=fixture();p['directory']='Legal 500'
        self.assertIsNone(participation_requirement(p,s,v['candidates'][0]))

    def test_membership_does_not_weaken_a_named_lead_contribution(self):
        p,s,v=fixture();c=v['candidates'][0]
        p['matters'][0]['leadPartner']=c['name']
        self.assertIsNone(participation_requirement(p,s,c))
