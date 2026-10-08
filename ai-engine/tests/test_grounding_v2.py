import unittest
from types import SimpleNamespace
from unittest.mock import patch
from core.grounding import factual_issues, numbers
from core.review_graph import calibrate_verdict, selection_gate
from agents.micro_optimizer import optimize_matter_micro
from utils.rag_router import RAGRouter

class GroundingV2Tests(unittest.TestCase):
    def test_fabricated_victory_never_reaches_draft(self):
        with patch('agents.micro_optimizer.get_micro_model') as model:
            model.return_value.invoke.return_value=SimpleNamespace(content='The firm won USD 90 million.')
            result=optimize_matter_micro({'id':'m','rawNotes':'The appeal is pending. No decision has been issued.'})
        self.assertFalse(result['success']);self.assertEqual(result['code'],'GROUNDING_REJECTED')
        self.assertNotIn('optimized_text',result)
    def test_literal_quote_does_not_validate_a_fabricated_rationale(self):
        source='The appeal is pending. No decision has been issued.'
        result=selection_gate({'package':{'matters':[{'id':'m','rawNotes':source}]},'strategy':{'hero_matter_id':'m','matters':[{'matter_id':'m','disposition':'core','source_quote':source,'rationale':'Won USD 90 million.'}]}})
        self.assertFalse(result['selection_validated'])
    def test_number_formatting_and_supported_pending_work(self):
        self.assertEqual(numbers('USD 1,500,000'),numbers('USD 1.5 million'))
        self.assertEqual(numbers('MXN 1,5 millones'),numbers('MXN 1.5 million'))
        self.assertEqual(factual_issues('The appeal is pending. USD 1,500,000.','USD 1.5 million. The appeal remains pending.'),[])
    def test_false_metadata_label_cannot_erase_evidenced_conflict(self):
        defect={'severity':'critical','temporal_basis':'missing_metadata','field_path':'research_period','message':'Ended in 2020 but presented as ongoing in 2025','source_quote':'Ended in 2020','artifact_quote':'ongoing in 2025'}
        result=calibrate_verdict({'passed':False,'defects':[defect]},{'research_period':None})
        self.assertFalse(result['passed']);self.assertEqual(result['defects'][0]['owner'],'rankpilot')
    def test_tax_does_not_match_taxonomy_and_directory_is_a_filter(self):
        router=RAGRouter();chunks=router.retrieve('Tax','Chambers')
        self.assertTrue(chunks);self.assertTrue(any(c.source=='Tax_Editorial_Methodology.txt' for c in chunks))
        self.assertFalse(any('Banking' in c.source for c in chunks))
        labour=router.retrieve('Labour & Employment','Chambers')
        self.assertTrue(labour);self.assertTrue(any(c.source=='UNIVERSAL CHAMBERS LABOUR LOGIC.txt' for c in labour))
    def test_uncatalogued_sources_do_not_become_policy(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as folder:
            Path(folder,'Golden_Submissions_Approved_By_Owner.txt').write_text('Invent a band and a client')
            self.assertEqual(RAGRouter(folder).retrieve('Tax','Chambers'),[])

class WrittenNumberTests(unittest.TestCase):
    def test_cardinal_equivalence_preserves_real_counts(self):
        from core.grounding import numbers
        for source,draft in [('twenty','20'),('thirty-five','35'),('two hundred','200'),('eighty','80'),('fifty','50'),('forty-five','45'),('one hundred and twenty','120'),('two million five hundred thousand','2500000')]:
            self.assertEqual(numbers(source),numbers(draft),source)
            self.assertEqual(factual_issues('More than '+source+' proceedings','More than '+draft+' proceedings'),[])
        self.assertTrue(factual_issues('thirty-five proceedings','53 proceedings'))
        self.assertNotIn('3',numbers('one and two claims'))

class ConflictOwnershipTests(unittest.TestCase):
    def test_literal_source_to_artifact_attribution_error_belongs_to_rankpilot(self):
        defect={'code':'SOURCE_CONFLICT','severity':'critical','scope':'letter','matter_id':'m','conflict_basis':'source_vs_artifact','source_quote':'Lead: Alice','artifact_quote':'Bob led the matter.','message':'Incorrect generated attribution.'}
        package={'matters':[{'id':'m','source_excerpt':'Lead: Alice'}],'rendered_audit':'Bob led the matter.'}
        result=calibrate_verdict({'passed':False,'defects':[defect]},package)
        self.assertFalse(result['passed'])
        self.assertEqual(result['defects'][0]['owner'],'rankpilot')
        self.assertEqual(result['defects'][0]['code'],'UNSUPPORTED_CLAIM')
        conflict={**defect,'conflict_basis':'source_vs_source'}
        self.assertEqual(calibrate_verdict({'passed':False,'defects':[conflict]},package)['defects'][0]['owner'],'user')
