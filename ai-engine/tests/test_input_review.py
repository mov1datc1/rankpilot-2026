import unittest
from types import SimpleNamespace
from unittest.mock import patch
from agents.micro_optimizer import optimize_matter_micro
from core.review_graph import release_gate


class InputReviewTests(unittest.TestCase):
    def test_confirmed_value_reaches_writer_with_original_source(self):
        matter = {'client': 'Synthetic Client', 'rawNotes': 'Table USD 100; narrative MXN 5000.',
                  'value': 'MXN 5000', 'valueResolution': {'confirmed': True, 'value': 'MXN 5000',
                  'reason': 'Source A page 3 confirms the exposure in MXN.'}}
        with patch('agents.micro_optimizer.get_micro_model') as model:
            model.return_value.invoke.return_value = SimpleNamespace(content='The team advised Synthetic Client on a pending tax appeal.')
            result = optimize_matter_micro(matter)
            messages = model.return_value.invoke.call_args.args[0]
        self.assertTrue(result['success'])
        self.assertIn('USER-CONFIRMED VALUE RESOLUTION: MXN 5000', messages[1].content)
        self.assertIn(matter['rawNotes'], messages[1].content)
        self.assertIn(matter['valueResolution']['reason'], messages[1].content)

    def test_unconfirmed_resolution_is_not_presented_as_confirmed(self):
        with patch('agents.micro_optimizer.get_micro_model') as model:
            model.return_value.invoke.return_value = SimpleNamespace(content='The appeal remains pending.')
            optimize_matter_micro({'rawNotes': 'Source', 'value': 'USD 100', 'valueResolution': {'confirmed': False, 'value': 'USD 100', 'reason': 'Draft clarification'}})
            messages = model.return_value.invoke.call_args.args[0]
        self.assertNotIn('USER-CONFIRMED VALUE RESOLUTION:', messages[1].content)

    def test_changed_value_blocks_delivery_despite_positive_judge(self):
        result = release_gate({'judge': {'passed': True}, 'package': {'directory': 'Chambers', 'b10_source': 'Source', 'matters': [
            {'id': 'm1', 'value': 'USD 100', 'valueResolution': {'confirmed': True, 'value': 'MXN 5000', 'reason': 'Source A'}}]}})
        self.assertFalse(result['release_verdict']['passed'])
        self.assertIn('Value confirmation no longer matches: m1', result['release_verdict']['errors'])
