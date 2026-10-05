import unittest
from utils.source_confidentiality import client_register, reconcile
from utils.doc_parser import DocumentParser

class SourceConfidentialityTests(unittest.TestCase):
    def register(self, rows):
        return client_register('Company | Sector | New Client (Y/N) | Confidential (Y/N) | Type of Work\n'+rows+'\nMATTER NUMBER 1\n')
    def test_blank_matter_inherits_explicit_client_confidentiality_with_evidence(self):
        entries=self.register('Synthetic Alpha | Tax | N | Y | Advice')
        status,evidence=reconcile('Synthetic Alpha','confirmation_required',entries,'MATTER NUMBER 1')
        self.assertEqual(status,'confidential');self.assertEqual(evidence['client_register'][0]['line'],2)
        self.assertEqual(evidence['basis'],'client_register')
    def test_new_client_flag_never_becomes_confidentiality(self):
        entries=self.register('Synthetic Alpha | Tax | Y | N | Advice')
        self.assertEqual(reconcile('Synthetic Alpha','confirmation_required',entries,'Matter 1')[0],'confirmation_required')
    def test_blank_missing_and_similar_names_stay_pending(self):
        entries=self.register('Synthetic Alpha | Tax | Y | Y | Advice\nSynthetic Beta | Tax | Y | | Advice')
        for name in ['Alpha','Synthetic Alpha Holdings','Synthetic Beta','Unknown']:
            self.assertEqual(reconcile(name,'confirmation_required',entries,'Matter 1')[0],'confirmation_required')
    def test_legal_suffix_is_matched_but_distinct_entities_are_not_merged(self):
        entries=self.register('Synthetic Alpha | Tax | N | Y | Advice')
        status,evidence=reconcile('Synthetic Alpha, S.A. de C.V.','confirmation_required',entries,'Matter 1')
        self.assertEqual(status,'confidential');self.assertEqual(evidence['match_method'],'legal_suffix')
        entries+=self.register('Synthetic Alpha S.A. de C.V. | Tax | N | Y | Advice')
        self.assertEqual(reconcile('Synthetic Alpha S.A.P.I. de C.V.','confirmation_required',entries,'Matter 1')[0],'confirmation_required')
    def test_conflicting_rows_or_matter_permission_require_review(self):
        entries=self.register('Synthetic Alpha | Tax | N | Y | Advice\nSynthetic Alpha | Tax | N | N | Advice')
        status,evidence=reconcile('Synthetic Alpha','confirmation_required',entries,'Matter 1')
        self.assertEqual(status,'confirmation_required');self.assertTrue(evidence['requires_review'])
        self.assertEqual(reconcile('Synthetic Alpha','publishable',entries[:1],'Matter 1')[0],'confirmation_required')
    def test_narrative_table_is_not_a_register(self):
        text='MATTER NUMBER 1\nCompany | Confidential (Y/N)\nSynthetic Alpha | Y'
        self.assertEqual(client_register(text),[])
    def test_numbered_sections_keep_original_heading_and_apply_register(self):
        text='Company | Confidential (Y/N)\nSynthetic Alpha | Y\nMATTER NUMBER 1\nConfidential (Y/N):\nClient: Synthetic Alpha\nMatter’s Context:\nThe team advised on a pending tax appeal.'
        section=list(DocumentParser.extract_numbered_matter_sections(text).values())[0]
        self.assertEqual(section['confidentiality_status'],'confidential')
        self.assertEqual(section['source_heading'],'MATTER NUMBER 1')
