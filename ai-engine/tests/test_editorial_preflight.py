import unittest
from unittest.mock import patch
from core.review_graph import create_review_graph, register_gate, selection_gate, release_gate
from core.editorial_development import bind_quote

SOURCE='The team represented the employer in employment litigation.'
MATTER={'id':'m','client':'Fictional Employer','publish_status':'confidential','confidentialityConfirmed':True}
PACKAGE={'directory':'Chambers','practice_area':'Labour & Employment','b10_source':'Employment department.'}


class EditorialPreflightTests(unittest.TestCase):
    def test_unverified_ranking_is_not_reported_as_a_confirmed_mismatch(self):
        for status in ('not_found','unavailable','stale',None,'verified_mismatch','verified_match'):
            result=release_gate({'package':{**PACKAGE,'current_band':'Band 2','ranking_verification':{'status':status},'rendered_artifact':'Exact Word text','matters':[]},'judge':{'passed':True}},True)['release_verdict']
            if status=='verified_match':
                self.assertTrue(result['passed'])
            else:
                self.assertFalse(result['passed'])
                text=' '.join(result['errors'])
                self.assertEqual('no coincide' in text,status=='verified_mismatch')

    def test_notes_and_description_bind_without_fabricating_or_overwriting_a_narrative(self):
        for key in ('source_excerpt','rawNotes','summary','notes','description'):
            with self.subTest(key=key):
                matter={**MATTER,'source_excerpt':' ',key:SOURCE}
                package={**PACKAGE,'matters':[matter]}
                self.assertEqual(register_gate({'package':package})['errors'],[])
                self.assertEqual(bind_quote(SOURCE,matter),SOURCE)
                strategy={'hero_matter_id':'m','matters':[{'matter_id':'m','disposition':'core','rationale':'Employer litigation.', 'source_quote':SOURCE}]}
                self.assertTrue(selection_gate({'package':package,'strategy':strategy})['selection_validated'])

    def test_unsupported_target_and_empty_source_stop_before_any_model(self):
        for package in ({**PACKAGE,'directory':'IFLR1000','matters':[{**MATTER,'rawNotes':SOURCE}]},
                        {**PACKAGE,'matters':[{**MATTER,'rawNotes':SOURCE},{**MATTER,'id':'empty','rawNotes':' '}]}):
            with patch('core.review_graph.invoke_role') as model:
                result=create_review_graph().invoke({'package':package,'operation':'strategy'})
            model.assert_not_called()
            self.assertTrue(result['errors'])
            self.assertFalse(result['release_verdict']['passed'])
