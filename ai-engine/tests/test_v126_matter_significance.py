"""v1.0.126 (Ángela's Tax review): matters built around why they mattered. Synthetic names."""
import inspect
import unittest

from core import editorial_construction as ec
from core.editorial_development import MatterDraft

PACKAGE = {'matters': [
    {'id': 'm1', 'client': 'Alpha Air', 'completionDate': 'The audit closed with a Resolution determining an amount equal to 1% of the assessment.'},
    {'id': 'm2', 'client': 'Beta Foods', 'rawNotes': 'Ongoing advice on national taxes.'},
]}


class ResultIsTheCore(unittest.TestCase):
    def test_a_result_only_in_the_last_sentence_is_a_fault(self):
        text = ('We assisted Alpha Air in a tourism-tax audit. The audit concerned a special tax on service providers. '
                'The audit closed with a Resolution fixing 1% of the assessment.')
        faults = ec.matter_shape_faults(PACKAGE, [{'matter_id': 'm1', 'text': text}])
        self.assertTrue(any('only as the closing sentence' in f for f in faults), faults)

    def test_a_result_stated_early_passes(self):
        text = ('A tourism-tax audit of Alpha Air closed with a Resolution fixing 1% of the original assessment, reducing the '
                'exposure to a small fraction. Ana Ruiz designed the audit defence. The matter is ongoing.')
        self.assertEqual(ec.matter_shape_faults(PACKAGE, [{'matter_id': 'm1', 'text': text}]), [])

    def test_no_documented_result_never_faults_on_order(self):
        text = 'We advise Beta Foods on national taxes. The advice covers income tax. It also covers VAT returns.'
        self.assertEqual(ec.matter_shape_faults(PACKAGE, [{'matter_id': 'm2', 'text': text}]), [])

    def test_a_trailing_status_sentence_is_not_the_closing_sentence(self):
        text = ('We assisted Alpha Air in an audit. It concerned a special tax. '
                'The audit closed with a Resolution fixing 1% of the assessment. The matter is ongoing.')
        self.assertTrue(any('closing sentence' in f for f in ec.matter_shape_faults(PACKAGE, [{'matter_id': 'm1', 'text': text}])))


class TeamInsideTheWork(unittest.TestCase):
    def test_a_sentence_that_only_lists_the_team_is_a_fault(self):
        for line in ('The matter was led by Ana Ruiz and Bruno Soto.',
                     'Ana Ruiz is the lead partner, with Bruno Soto and Carla Ibarra on the team.',
                     'Ana Ruiz and Bruno Soto co-lead the matter, supported by Carla Ibarra.'):
            text = 'We advise Beta Foods on national taxes and related audits. ' + line
            faults = ec.matter_shape_faults(PACKAGE, [{'matter_id': 'm2', 'text': text}])
            self.assertTrue(any('only lists who led' in f for f in faults), (line, faults))

    def test_a_team_clause_inside_the_account_is_not_corrected(self):
        text = ('Ana Ruiz is the lead partner, with Bruno Soto on the team. We advise Beta Foods on national taxes '
                'and defend its audits before the tax authority.')
        self.assertEqual(ec.matter_shape_faults(PACKAGE, [{'matter_id': 'm2', 'text': text}]), [])

    def test_a_role_woven_into_the_work_passes(self):
        text = ('Ana Ruiz leads our advice to Beta Foods on national taxes, while Bruno Soto manages the transfer-pricing '
                'analysis of its cross-border transactions.')
        self.assertEqual(ec.matter_shape_faults(PACKAGE, [{'matter_id': 'm2', 'text': text}]), [])


class ValueAndInitials(unittest.TestCase):
    def test_the_value_size_is_never_restated(self):
        text = 'Ana Ruiz led the audit defence for Beta Foods. The confidential seven-figure amount at issue formed part of the context.'
        self.assertTrue(any('restates the matter value' in f for f in ec.matter_shape_faults(PACKAGE, [{'matter_id': 'm2', 'text': text}])))

    def test_an_initial_does_not_end_a_sentence(self):
        text = ('Under the leadership of Ana Ruiz, Senior Partner, Pedro I. Soto and Carla Ibarra negotiate settlements and '
                'defend claims before the labour courts for Beta Foods.')
        self.assertEqual(ec.matter_shape_faults(PACKAGE, [{'matter_id': 'm2', 'text': text}]), [])


class WriterReceivesTheShape(unittest.TestCase):
    def test_the_schema_field_carries_the_shape(self):
        description = MatterDraft.model_fields['text'].description
        for expected in ('why the mandate mattered', 'never its last sentence', 'never a separate sentence'):
            self.assertIn(expected, description)

    def test_the_check_runs_with_the_matter_checks(self):
        self.assertIn("matter_shape_faults(package,value['matters'])", inspect.getsource(ec))


if __name__ == '__main__':
    unittest.main()
