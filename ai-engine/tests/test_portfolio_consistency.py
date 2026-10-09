import unittest
from core.portfolio_consistency import portfolio_defects

PACKAGE={'matters':[{'id':'a','client':'NORTHSTAR'},{'id':'b','client':'Delta Industries, S.A.'},{'id':'c','client':'Nova Holdings'}]}
STRATEGY={'matters':[{'matter_id':'a','disposition':'core'},{'matter_id':'b','disposition':'reserve'},{'matter_id':'c','disposition':'core'}]}
class PortfolioConsistencyTests(unittest.TestCase):
    def test_implicit_reserve_list_detected_without_judge(self):
        defects=portfolio_defects(PACKAGE,STRATEGY,{'evidence_gaps':'Delta Industries y NORTHSTAR son asesoría útil, pero menos diferenciadora.'})
        self.assertEqual([d['matter_id'] for d in defects],['a'])
        self.assertEqual(defects[0]['owner'],'rankpilot')
    def test_selected_vs_reserve_comparison_is_allowed(self):
        self.assertEqual(portfolio_defects(PACKAGE,STRATEGY,{'evidence_gaps':'Delta Industries queda detrás de NORTHSTAR por sus resultados.'}),[])
        self.assertEqual(portfolio_defects(PACKAGE,STRATEGY,{'evidence_gaps':'NORTHSTAR es core; Delta Industries queda en reserva.'}),[])
    def test_reserve_in_recommended_portfolio_blocked(self):
        self.assertEqual(portfolio_defects(PACKAGE,STRATEGY,{'portfolio':'1. Delta Industries: el equipo asesoró la transacción.'})[0]['matter_id'],'b')
    def test_prefix_collision_does_not_bind_another_client(self):
        self.assertEqual(portfolio_defects(PACKAGE,STRATEGY,{'evidence_gaps':'NORTHSTARTECH queda en reserva.'}),[])
    def test_ambiguous_same_client_matters_not_silently_reclassified(self):
        p={'matters':[{'id':'a','client':'Shared Client'},{'id':'b','client':'Shared Client'}]}
        self.assertEqual(portfolio_defects(p,STRATEGY,{'evidence_gaps':'Shared Client aporta asesoría.'}),[])

class PortfolioMeaningTests(unittest.TestCase):
    def test_shared_selected_predicate_not_a_false_reserve(self):
        from unittest.mock import patch
        from core.portfolio_consistency import verify_portfolio_consistency
        clause='La selección incluye NORTHSTAR junto con Nova Holdings.'
        letter={'evidence_gaps':clause}
        candidates=portfolio_defects(PACKAGE,STRATEGY,letter)
        result={'interpretations':[{'index':i,'disposition':'core','quote':clause,'reason':'Shared inclusion predicate.'} for i,_ in enumerate(candidates)]}
        with patch('core.review_graph.invoke_role',return_value=(result,[])):
            defects,_=verify_portfolio_consistency({'package':PACKAGE,'strategy':STRATEGY},letter)
        self.assertEqual(defects,[])
    def test_implicit_reserve_is_verified_then_compared_to_saved_selection(self):
        from unittest.mock import patch
        from core.portfolio_consistency import verify_portfolio_consistency
        clause='Delta Industries y NORTHSTAR son asesoría menos diferenciadora.'
        result={'interpretations':[{'index':0,'disposition':'reserve','quote':clause,'reason':'Listed as reserves in this section.'}]}
        with patch('core.review_graph.invoke_role',return_value=(result,[])):
            defects,_=verify_portfolio_consistency({'package':PACKAGE,'strategy':STRATEGY},{'evidence_gaps':clause})
        self.assertEqual(defects[0]['matter_id'],'a')
    def test_unverified_or_omitted_classification_cannot_pass(self):
        from unittest.mock import patch
        from core.portfolio_consistency import verify_portfolio_consistency
        with patch('core.review_graph.invoke_role',return_value=({'interpretations':[]},[])):
            with self.assertRaises(ValueError):verify_portfolio_consistency({'package':PACKAGE,'strategy':STRATEGY},{'evidence_gaps':'NORTHSTAR queda en reserva.'})

class AmbiguousMembershipTests(unittest.TestCase):
    def test_ambiguous_membership_is_automatic_clarification_not_silent_pass(self):
        from unittest.mock import patch
        from core.portfolio_consistency import verify_portfolio_consistency
        clause='Delta Industries y NORTHSTAR son asesoría menos diferenciadora.'
        result={'interpretations':[{'index':0,'disposition':'ambiguous','reason':'Unclear collective membership.'}]}
        with patch('core.review_graph.invoke_role',return_value=(result,[])):
            defects,_=verify_portfolio_consistency({'package':PACKAGE,'strategy':STRATEGY},{'evidence_gaps':clause})
        self.assertEqual(defects[0]['owner'],'rankpilot')
        self.assertIn('ambigua',defects[0]['message'])

    def test_sector_discrepancy_is_not_a_portfolio_classification(self):
        from unittest.mock import patch
        from core.portfolio_consistency import verify_portfolio_consistency
        clause='NORTHSTAR tiene descripciones contradictorias de su sector en las fuentes.'
        result={'interpretations':[{'index':0,'disposition':'not_classified','reason':'Sector discrepancy only; no membership assertion.'}]}
        with patch('core.review_graph.invoke_role',return_value=(result,[])):
            defects,_=verify_portfolio_consistency({'package':PACKAGE,'strategy':STRATEGY},{'evidence_gaps':clause})
        self.assertEqual(defects,[])

    def test_evidence_is_bound_to_the_original_clause_without_model_recopied_quotes(self):
        from unittest.mock import patch
        from core.portfolio_consistency import verify_portfolio_consistency
        clause='NORTHSTAR queda en reserva.'
        result={'interpretations':[{'index':0,'disposition':'reserve','reason':'Explicit reserve assertion.'}]}
        with patch('core.review_graph.invoke_role',return_value=(result,[])):
            defects,_=verify_portfolio_consistency({'package':PACKAGE,'strategy':STRATEGY},{'evidence_gaps':clause})
        self.assertEqual(defects[0]['artifact_quote'],clause)
        result['interpretations'][0]['index']=3
        with patch('core.review_graph.invoke_role',return_value=(result,[])):
            with self.assertRaisesRegex(ValueError,'references'):
                verify_portfolio_consistency({'package':PACKAGE,'strategy':STRATEGY},{'evidence_gaps':clause})

    def test_comparison_does_not_hide_a_reclassification_of_its_subject(self):
        defects=portfolio_defects(PACKAGE,STRATEGY,{'evidence_gaps':'NORTHSTAR frente a Delta Industries pierde prioridad y queda en reserva.'})
        self.assertEqual(defects[0]['matter_id'],'a')
