import unittest
from unittest.mock import patch
from core.review_graph import create_review_graph

SOURCE='The team represented Synthetic Client in a tax appeal. The appeal remains pending.'
PACKAGE={'directory':'Chambers','practice_area':'Tax','b10_source':'The department advises on tax disputes.','matters':[{'id':'m1','client':'Synthetic Client','rawNotes':SOURCE,'publish_status':'publishable','confidentialityConfirmed':True}]}
STRATEGY={'matters':[{'matter_id':'m1','disposition':'core','rationale':'Tax appeal','source_quote':'The appeal remains pending.'}],'hero_matter_id':'m1','pending_questions':[],'thesis':'Tax disputes'}
LETTER={k:'Source-grounded text.' for k in ['executive_assessment','portfolio','leadership','evidence_gaps','next_steps']}

class ReviewGraphTests(unittest.TestCase):
    def run_graph(self, strategy=STRATEGY, judge=None, package=PACKAGE):
        calls=[]
        def invoke(state,role,*args):
            calls.append(role)
            result=strategy if role=='strategist' else LETTER if role=='writer' else (judge or {'passed':True,'defects':[]})
            return result, state.get('trace',[])+[{'role':role}]
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            result=create_review_graph().invoke({'package':package})
        return result,calls

    def test_three_roles_share_one_strategy(self):
        result,calls=self.run_graph()
        self.assertEqual(calls,['strategist','writer','editor'])
        self.assertTrue(result['release_verdict']['passed'])

    def test_unknown_id_stops_before_writing(self):
        strategy={**STRATEGY,'matters':[{**STRATEGY['matters'][0],'matter_id':'invented'}]}
        result,calls=self.run_graph(strategy=strategy)
        self.assertEqual(calls,['strategist'])
        self.assertFalse(result['release_verdict']['passed'])

    def test_invented_quote_stops_before_writing(self):
        strategy={**STRATEGY,'matters':[{**STRATEGY['matters'][0],'source_quote':'The client won USD 90 million.'}]}
        result,calls=self.run_graph(strategy=strategy)
        self.assertEqual(calls,['strategist'])
        self.assertFalse(result['release_verdict']['passed'])

    def test_letter_repair_is_bounded_and_does_not_redo_strategy(self):
        result,calls=self.run_graph(judge={'passed':False,'defects':[{'severity':'critical','scope':'letter','matter_id':None,'message':'Unsupported claim'}]})
        self.assertEqual(calls,['strategist','writer','editor','writer','editor'])
        self.assertFalse(result['release_verdict']['passed'])

    def test_missing_permission_overrides_positive_model_judge(self):
        package={**PACKAGE,'matters':[{**PACKAGE['matters'][0],'confidentialityConfirmed':False,'publish_status':'confirmation_required'}]}
        result,_=self.run_graph(package=package)
        self.assertFalse(result['release_verdict']['passed'])

    def test_duplicate_register_never_calls_a_model(self):
        result,calls=self.run_graph(package={**PACKAGE,'matters':PACKAGE['matters']*2})
        self.assertEqual(calls,[])
        self.assertFalse(result['release_verdict']['passed'])

    def test_unverified_ranking_overrides_positive_judge(self):
        result,_=self.run_graph(package={**PACKAGE,'current_band':'Band 2','ranking_verification':{'status':'verified_mismatch','observed_band':'Band 3'}})
        self.assertFalse(result['release_verdict']['passed'])

    def test_post_render_letter_repair_is_bounded_and_preserves_artifact(self):
        from core.review_graph import review_rendered_package
        state={'package':{**PACKAGE,'rendered_artifact':'EXACT DOCX TEXT'},'strategy':STRATEGY,'letter':LETTER,'trace':[]}
        defect={'passed':False,'defects':[{'severity':'critical','scope':'letter','matter_id':None,'message':'Stale letter'}]}
        with patch('core.review_graph.editor',return_value={'judge':defect,'trace':[]}) as judge, patch('core.review_graph.writer',return_value={'letter':LETTER,'writer_attempts':1,'trace':[]}) as writer:
            result=review_rendered_package(state)
        self.assertEqual(judge.call_count,2);self.assertEqual(writer.call_count,1);self.assertFalse(result['judge']['passed']);self.assertEqual(state['package']['rendered_artifact'],'EXACT DOCX TEXT')

    def test_post_render_matter_defect_cannot_be_repaired_by_letter_writer(self):
        from core.review_graph import review_rendered_package
        defect={'passed':False,'defects':[{'severity':'critical','scope':'submission','matter_id':'m1','message':'Unsupported outcome'}]}
        with patch('core.review_graph.editor',return_value={'judge':defect,'trace':[]}), patch('core.review_graph.writer') as writer:
            result=review_rendered_package({'package':PACKAGE,'strategy':STRATEGY,'letter':LETTER,'trace':[]})
        writer.assert_not_called();self.assertFalse(result['judge']['passed'])

    def test_literal_clause_with_terminal_period_accepts_source_comma(self):
        package={**PACKAGE,'matters':[{**PACKAGE['matters'][0],'rawNotes':'The appeal remains pending, with a hearing scheduled.'}]}
        result,calls=self.run_graph(package=package)
        self.assertTrue(result['selection_validated'])
        self.assertEqual(calls,['strategist','writer','editor'])

    def test_terminal_tolerance_does_not_accept_changed_words(self):
        strategy={**STRATEGY,'matters':[{**STRATEGY['matters'][0],'source_quote':'The appeal was successful.'}]}
        result,calls=self.run_graph(strategy=strategy)
        self.assertFalse(result['selection_validated'])
        self.assertEqual(calls,['strategist'])
        self.assertNotIn('Editorial review did not approve this package.',result['release_verdict']['errors'])

    def test_source_quotes_cannot_join_two_different_fields(self):
        package={**PACKAGE,'matters':[{**PACKAGE['matters'][0],'source_excerpt':'The appeal remains','rawNotes':'pending.'}]}
        result,calls=self.run_graph(package=package)
        self.assertFalse(result['selection_validated'])
        self.assertEqual(calls,['strategist'])
