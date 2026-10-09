import unittest
from utils.doc_parser import DocumentParser
from utils.canonical_builder import reconcile_extracted_matters_to_source


class MonetarySourceContextTests(unittest.TestCase):
    def source(self, value, narrative):
        return f'Confidential Matter 1\nE1 Name of client\nSynthetic Client\nE2 Summary of matter\n{narrative}\nE3 Matter value\n{value}\nE4 Cross-border\nNo.'

    def test_literal_reader_preserves_equivalents_and_separate_concepts(self):
        for value,narrative in [
            ('USD 1000000','The facility was MXN 20 million, stated in the source as equivalent to USD 1000000.'),
            ('USD 1000000','The facility was USD 1000000. A separate claim involved MXN 4 million.'),
            ('USD 1000000','Claim exposure was MXN 20 million; settlement was MXN 3 million.'),
            ('$1000000','The separate project had a value of MXN 20 million.')]:
            fields=DocumentParser.extract_matter_fields(self.source(value,narrative))
            self.assertEqual(fields['matter_value'],value)
            self.assertEqual(fields['summary'],narrative)
            self.assertFalse(fields['value_conflict'])

    def test_semantically_identified_source_conflict_survives_reconciliation(self):
        source=self.source('USD 1000000','The same facility principal was MXN 1000000; the narrative expressly rejects the dollar denomination.')
        conflict='The table denominates the same principal in USD; the narrative expressly denominates it in MXN and rejects USD.'
        matters,report=reconcile_extracted_matters_to_source([
            {'source_label':'Confidential Matter 1','client':'Synthetic Client',
             'matter_value':'','value_conflict':conflict}],['Confidential Matter 1'],source)
        self.assertEqual(len(matters),1)
        self.assertEqual(matters[0]['value_conflict'],conflict)
        self.assertEqual(matters[0]['valueConflict'],conflict)
        self.assertIn('expressly rejects',matters[0]['source_excerpt'])
