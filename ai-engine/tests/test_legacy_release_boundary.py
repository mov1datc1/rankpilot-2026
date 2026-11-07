"""Old service entry points cannot label failed validation as a final report."""
import copy
import unittest
from main import _assert_release_approved

CHECKS=('source_validation','evidence_reconciliation','artifact_validation','constitutional_validation','release_verdict')

class LegacyReleaseBoundaryTests(unittest.TestCase):
    def complete(self):
        return {'is_complete':True,'pdf_url':'synthetic-report.pdf',**{k:{'passed':True} for k in CHECKS}}

    def test_completed_result_requires_each_positive_gate(self):
        for key in CHECKS:
            for value in ({},{'passed':False},None,'missing'):
                with self.subTest(key=key,value=value):
                    result=self.complete()
                    if value=='missing':result.pop(key)
                    else:result[key]=value
                    with self.assertRaisesRegex(ValueError,'RELEASE_REJECTED'):_assert_release_approved(result)

    def test_an_artifact_rollback_blocks_even_with_positive_booleans(self):
        result=self.complete();result['artifact_validation']['matter_rollbacks']=[{'matter_id':'fictional'}]
        with self.assertRaisesRegex(ValueError,'matter_rollbacks'):_assert_release_approved(result)

    def test_positive_legacy_result_remains_unchanged(self):
        result=self.complete();before=copy.deepcopy(result)
        _assert_release_approved(result);self.assertEqual(result,before)

    def test_pending_source_interrogation_remains_a_draft_without_fabricated_approval(self):
        result={'is_complete':False,'interrogation_questions':['Confirm a genuine source fact.'],'release_verdict':{'passed':False}}
        before=copy.deepcopy(result);_assert_release_approved(result);self.assertEqual(result,before)

    def test_a_pdf_cannot_bypass_validation_by_clearing_the_complete_flag(self):
        for result in ({'is_complete':False,'pdf_url':'synthetic-report.pdf'},
                       {'is_complete':1},{'is_complete':'true'}):
            with self.subTest(result=result),self.assertRaisesRegex(ValueError,'RELEASE_REJECTED'):
                _assert_release_approved(result)
