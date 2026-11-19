"""v1.0.112: the writer receives the rules the final judge enforces (review point 2).

Two judge findings recurred across real runs: a proposed individual category whose
own rationale concludes «Category pending», and an Audit that called a declared
position with no exact table match «verified». Synthetic names only.
"""
import unittest

from core.editorial_construction import reconcile_categories, PLAN_TASK
from core import audit_construction as ac


def candidate(label, rationale, recommendation='present'):
    return {'name': 'Ana Ejemplo', 'recommendation': recommendation, 'suggested_ranking': label,
            'category_rationale': rationale, 'category_missing_criterion': '',
            'recommended_action': 'Presentarlo como ' + label + '.',
            'category_assessment': {'decision': 'supported', 'criterion': 'up_and_coming_growth'}}


class CategoryDecisionIsOne(unittest.TestCase):
    def test_rationale_concluding_pending_wins_over_the_label(self):
        plan = {'candidates': [candidate('Up and Coming', 'Category pending. The evidence supports technical '
                'experience but does not establish the developing reputation needed for Up and Coming.')]}
        c = reconcile_categories(plan)['candidates'][0]
        self.assertEqual(c['suggested_ranking'], 'Category pending')
        self.assertEqual(c['category_assessment']['decision'], 'pending')
        self.assertIn('Up and Coming', c['category_missing_criterion'])
        self.assertIn('sin categoría', c['recommended_action'])
        self.assertEqual(c['recommendation'], 'present')

    def test_consistent_categories_are_unchanged(self):
        band = candidate('Band 4 candidate', 'Band 4 is an editorial target, not a prediction.')
        pending = candidate('Category pending', 'Category pending. No selected matter names this person.', 'develop')
        pending['category_missing_criterion'] = 'Falta evidencia propia.'
        plan = reconcile_categories({'candidates': [band, pending]})
        self.assertEqual(plan['candidates'][0]['suggested_ranking'], 'Band 4 candidate')
        self.assertEqual(plan['candidates'][0]['category_assessment']['decision'], 'supported')
        self.assertEqual(plan['candidates'][1]['category_missing_criterion'], 'Falta evidencia propia.')

    def test_writer_receives_the_rule(self):
        self.assertIn('ONE\ndecision', PLAN_TASK)
        self.assertIn('not growth evidence', PLAN_TASK)


class PositionIsNotVerifiedWithoutTheTable(unittest.TestCase):
    NOT_FOUND = {'status': 'not_found', 'declared_band': 'Unranked', 'message': 'No se encontró una coincidencia exacta.'}

    def test_unmatched_declaration_is_stated_as_declared(self):
        s = ac.position_statement({'current_band': 'Unranked'}, self.NOT_FOUND)
        self.assertEqual(s['kind'], 'declared')
        self.assertIn('Posición declarada por la firma: Unranked', s['text'])
        self.assertNotIn('verificad', s['text'])

    def test_official_observation_is_verified(self):
        s = ac.position_statement({}, {'status': 'verified_match', 'message': 'La posición declarada coincide.'})
        self.assertEqual(s['kind'], 'verified')

    def test_audit_wording_is_corrected_only_when_unverified(self):
        text = 'La posición verificada sigue siendo Unranked; la búsqueda no halló coincidencia.'
        self.assertEqual(ac.unverified_position_wording(text, self.NOT_FOUND),
                         'La posición declarada sigue siendo Unranked; la búsqueda no halló coincidencia.')
        self.assertEqual(ac.unverified_position_wording(text, {'status': 'verified_match'}), text)

    def test_writer_receives_the_rule(self):
        self.assertIn('position_statement', ac.TASK)
        self.assertIn('never "verified"', ac.TASK)


if __name__ == '__main__':
    unittest.main()
