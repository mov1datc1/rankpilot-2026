import copy,unittest
from unittest.mock import patch
from core.editorial_execution import personal_case_errors,primary_lead_anchor
from core.role_evidence import role_names_person_exactly,team_listing_quote
from core.editorial_development import develop
from test_editorial_execution import linked_case

class PersonalEvidenceCapacityTests(unittest.TestCase):
    def participation(self):
        quote='Other team members:\nSofia Vega and Alex Rivera.'
        matters=[{'id':mid,'teamMembers':'Sofia Vega and Alex Rivera.','source_excerpt':quote} for mid in ('a','b')]
        candidate={'name':'Sofia Vega','recommendation':'develop','suggested_ranking':'Category pending',
            'submission_bio':'Sofia Vega is identified as a team member.',
            'supporting_matters':[{'matter_id':m['id'],'source_quote':quote,'personal_role':'Team member; individual work not stated'} for m in matters],
            'submission_case_coverage':[]}
        return {'directory':'Chambers','matters':matters},candidate
    def test_participation_does_not_require_invented_personal_achievements(self):
        p,c=self.participation();before=copy.deepcopy((p,c))
        self.assertEqual(personal_case_errors(p,c),[]);self.assertEqual((p,c),before)
        c['recommendation']='present';self.assertTrue(personal_case_errors(p,c))
    def test_pending_category_does_not_exempt_substantively_attributed_work(self):
        p,s,v=linked_case();c=v['candidates'][0]
        c.update(recommendation='develop',suggested_ranking='Category pending',submission_case_coverage=[])
        self.assertTrue(personal_case_errors(p,c,s))
    def test_only_original_structured_team_listing_qualifies(self):
        p,c=self.participation();m=p['matters'][0]
        self.assertTrue(team_listing_quote(c['name'],c['supporting_matters'][0]['source_quote'],m))
        self.assertFalse(team_listing_quote(c['name'],'Sofia Vega led collective negotiations.',m))
        self.assertFalse(team_listing_quote(c['name'],'Other team members: Alex Rivera.',m))
        self.assertFalse(team_listing_quote(c['name'],c['supporting_matters'][0]['source_quote'],{}))
    def test_primary_role_requires_exact_name_not_a_prefix_alias(self):
        p,c=self.participation();p['matters'][0]['leadPartner']='Sofia Vega Morales.'
        strategy={'matters':[{'matter_id':'a','disposition':'core'}]}
        self.assertIsNone(primary_lead_anchor(p,strategy,c))
        c['name']='Sofia Vega Morales';self.assertEqual(primary_lead_anchor(p,strategy,c),'a')
        self.assertTrue(role_names_person_exactly('Sofia Vega','Sofia Vega and Alex Rivera.'))
        self.assertFalse(role_names_person_exactly('Sofia Vega','Sofia Vega Morales.'))
    def test_exact_lead_requirement_survives_team_only_support_and_pending_category(self):
        p,c=self.participation();p['matters'][0]['leadPartner']='Sofia Vega'
        self.assertTrue(personal_case_errors(p,c,{'matters':[{'matter_id':'a','disposition':'core'}]}))
    def test_validation_only_never_buys_a_model_call_on_success_or_failure(self):
        p,s,v=linked_case();before=copy.deepcopy((p,s,v));base={'package':p,'strategy':s,'development':v,'development_reusable':True,'development_revalidation_only':True,'trace':[{'usage':{'total_tokens':123}}]}
        with patch('core.review_graph.invoke_role',side_effect=AssertionError('No paid call')):
            passed=develop(base);self.assertTrue(passed['development_validated']);self.assertEqual(passed['development'],v)
            bad=copy.deepcopy(v);bad['candidates'][0]['submission_case_coverage']=[]
            failed=develop({**base,'development':bad});self.assertFalse(failed['development_validated']);self.assertTrue(failed['development_repair_unlocatable'])
            missing=develop({**base,'development_reusable':False});self.assertFalse(missing['development_validated'])
            semantic=develop({**base,'repair_feedback':[{'severity':'critical','artifact_quote':'An old rejected assertion.'}]});self.assertFalse(semantic['development_validated'])
        self.assertEqual(passed['trace'],base['trace']);self.assertEqual((p,s,v),before)

    def test_exact_file_obligation_uses_the_same_participation_capacity(self):
        from core.editorial_case import obligations
        p,c=self.participation()
        checks=obligations(p,{'matters':[]},{'candidates':[c]})
        check=next(o for o in checks if o['id']=='candidate:0:b9')
        self.assertIn('team participation only',check['instruction'])
        self.assertIn('do not demand or invent',check['instruction'])
        c['recommendation']='present'
        check=next(o for o in obligations(p,{'matters':[]},{'candidates':[c]}) if o['id']=='candidate:0:b9')
        self.assertIn('through personally attributed work',check['instruction'])
