import unittest
from unittest.mock import patch
from utils.literal_source import table_text_view
from core.review_graph import selection_gate, select_or_reuse
from core.editorial_development import bind_quote

class TableLiteralSourceTests(unittest.TestCase):
    def state(self, source, quote):
        return {'package':{'matters':[{'id':'new-matter','client':'New Client','rawNotes':source}]},'strategy':{'hero_matter_id':'new-matter','thesis':'Source-backed tax advice','pending_questions':[], 'matters':[{'matter_id':'new-matter','disposition':'core','rationale':'Tax advice','source_quote':quote,'legal_understanding':'Pending tax appeal.'}]}}

    def test_line_borders_are_format_not_missing_words(self):
        source='| The team advised on tax treaties |\n| and a pending appeal.            |'
        quote='The team advised on tax treaties and a pending appeal.'
        state=self.state(source,quote)
        self.assertTrue(selection_gate(state)['selection_validated'])
        bound=bind_quote(quote,state['package']['matters'][0])
        self.assertIn(bound,source)
        self.assertIn('|',bound)
        self.assertEqual(len(table_text_view(source)),len(source))
        self.assertEqual(state['package']['matters'][0]['rawNotes'],source)

    def test_only_borders_not_interior_operators_numbers_or_negation(self):
        for source,quote in [('A | B requires advice.','A B requires advice.'),('The claim is not resolved. |','The claim is resolved.'),('The claim totals 100. |','The claim totals 1000.'),('A dispute. |\nD3 Value |\n100 dollars |','A dispute. 100 dollars')]:
            with self.subTest(source=source):
                self.assertFalse(selection_gate(self.state(source,quote))['selection_validated'])
                self.assertIsNone(bind_quote(quote,{'rawNotes':source}))

    def test_saved_proposal_reuses_selector_without_new_model_call(self):
        state=self.state('The team advised |\non tax treaties. |','The team advised on tax treaties.')
        state['selection_feedback']={'strategy':state['strategy'],'semantic_rejection':False}
        with patch('core.review_graph.invoke_role',side_effect=AssertionError('Must not pay again')):
            result=select_or_reuse(state)
        self.assertTrue(result['selection_validated'])
        self.assertNotIn('selection_review_validated',result)
