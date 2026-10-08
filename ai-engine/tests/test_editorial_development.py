import copy
import unittest
from unittest.mock import patch
from core.editorial_development import development_errors
from core.review_graph import editor, ACCEPTANCE_CRITERIA, create_review_graph
from utils.rag_router import RAGRouter

SOURCE='Partner Sofia Vega led the negotiations and prevented a strike. Exposure fell by approximately eighty percent.'
PACKAGE={'directory':'Chambers','practice_area':'Labour & Employment','lawyers':[{'name':'Sofia Vega','isPartner':True}], 'matters':[{'id':'m1','source_excerpt':SOURCE,'leadPartner':'Sofia Vega'},{'id':'m2','source_excerpt':'The team provided routine advice.'}]}
STRATEGY={'matters':[{'matter_id':'m1','disposition':'core'},{'matter_id':'m2','disposition':'reserve'}],'hero_matter_id':'m1'}
DEV={**{k:'Source-backed case.' for k in ['filing_recommendation','positioning','target','principal_strength','principal_vulnerability','hero_rationale','b10','c2']},'matters':[{'matter_id':'m1','text':SOURCE,'decisive_source_quotes':['prevented a strike','approximately eighty percent']}], 'comparisons':[{'selected_id':'m1','alternative_id':'m2','incremental_contribution':'Proves negotiation outcome','tradeoff':'Routine advice adds no distinct capability'}], 'candidates':[{'name':'Sofia Vega','recommendation':'present','current_ranking':'No verified observation','suggested_ranking':'Partner candidacy; specific band not established','why_candidate':'Led the negotiations','supporting_matters':[{'matter_id':'m1','personal_role':'Lead negotiator','source_quote':'Partner Sofia Vega led the negotiations'}],'external_evidence':'No references supplied','evidence_gaps':'Obtain client reference','recommended_action':'Present with matter-linked evidence','submission_bio':SOURCE}]}

class DevelopmentTests(unittest.TestCase):
    def test_requires_all_selected_matters_and_all_candidates(self):
        self.assertEqual(development_errors(PACKAGE,STRATEGY,DEV),[])
        for field in ('matters','candidates','comparisons'):
            broken={**DEV,field:[]}
            self.assertTrue(development_errors(PACKAGE,STRATEGY,broken),field)
    def test_quotes_cannot_migrate_between_mandates(self):
        broken=copy.deepcopy(DEV);broken['matters'][0]['decisive_source_quotes']=['The team provided routine advice.']
        self.assertTrue(development_errors(PACKAGE,STRATEGY,broken))
    def test_decorative_quote_marks_are_not_a_false_source_conflict(self):
        broken=copy.deepcopy(DEV);broken['matters'][0]['decisive_source_quotes']=['“prevented a strike”']
        self.assertEqual(development_errors(PACKAGE,STRATEGY,broken),[])
        broken['matters'][0]['decisive_source_quotes']=['“won an award”']
        self.assertTrue(development_errors(PACKAGE,STRATEGY,broken))
    def test_partner_cannot_keep_an_associate_category(self):
        broken=copy.deepcopy(DEV);broken['candidates'][0]['suggested_ranking']='Associate to Watch'
        self.assertTrue(development_errors(PACKAGE,STRATEGY,broken))
    def test_blank_c2_cannot_pass(self):
        self.assertTrue(development_errors(PACKAGE,STRATEGY,{**DEV,'c2':''}))
    def test_positive_judge_without_acceptance_coverage_is_rejected(self):
        state={'package':{**PACKAGE,'editorial_development':DEV},'strategy':STRATEGY,'letter':{}}
        with patch('core.review_graph.invoke_role',return_value=({'passed':True,'defects':[]},[])):
            result=editor(state)
        self.assertFalse(result['judge']['passed'])
        self.assertEqual(result['judge']['defects'][0]['code'],'EDITORIAL_OMISSION')
    def test_omitted_source_outcome_overrides_positive_judge_flag(self):
        checks=[{'criterion':key,'status':'failed' if key=='decisive_evidence' else 'met','evidence':'Source says eighty percent; final account omits it.'} for key in ACCEPTANCE_CRITERIA]
        with patch('core.review_graph.invoke_role',return_value=({'passed':True,'defects':[],'acceptance':checks},[])):
            result=editor({'package':{**PACKAGE,'editorial_development':DEV},'strategy':STRATEGY,'letter':{}})
        self.assertFalse(result['judge']['passed'])
    def test_production_rag_includes_individual_methodology_and_later_practice_sections(self):
        r=RAGRouter();chunks=r.retrieve('Labour & Employment','Chambers','Mexico',task='individual lawyer candidate leadership personal role matter evidence narrative outcomes')
        sources={c.source for c in chunks}
        self.assertIn('¿Cómo rankeamos abogado_as__.txt',sources)
        self.assertIn('Global Lawyer Leadership Framework — RankPilot RAG v1.txt',sources)
        labour=[c for c in chunks if c.source=='UNIVERSAL CHAMBERS LABOUR LOGIC.txt']
        old={'rag-0e14054bcbd1','rag-2591427b0a2e','rag-15e8447cf657'}
        self.assertTrue(any(c.chunk_id not in old for c in labour))
        self.assertGreater(max(c.score for c in chunks),1)

class QuoteRecoveryTests(unittest.TestCase):
    def test_terminal_period_binds_to_exact_source_clause_only(self):
        from core.editorial_development import bind_quote
        source={'source_excerpt':'The team reduced exposure by approximately 80 percent, while other proceedings remained pending.'}
        self.assertEqual(bind_quote('The team reduced exposure by approximately 80 percent.',source),'The team reduced exposure by approximately 80 percent')
        for quote in ['The team reduced exposure by approximately 90 percent.','The team did not reduce exposure by approximately 80 percent.','The team reduced exposure by approximately 80.']:
            self.assertIsNone(bind_quote(quote,source))
        self.assertIsNone(bind_quote('The team reduced exposure by approximately 80 percent.',{'source_excerpt':'An unrelated mandate.'}))
    def test_matching_saved_development_revalidates_without_paid_call(self):
        from core.editorial_development import develop
        proposal=copy.deepcopy(DEV)
        proposal['matters'][0]['decisive_source_quotes']=['Partner Sofia Vega led the negotiations.']
        package=copy.deepcopy(PACKAGE)
        package['matters'][0]['source_excerpt']='Partner Sofia Vega led the negotiations, and prevented a strike. Exposure fell by approximately eighty percent.'
        with patch('core.review_graph.invoke_role') as model:
            result=develop({'package':package,'strategy':STRATEGY,'development':proposal,'development_reusable':True})
        model.assert_not_called()
        self.assertTrue(result['development_validated'])
        self.assertEqual(result['development']['matters'][0]['decisive_source_quotes'],['Partner Sofia Vega led the negotiations'])
        self.assertNotIn('trace',result)
