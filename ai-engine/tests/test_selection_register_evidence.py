"""A source-register citation must reach bounded repair, never false approval."""
import copy
import unittest
from unittest.mock import patch
from core.selection_review import bind_selection_review_quote, can_repair_selection, review_selection
from core.review_graph import create_review_graph
from core.editorial_reasoning import SOURCE_COMPARISON, reasoning_guidance

SOURCE='The firm represents the employer in workforce litigation and preventive compliance.'
ROW='Fictional Sentinel | Private education | Y | Y | labour litigation and compliance'
MATTER={'id':'m1','client':'Fictional Sentinel','source_excerpt':SOURCE,'publish_status':'confidential','confidentialityConfirmed':True,
        'confidentialityEvidence':{'client_register':[{'client':'Fictional Sentinel','quote':ROW,'line':11,'status':'confidential'}]}}
DECISION={'matter_id':'m1','disposition':'core','rationale':'A security-sector employer mandate.','legal_understanding':'The client is a security-sector company; the firm represents its workforce litigation.','source_quote':SOURCE}
STRATEGY={'matters':[DECISION],'hero_matter_id':'m1','pending_questions':[],'thesis':'Employer-side Labour & Employment'}
PACKAGE={'directory':'Chambers','practice_area':'Labour & Employment','matters':[MATTER]}
BAD={'checks':{'M01':{'status':'repair_required','explanation':'Correct only the optional generated industry assertion; retain supported legal work.','source_quote':ROW,'decision_quote':'A security-sector employer mandate.'}}}
GOOD={'checks':{'M01':{'status':'supported','explanation':'The supported employer work remains accurately described.','source_quote':''}}}

class SelectionRegisterEvidenceTests(unittest.TestCase):
    def test_an_own_register_row_is_grounded_but_still_requires_correction(self):
        before=copy.deepcopy(MATTER)
        result=review_selection({'package':PACKAGE,'strategy':STRATEGY},lambda *args:(BAD,[]))
        self.assertFalse(result['selection_review_validated'])
        self.assertFalse(result['selection_validated'])
        self.assertEqual(result['selection_failure_history'],[['m1']])
        self.assertTrue(can_repair_selection(result))
        self.assertEqual(result['selection_feedback']['failed_checks']['m1']['source_quote'],ROW)
        self.assertNotIn('debe justificar',result['errors'][0])
        self.assertEqual(MATTER,before)
        self.assertEqual(bind_selection_review_quote(SOURCE,MATTER),SOURCE)
        self.assertEqual(bind_selection_review_quote(ROW,{**MATTER,'client':'Client: Fictional Sentinel'}),ROW)
        from core.review_graph import selection_gate
        self.assertFalse(selection_gate({'package':PACKAGE,'strategy':{**STRATEGY,'matters':[{**DECISION,'source_quote':ROW}]}})['selection_validated'])

    def test_a_different_clients_row_or_rewritten_cells_cannot_authorize_repair(self):
        other={**MATTER,'client':'Other Client'}
        for value,matter in [(ROW,other),(ROW.replace('Private education','Industrial manufacturing'),MATTER),(ROW.replace('|','/'),MATTER),('Private education',MATTER),(ROW,{**MATTER,'confidentialityEvidence':{}})]:
            with self.subTest(value=value):self.assertEqual(bind_selection_review_quote(value,matter),'')
        package={'matters':[other]}
        result=review_selection({'package':package,'strategy':STRATEGY},lambda *args:(BAD,[]))
        self.assertFalse(result['selection_validated'])
        self.assertFalse(can_repair_selection(result))
        self.assertEqual(result['selection_failure_history'],[[]])

    def test_bounded_repair_and_independent_recheck_preserve_portfolio_and_sources(self):
        corrected={**DECISION,'rationale':'Supported employer litigation and compliance.','legal_understanding':'The firm represents the employer in workforce litigation and preventive compliance.'}
        before=copy.deepcopy(PACKAGE);calls=[]
        def invoke(state,role,*args):
            calls.append(role)
            if role=='strategist':return {'core_corrections':[corrected],'other_corrections':[],'unresolved':[]},[]
            return (BAD if calls.count('selection_reviewer')==1 else GOOD),[]
        with patch('core.review_graph.strategist',return_value={'strategy':STRATEGY,'errors':[]}),patch('core.review_graph.invoke_role',side_effect=invoke),patch('core.review_graph.develop') as develop:
            result=create_review_graph().invoke({'package':PACKAGE,'operation':'strategy'})
        self.assertEqual(calls,['selection_reviewer','strategist','selection_reviewer'])
        self.assertTrue(result['selection_review_validated'])
        self.assertEqual(result['strategy']['matters'],[corrected])
        self.assertEqual(result['strategy']['hero_matter_id'],'m1')
        self.assertEqual(PACKAGE,before)
        self.assertNotIn('approved_artifact',result)
        develop.assert_not_called()

    def test_a_repeated_grounded_finding_stops_without_drafting_or_approval(self):
        calls=[]
        def invoke(state,role,*args):
            calls.append(role)
            return ({'core_corrections':[DECISION],'other_corrections':[],'unresolved':[]} if role=='strategist' else BAD),[]
        with patch('core.review_graph.strategist',return_value={'strategy':STRATEGY,'errors':[]}),patch('core.review_graph.invoke_role',side_effect=invoke),patch('core.review_graph.develop') as develop:
            result=create_review_graph().invoke({'package':PACKAGE})
        self.assertEqual(calls,['selection_reviewer','strategist','selection_reviewer'])
        self.assertFalse(result['selection_review_validated'])
        self.assertFalse(result['release_verdict']['passed'])
        develop.assert_not_called()

    def test_comparison_policy_reaches_strategy_selection_development_audit_and_editor(self):
        for role in ('strategist','selection_reviewer','development','writer','editor','repair'):
            with self.subTest(role=role):self.assertIn(SOURCE_COMPARISON,reasoning_guidance(role))
