"""Known answers from the Ramos v1.0.95 judge, checked before review."""
import unittest

from core.audit_construction import objective_line
from core.editorial_construction import headcount_faults

ONE = {'filing_details': {'num_partners': '1', 'num_lawyers': '9'}}


class HeadcountTests(unittest.TestCase):
    def test_the_only_partner_is_not_supported_by_another(self):
        value = {'b10': 'He works with a department comprising one partner and nine other lawyers.',
                 'c2': 'Ramos leads the practice as founding partner, supported by one partner and nine other lawyers.'}
        faults = headcount_faults(ONE, value)
        self.assertEqual(len(faults), 2)
        self.assertIn('exactly 1 partner and 9 other lawyers', faults[1])

    def test_correct_team_wording_and_the_verb_partners_pass(self):
        value = {'b10': 'Ramos leads a team of nine other lawyers. The firm partners with developers.', 'c2': ''}
        self.assertEqual(headcount_faults(ONE, value), [])

    def test_a_wrong_partner_figure_is_flagged_and_unknown_size_is_silent(self):
        four = {'filing_details': {'num_partners': '4', 'num_lawyers': '23'}}
        self.assertTrue(headcount_faults(four, {'b10': '', 'c2': 'Its 27 partners advise clients.'}))
        self.assertEqual(headcount_faults({}, {'b10': 'two partners', 'c2': ''}), [])


class SecondaryObjectiveTests(unittest.TestCase):
    package = {'objectives': {'primary': 'First-time ranking', 'secondary': 'Move up multiple bands/tiers'}, 'current_band': 'Not ranked'}

    def test_move_up_without_a_current_band_is_explained(self):
        line = objective_line(self.package, 'Recomendación: presentar.')
        self.assertIn('Objetivo secundario («Move up multiple bands/tiers»)', line)
        self.assertIn('todavía no aplica', line)

    def test_already_addressed_or_absent_objectives_add_nothing(self):
        self.assertEqual(objective_line(self.package, 'El objetivo secundario no aplica.'), '')
        self.assertEqual(objective_line({'objectives': {'secondary': None}}, ''), '')
        self.assertEqual(objective_line({**self.package, 'current_band': 'Band 3'}, ''), '')


if __name__ == '__main__':
    unittest.main()
