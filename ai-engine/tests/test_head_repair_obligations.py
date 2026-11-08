"""A department role must survive simultaneous BIO/proof repair and recovery."""
import copy
import unittest
from unittest.mock import patch

from core.editorial_execution import missing_head_bios
from core.editorial_repair import repair_targets, repair_development
from test_editorial_execution import linked_case
from test_surgical_repair_postconditions import native_answer


class HeadRepairObligationTests(unittest.TestCase):
    def fixture(self):
        package, strategy, proposal = linked_case()
        package['filing_details'] = {'heads': [{'name': 'Sofia Vega'}]}
        self.assertEqual(missing_head_bios(package, proposal), [0])
        proposal['candidates'][0]['submission_case_coverage'][0]['public_quote'] = 'Absent output reference.'
        return package, strategy, proposal

    def test_head_obligation_is_not_suppressed_by_another_candidate_defect(self):
        package, strategy, proposal = self.fixture()
        target = repair_targets(package, strategy, proposal)['candidates/0']
        self.assertIn('separately confirmed department-head', target['problem'])
        self.assertIn('Función departamental B9 ausente: Sofia Vega', target['validation_errors'])
        self.assertEqual(target['confirmed_head_function'], {'name': 'Sofia Vega', 'source_path': 'filing_details.heads'})

    def test_same_bio_keeps_voice_and_head_obligations(self):
        package, strategy, proposal = linked_case()
        package['filing_details'] = {'heads': [{'name': 'Sofia Vega'}]}
        proposal['candidates'][0]['submission_bio'] += ' The supplied biography confirms her experience.'
        target = repair_targets(package, strategy, proposal)['candidates/0/submission_bio']
        self.assertIn('Remove auditor commentary', target['problem'])
        self.assertIn('separately confirmed department-head', target['problem'])
        self.assertTrue(target['rejected_quotes'])

    def exercise(self, leave_binding=False, second_fails=False):
        package, strategy, proposal = self.fixture()
        before = copy.deepcopy((package, strategy, proposal))
        _, _, valid = linked_case()
        candidate = valid['candidates'][0]
        calls = []

        def invoke(state, role, schema, task, payload):
            calls.append(copy.deepcopy(payload))
            self.assertEqual(set(payload['repair_targets']), {'candidates/0'})
            target = payload['repair_targets']['candidates/0']
            self.assertIn('separately confirmed department-head', target['problem'])
            self.assertEqual(target['confirmed_head_function']['name'], 'Sofia Vega')
            value = copy.deepcopy(candidate)
            if len(calls) == 1 and leave_binding:
                value['submission_case_coverage'][0]['public_quote'] = 'Another absent output reference.'
            if len(calls) == 2 and not second_fails:
                value['submission_bio'] += ' Sofia heads the Labour & Employment department.'
            if target.get('mutable_fields'):
                value = {'submission_bio': value['submission_bio'], 'profile_coverage': None,
                         'submission_case_coverage': {'S01': value['submission_case_coverage'][0]['public_quote']}}
            answer = native_answer({'corrections': [{'path': 'candidates/0', 'value': value, 'reason': 'Repair only the documented profile.'}], 'unresolved': []}, payload['target_references'])
            schema.model_validate(answer)
            return answer, state.get('trace', []) + [{'usage': {'total_tokens': 17}}]

        with patch('core.review_graph.invoke_role', side_effect=invoke):
            result = repair_development({'package': package, 'strategy': strategy}, proposal, repair_targets(package, strategy, proposal))
        self.assertEqual(len(calls), 2)
        self.assertEqual((package, strategy, proposal), before)
        self.assertEqual(result['repair_report']['surgical_retries'], 1)
        self.assertEqual(sum(t['usage']['total_tokens'] for t in result['trace']), 34)
        self.assertNotIn('approved_artifact', result)
        return result

    def test_head_only_residual_gets_one_bio_recovery_after_parent_repair(self):
        result = self.exercise()
        self.assertTrue(result['development_validated'], result['errors'])

    def test_binding_recovery_does_not_erase_simultaneous_head_instruction(self):
        result = self.exercise(leave_binding=True)
        self.assertTrue(result['development_validated'], result['errors'])

    def test_second_omission_stops_without_a_third_call_or_false_approval(self):
        result = self.exercise(second_fails=True)
        self.assertFalse(result['development_validated'])
        self.assertIn('Función departamental B9 ausente: Sofia Vega', result['errors'])

    def test_unconfirmed_head_is_never_inferred(self):
        package, strategy, proposal = self.fixture()
        package['filing_details']['heads'] = [{'name': 'Another Lawyer'}]
        target = repair_targets(package, strategy, proposal)['candidates/0']
        self.assertNotIn('confirmed_head_function', target)
        self.assertNotIn('separately confirmed department-head', target['problem'])
