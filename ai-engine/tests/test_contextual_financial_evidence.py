import unittest
from core.contextual_financial_evidence import amounts, missing_contextual_amounts


class ContextualFinancialEvidenceTests(unittest.TestCase):
    def matter(self,text,route='E'):
        return {'publication_route':route,'rawNotes':text}

    def test_project_costs_and_exposure_are_retained_without_currency_conversion(self):
        m=self.matter('The pipeline project was valued at USD 2 billion and USD 2,500,000,000 for a separate development.\nThe claim exposure was MXN 5.5 million.')
        self.assertEqual(missing_contextual_amounts(m,'Projects valued at US$2bn and USD2.5 billion; separate claim exposure MXN5,500,000.'),set())
        self.assertTrue(missing_contextual_amounts(m,'The projects were large. Exposure was MXN5.5 million.'))

    def test_matter_value_header_alone_does_not_force_an_unknown_figure_into_prose(self):
        m=self.matter('Matter value: USD 99,000,000\nThe firm prepared inspections and reviewed documentation.')
        self.assertEqual(missing_contextual_amounts(m,'The firm prepared inspections.'),set())

    def test_public_route_does_not_require_disclosing_source_metrics(self):
        m=self.matter('Confidential project cost USD 2 billion.','D')
        self.assertEqual(missing_contextual_amounts(m,'The firm advised on an infrastructure project.'),set())

    def test_original_currency_and_distinct_claim_amounts_remain_independent(self):
        m=self.matter('The claim exposure was MXN 8 million and settlement was MXN 200,000.')
        self.assertTrue(missing_contextual_amounts(m,'The claim was USD8 million and settlement USD200,000.'))
        self.assertEqual(missing_contextual_amounts(m,'Claim exposure MXN8m; settlement MXN200000.'),set())

    def test_numeric_equivalence_is_not_a_certification_of_economic_meaning(self):
        self.assertEqual(amounts('USD 2 billion'),amounts('USD 2,000,000,000'))
        self.assertNotEqual(amounts('USD 2 billion'),amounts('MXN 2 billion'))

    def test_unsupported_grouping_is_not_partially_read_as_a_different_amount(self):
        self.assertEqual(amounts('EUR 1.234.567'),set())
        self.assertEqual(amounts('USD 2,50'),set())
        self.assertEqual(amounts('NOTUSD2 billion'),set())

    def test_source_and_prose_are_not_mutated(self):
        m=self.matter('The project cost USD 10 million.');before=dict(m)
        missing_contextual_amounts(m,'The firm managed a project.')
        self.assertEqual(m,before)
