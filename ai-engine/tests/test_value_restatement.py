import unittest

from core.editorial_development import bind_development, drop_value_restatement


class ValueRestatementTest(unittest.TestCase):
    """v1.0.100: E3 prints the matter value; the narrative must not repeat it in registry voice."""

    def test_standalone_value_sentence_is_removed_and_concepts_stay(self):
        self.assertEqual(drop_value_restatement('Inspections concluded without fines. The matter is recorded with a value of US$104,000,000.45. Ana leads the matter.'),
                         'Inspections concluded without fines. Ana leads the matter.')
        self.assertEqual(drop_value_restatement('It negotiated. The matter’s stated value is approximately US$675,000. Ana leads.'), 'It negotiated. Ana leads.')
        for kept in ('The labour-litigation value is approximately USD 252,000.',
                     'The proceedings involved financial exposure of approximately MXN 3 million.',
                     'The matter is recorded at US$553,278.59 and reflects a nationwide portfolio.'):
            self.assertEqual(drop_value_restatement(kept), kept)

    def test_construction_applies_it_only_when_e3_carries_a_value(self):
        text = 'DeForest manages the portfolio. The matter is recorded at US$553,278.59. The matter is ongoing.'
        package = {'matters': [{'id': 'm1', 'value': 'US$ 553,278.59'}, {'id': 'm2', 'value': ''}]}
        proposal = {'matters': [{'matter_id': 'm1', 'text': text, 'decisive_source_quotes': []},
                                {'matter_id': 'm2', 'text': text, 'decisive_source_quotes': []}]}
        bound = bind_development(package, proposal)
        self.assertEqual(bound['matters'][0]['text'], 'DeForest manages the portfolio. The matter is ongoing.')
        self.assertEqual(bound['matters'][1]['text'], text)


if __name__ == '__main__':
    unittest.main()
