"""A literal source cannot justify a finding about a nonexistent draft claim."""
import copy
import unittest
from unittest.mock import patch
from core.selection_review import review_selection, can_repair_selection
from core.review_graph import create_review_graph

SOURCE = 'The firm implemented employment agreements and workplace regulations.'
DECISION = {'matter_id': 'm1', 'disposition': 'core',
            'rationale': 'No concrete deliverables are documented.',
            'legal_understanding': 'Employment compliance mandate.', 'source_quote': SOURCE}
PACKAGE = {'matters': [{'id': 'm1', 'client': 'Fictional Employer', 'source_excerpt': SOURCE,
                        'publish_status': 'confidential', 'confidentialityConfirmed': True}]}
STRATEGY = {'matters': [DECISION], 'hero_matter_id': 'm1', 'thesis': 'Employment', 'pending_questions': []}


def check(quote):
    return {'checks': {'M01': {'status': 'repair_required',
            'explanation': 'The source explicitly documents implemented deliverables.',
            'source_quote': SOURCE, 'decision_quote': quote}}}


class SelectionDecisionEvidenceTests(unittest.TestCase):
    def test_grounded_source_and_exact_false_premise_allow_bounded_repair(self):
        state = {'package': PACKAGE, 'strategy': STRATEGY}
        before = copy.deepcopy(state)
        result = review_selection(state, lambda *args: (check(DECISION['rationale']), []))
        self.assertTrue(can_repair_selection(result))
        self.assertFalse(result['selection_review_validated'])
        self.assertFalse(result['selection_review_unavailable'])
        self.assertEqual(state, before)

    def test_translated_absent_or_foreign_decision_quotes_cannot_buy_a_repair(self):
        for quote in ('', 'No hay entregables concretos.', 'Another mandate was won.'):
            with self.subTest(quote=quote):
                trace = [{'usage': {'total_tokens': 123}}]
                result = review_selection({'package': PACKAGE, 'strategy': STRATEGY}, lambda *args: (check(quote), trace))
                self.assertFalse(result['selection_review_validated'])
                self.assertTrue(result['selection_review_unavailable'])
                self.assertFalse(can_repair_selection(result))
                self.assertEqual(result['trace'], trace)
                self.assertEqual(result['selection_review_attempts'], 1)

    def test_a_peer_decision_is_not_evidence_against_this_matter(self):
        peer = {**PACKAGE['matters'][0], 'id': 'm2'}
        strategy = {**STRATEGY, 'matters': [DECISION, {**DECISION, 'matter_id': 'm2',
                    'rationale': 'Another mandate was won.', 'disposition': 'reserve'}]}
        verdict = check('Another mandate was won.')
        verdict['checks']['M02'] = {'status': 'supported', 'explanation': 'Supported.', 'source_quote': ''}
        result = review_selection({'package': {'matters': [PACKAGE['matters'][0], peer]},
                                   'strategy': strategy}, lambda *args: (verdict, []))
        self.assertTrue(result['selection_review_unavailable'])
        self.assertFalse(can_repair_selection(result))

    def test_invalid_diagnosis_stops_without_redrafting_or_approving(self):
        calls = []
        def invoke(state, role, *args):
            calls.append(role)
            return check('Invented draft claim.'), []
        with patch('core.review_graph.strategist', return_value={'strategy': STRATEGY, 'errors': []}), \
             patch('core.review_graph.invoke_role', side_effect=invoke), \
             patch('core.review_graph.develop') as develop:
            result = create_review_graph().invoke({'package': PACKAGE, 'operation': 'strategy'})
        self.assertEqual(calls, ['selection_reviewer'])
        develop.assert_not_called()
        self.assertFalse(result['selection_review_validated'])
