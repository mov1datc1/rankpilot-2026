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
    def test_optional_sector_withdrawal_is_an_editorial_repair_not_a_source_confirmation(self):
        defect={'code':'SOURCE_CONFLICT','severity':'critical','scope':'submission','matter_id':'m','conflict_basis':'source_vs_source','conflict_resolution':'omit_nonessential_descriptor','field_path':'client_sector','source_quote':'Sector: education','artifact_quote':'security business','conflicting_artifact_term':'security','message':'Withdraw only the disputed descriptor.'}
        package={'matters':[{'id':'m','source_excerpt':'Sector: education. Narrative: security business. 50 proceedings.'}],'rendered_artifact':'The security business retained the firm for 50 proceedings.'}
        result=calibrate_verdict({'passed':False,'defects':[defect]},package)
        self.assertFalse(result['passed'])
        self.assertEqual(result['defects'][0]['owner'],'rankpilot')
        self.assertEqual(result['defects'][0]['severity'],'critical')
        self.assertEqual(result['defects'][0]['code'],'SOURCE_CONFLICT')
        self.assertIn('Sector: education',package['matters'][0]['source_excerpt'])
        for changes in [{'field_path':'outcome'},{'field_path':'value'},{'scope':'facts'},{'matter_id':'other'},{'artifact_quote':'Absent quotation'},{'conflict_resolution':'confirm_source'}]:
            with self.subTest(changes=changes):
                actual=calibrate_verdict({'passed':False,'defects':[{**defect,**changes}]},package)
                self.assertEqual(actual['defects'][0]['owner'],'user')
                self.assertFalse(actual['passed'])

    def test_literal_source_to_artifact_attribution_error_belongs_to_rankpilot(self):
        defect={'code':'SOURCE_CONFLICT','severity':'critical','scope':'letter','matter_id':'m','conflict_basis':'source_vs_artifact','source_quote':'Lead: Alice','artifact_quote':'Bob led the matter.','message':'Incorrect generated attribution.'}
        package={'matters':[{'id':'m','source_excerpt':'Lead: Alice'}],'rendered_audit':'Bob led the matter.'}
        result=calibrate_verdict({'passed':False,'defects':[defect]},package)
        self.assertFalse(result['passed'])
        self.assertEqual(result['defects'][0]['owner'],'rankpilot')
        self.assertEqual(result['defects'][0]['code'],'UNSUPPORTED_CLAIM')
        conflict={**defect,'conflict_basis':'source_vs_source'}
        self.assertEqual(calibrate_verdict({'passed':False,'defects':[conflict]},package)['defects'][0]['owner'],'user')

    def test_reserve_alias_containment_preserves_critical_review_and_never_canonicalizes_core(self):
        defect={'code':'SOURCE_CONFLICT','severity':'critical','scope':'letter','matter_id':'m','conflict_basis':'source_vs_source','conflict_resolution':'preserve_source_aliases','field_path':'client','source_quote':'Field: Alpha. Narrative: Alfa.','artifact_quote':'Alpha is reserve.','message':'Retain both supplied variants in the internal comparison.'}
        package={'matters':[{'id':'m','source_excerpt':defect['source_quote']}],'rendered_audit':'Alpha is reserve.'}
        strategy={'matters':[{'matter_id':'m','disposition':'reserve'}]}
        result=calibrate_verdict({'passed':False,'defects':[defect]},package,strategy)
        self.assertFalse(result['passed']);self.assertEqual(result['defects'][0]['owner'],'rankpilot')
        self.assertEqual(result['defects'][0]['severity'],'critical')
        for changes in [{'scope':'submission'},{'field_path':'role'},{'artifact_quote':'Invented quote'},{'matter_id':'unknown'},{'conflict_resolution':'confirm_source'}]:
            with self.subTest(changes=changes):
                result=calibrate_verdict({'passed':False,'defects':[{**defect,**changes}]},package,strategy)
                self.assertEqual(result['defects'][0]['owner'],'user')
        for disposition in ('core','hero'):
            result=calibrate_verdict({'passed':False,'defects':[defect]},package,{'matters':[{'matter_id':'m','disposition':disposition}]})
            self.assertEqual(result['defects'][0]['owner'],'user')
        self.assertEqual(package['matters'][0]['source_excerpt'],defect['source_quote'])

class DiagnosticGroundingTests(unittest.TestCase):
    def test_sector_deletion_cannot_target_a_word_already_absent(self):
        from core.review_graph import Defect
        from pydantic import ValidationError
        base={'code':'SOURCE_CONFLICT','severity':'warning','scope':'submission','matter_id':'m','message':'Withdraw industry descriptor.','conflict_resolution':'omit_nonessential_descriptor','field_path':'client_sector','artifact_quote':'The workforce has 17000 employees.'}
        for term in (None,'industrial','work'):
            with self.subTest(term=term),self.assertRaises(ValidationError):
                Defect.model_validate({**base,'conflicting_artifact_term':term})
        valid=Defect.model_validate({**base,'artifact_quote':'The industrial workforce has 17000 employees.','conflicting_artifact_term':'industrial'})
        self.assertEqual(valid.conflicting_artifact_term,'industrial')

    def test_invalid_diagnostic_is_not_a_token_limit_or_a_user_question(self):
        from utils.provider_errors import provider_failure
        failure=provider_failure(ValueError('review diagnostic not grounded'))
        self.assertEqual(failure['code'],'AI_REVIEW_INVALID')

    def test_optional_internal_strategy_note_is_never_a_user_editing_task(self):
        defect={'code':'SOURCE_CONFLICT','severity':'warning','scope':'strategy','matter_id':'m','field_path':'client_sector','conflict_resolution':'omit_nonessential_descriptor','conflicting_artifact_term':'industrial','artifact_quote':'Industrial workforce','message':'Remove industrial from generated strategy.'}
        result=calibrate_verdict({'passed':True,'defects':[defect]})['defects'][0]
        self.assertEqual(result['owner'],'rankpilot');self.assertFalse(result['retryable'])
        self.assertEqual(result['internal_diagnostic'],defect['message'])
