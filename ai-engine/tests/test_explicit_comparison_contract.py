import copy
import unittest
import test_selection_comparison_evidence as comparison_fixtures
from core.selection_review import review_selection, repair_selection, can_repair_selection


class ExplicitComparisonContractTests(unittest.TestCase):
    fixture = comparison_fixtures.ComparisonEvidenceTests.fixture
    def test_explicit_comparisons_do_not_depend_on_a_keyword_dictionary(self):
        for premise in (
            'Adds a complementary collective-labour capability to the portfolio.',
            'Reinforces the existing collective-labour capability of the portfolio.',
            'The mandate contributes alongside the existing union litigation.',
            'Aporta una capacidad complementaria al portafolio laboral.',
        ):
            with self.subTest(premise=premise):
                state, verdict = self.fixture()
                state['strategy']['matters'][0]['rationale'] = premise
                verdict['checks']['M01']['decision_quote'] = premise
                result = review_selection(state, lambda *args: (verdict, []))
                self.assertFalse(result['selection_diagnostic_invalid'])
                self.assertFalse(result['selection_validated'])
                self.assertTrue(can_repair_selection(result))
                self.assertEqual(result['selection_review']['checks']['a']['comparison_matter_id'], 'b')

    def test_bound_comparison_enters_targeted_repair_then_requires_independent_review(self):
        state, verdict = self.fixture()
        premise = 'Adds a complementary collective-labour capability to the portfolio.'
        state['strategy']['matters'][0]['rationale'] = premise
        verdict['checks']['M01']['decision_quote'] = premise
        initial = copy.deepcopy(state)
        review = review_selection(state, lambda *args: (verdict, []))
        self.assertTrue(can_repair_selection(review))
        def repair(s, role, schema, instruction, payload):
            self.assertEqual([m['id'] for m in payload['sources']], ['a'])
            self.assertEqual([m['id'] for m in payload['comparison_sources']], ['b'])
            fixed = {**initial['strategy']['matters'][0], 'rationale': 'Documents a strike-prevention result alongside the existing union litigation.'}
            return {'core_corrections': [fixed], 'other_corrections': [], 'unresolved': []}, []
        fixed = repair_selection({**state, **review}, repair)
        self.assertEqual(fixed['strategy']['matters'][1], initial['strategy']['matters'][1])
        self.assertEqual(fixed['strategy']['hero_matter_id'], initial['strategy']['hero_matter_id'])
        self.assertNotIn('selection_validated', fixed)
        self.assertEqual(state, initial)
        calls = []
        def recheck(*args):
            calls.append(1)
            return {'checks': {'M01': {'status': 'supported', 'explanation': 'The corrected decision preserves the evidenced contribution.', 'source_quote': ''}}}, []
        final = review_selection({**state, **review, **fixed}, recheck)
        self.assertEqual(len(calls), 1)
        self.assertTrue(final['selection_validated'])

    def test_explicit_comparison_cannot_bind_only_a_disposition_or_an_invented_quote(self):
        for quote in ('core', 'A reconstructed comparative claim.'):
            state, verdict = self.fixture()
            verdict['checks']['M01']['decision_quote'] = quote
            result = review_selection(state, lambda *args: (verdict, []))
            self.assertTrue(result['selection_diagnostic_invalid'])
            self.assertFalse(can_repair_selection(result))

    def test_prose_diagnosis_cannot_demote_or_promote_even_with_spare_capacity(self):
        for current, attempted in (('core', 'reserve'), ('reserve', 'core')):
            with self.subTest(current=current):
                state, verdict = self.fixture()
                state['strategy']['matters'][0]['disposition'] = current
                review = review_selection(state, lambda *args: (verdict, []))
                def invoke(s, role, schema, instruction, payload):
                    self.assertEqual(payload['allowed_dispositions']['a'], [current])
                    changed = {**state['strategy']['matters'][0], 'disposition': attempted}
                    return {'core_corrections': [changed] if attempted == 'core' else [],
                            'other_corrections': [changed] if attempted != 'core' else [], 'unresolved': []}, []
                if attempted == 'core':
                    from pydantic import ValidationError
                    with self.assertRaises(ValidationError):
                        repair_selection({**state, **review}, invoke)
                else:
                    result = repair_selection({**state, **review}, invoke)
                    self.assertFalse(result['selection_validated'])
                    self.assertEqual(result['strategy'], state['strategy'])
