import copy
import unittest
from unittest.mock import patch
from pydantic import ValidationError
from core.selection_review import review_selection
from core.review_graph import create_review_graph, register_gate, run_editorial_stage
from utils.rag_router import RAGRouter
from utils.ranking_verifier import market_context

SOURCE='The firm challenged a zoning decree restricting residential development and property rights. The challenge remains pending.'
MATTER={'id':'property-1','client':'Synthetic Owner','rawNotes':SOURCE,'publish_status':'non_publishable','confidentialityConfirmed':True}
BAD={'matters':[{'matter_id':'property-1','disposition':'reserve','legal_understanding':'Tax controversy','rationale':'No property nexus','source_quote':SOURCE}], 'hero_matter_id':None,'pending_questions':[],'thesis':'Tax controversy'}
GOOD={**BAD,'matters':[{**BAD['matters'][0],'disposition':'core','legal_understanding':'Pending challenge to zoning restrictions and property rights.','rationale':'Direct property rights work'}],'hero_matter_id':'property-1'}

def verdict(status='supported',quote=''):
    return {'checks':{'M01':{'status':status,'explanation':'Property rights, not a tax assessment.', 'source_quote':quote}}}

class SelectionSemanticTests(unittest.TestCase):
    def test_semantic_rejection_repairs_before_any_development(self):
        package={'directory':'Chambers','practice_area':'Real Estate','matters':[MATTER]}
        before=copy.deepcopy(package); calls=[]
        def select(state):
            calls.append('select')
            return {'strategy':BAD if len(calls)==1 else GOOD,'errors':[]}
        def invoke(state,role,*args):
            calls.append(role)
            return (verdict('repair_required',SOURCE) if calls.count(role)==1 else verdict()),[]
        # Use a nonempty core on first attempt so the deterministic selection gate passes.
        bad_core={**BAD,'matters':[{**BAD['matters'][0],'disposition':'core'}],'hero_matter_id':'property-1'}
        def select_core(state):
            result=select(state)
            if result['strategy'] is BAD: result['strategy']=bad_core
            return result
        with patch('core.review_graph.strategist',side_effect=select_core),patch('core.review_graph.invoke_role',side_effect=invoke):
            result=create_review_graph().invoke({'package':package,'operation':'strategy'})
        self.assertEqual(calls,['select','selection_reviewer','select','selection_reviewer'])
        self.assertTrue(result['selection_review_validated'])
        self.assertEqual(result['strategy'],GOOD)
        self.assertEqual(package,before)

    def test_reviewer_checks_excluded_matter_and_requires_source_support(self):
        state={'package':{'matters':[MATTER]},'strategy':BAD}
        result=review_selection(state,lambda *args:(verdict('repair_required',SOURCE),[]))
        self.assertFalse(result['selection_validated'])
        self.assertIn('property-1',result['selection_review']['checks'])
        self.assertTrue(result['selection_feedback']['semantic_rejection'])
        invalid=review_selection(state,lambda *args:(verdict('repair_required','invented assertion'),[]))
        self.assertFalse(invalid['selection_review_validated'])

    def test_missing_review_entry_cannot_pass(self):
        with self.assertRaises(ValidationError):
            review_selection({'package':{'matters':[MATTER]},'strategy':BAD},lambda *a:({'checks':{}},[]))

    def test_unknown_confidentiality_stops_before_paid_nodes(self):
        m={**MATTER,'publish_status':'confirmation_required','confidentialityConfirmed':False}
        with patch('core.review_graph.invoke_role') as model:
            result=create_review_graph().invoke({'package':{'matters':[m]},'operation':'strategy'})
        model.assert_not_called();self.assertTrue(result['errors'])
        self.assertEqual(register_gate({'package':{'matters':[MATTER]}})['errors'],[])

    def test_development_requires_semantic_review(self):
        with self.assertRaisesRegex(ValueError,'semantic'):
            run_editorial_stage('development',{'selection_validated':True})

    def test_tax_venezuela_has_no_mexican_examples(self):
        router=RAGRouter()
        for task in ['strategist tax portfolio','selection_reviewer legal issue','editor tax currency jurisdiction','writer authority outcomes']:
            chunks=router.retrieve('Tax','Chambers','Venezuela',task=task)
            self.assertTrue(any(c.source=='Tax_Editorial_Methodology.txt' for c in chunks))
            text=' '.join(c.text for c in chunks)
            self.assertNotRegex(text,r'\bSAT\b|\bPRODECON\b')
            self.assertFalse(any(c.source=='Rankpilot Tax Guides Context Mapping - Chambers.txt' for c in chunks))

    def test_real_estate_rag_contains_no_named_case_answers(self):
        chunks=RAGRouter().retrieve('Real Estate','Chambers','Mexico',task='property rights zoning')
        text=' '.join(c.text for c in chunks)
        self.assertTrue(any(c.source=='Real_Estate_Editorial_Methodology.txt' for c in chunks))
        self.assertNotIn('Familia De Anda',text);self.assertNotIn('Band 4',text)

    def test_table_observation_is_not_full_market_calibration(self):
        benchmark={'firms':[{'name':'Our Firm','band':'Band 2'},{'name':'Peer','band':'Band 1'}]}
        self.assertEqual(market_context({'status':'not_found'},benchmark)['status'],'unavailable')
        result=market_context({'status':'verified_match','firm_name':'Our Firm'},benchmark)
        self.assertEqual(result['status'],'table_only');self.assertEqual([c['name'] for c in result['competitors']],['Peer'])

    def test_unavailable_reviewer_preserves_selector_without_fabricating_approval(self):
        from core.review_graph import selection_review, select_or_reuse
        state={'package':{'matters':[MATTER]},'strategy':GOOD,'trace':[{'role':'strategist'}]}
        with patch('core.review_graph.invoke_role',side_effect=TimeoutError('provider unavailable')):
            result=selection_review(state)
        self.assertFalse(result['selection_review_validated'])
        self.assertFalse(result['selection_feedback']['semantic_rejection'])
        with patch('core.review_graph.strategist') as model:
            reused=select_or_reuse({**state,**result})
        model.assert_not_called();self.assertEqual(reused['strategy']['hero_matter_id'],'property-1')

    def test_stage_deadline_stops_before_starting_another_paid_call(self):
        from core.review_graph import invoke_role
        with patch('core.review_graph.create_chat_model') as factory:
            with self.assertRaises(TimeoutError):
                invoke_role({'stage_deadline':0},'selection_reviewer',None,'test',{})
        factory.assert_not_called()
