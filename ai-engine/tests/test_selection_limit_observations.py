"""v1.0.98: exhausted selection review with only internal wording findings continues.

DeForest 18-11 (job 357ce8ac): three paid reviews flagged a different rationale
nuance each round and the case stopped. The disposition, hero and portfolio were
never disputed. Without any provider call, those bound findings become Audit
observations; every other kind of finding still stops.
"""
import asyncio
import copy
import json
import os
import unittest
from unittest.mock import AsyncMock, patch

os.environ.setdefault('OPENAI_API_KEY', 'offline-test-key')

from core import review_graph
from core.selection_review import accept_with_observations, SELECTION_OBSERVATION_CONTRACT

STRATEGY = {'thesis': 't', 'hero_matter_id': 'a', 'matters': [
    {'matter_id': 'a', 'disposition': 'core', 'rationale': 'r', 'legal_understanding': 'l', 'source_quote': 'q'},
    {'matter_id': 'b', 'disposition': 'core', 'rationale': 'adds corporate-reorganisation capability', 'legal_understanding': 'l', 'source_quote': 'q'}]}


def finding(kind='source', **extra):
    return {'status': 'repair_required', 'evidence_bound': True, 'field_paths': ['rationale', 'legal_understanding'],
            'correction_dispositions': [], 'evidence_kind': kind, 'rule_id': None, 'rule_quote': '',
            'explanation': 'Corríjase únicamente esa premisa incremental.', 'source_quote': 's', 'decision_quote': 'd', **extra}


def exhausted(**delta):
    failed = {'a': finding('source'), 'b': finding('portfolio_comparison', comparison_matter_id='a')}
    state = {'package': {'matters': [{'id': 'a'}, {'id': 'b'}]}, 'strategy': copy.deepcopy(STRATEGY),
             'selection_review_attempts': 3, 'selection_repair_attempts': 2, 'selection_validated': False,
             'selection_review_validated': False, 'selection_diagnostic_invalid': False,
             'selection_review_unavailable': False, 'selection_review_deferred': False,
             'selection_failure_history': [['x'], ['a', 'b'], ['a', 'b']],
             'selection_advisories': [{'matter_id': 'z', 'explanation': 'earlier advisory'}],
             'trace': [{'role': 'selection_reviewer', 'usage': {'total_tokens': 61680}}],
             'selection_feedback': {'strategy': copy.deepcopy(STRATEGY), 'semantic_rejection': True, 'field_only': True,
                                    'failed_checks': failed, 'pending_diagnostics': {}, 'errors': ['Revisar...']}}
    state.update(delta)
    return state


GATE_OK = patch('core.review_graph.selection_gate', return_value={'selection_validated': True, 'errors': []})


class AcceptanceRules(unittest.TestCase):
    def test_wording_only_findings_become_audit_observations(self):
        with GATE_OK:
            accepted = accept_with_observations(exhausted())
        self.assertTrue(accepted['selection_validated'] and accepted['selection_review_validated'])
        self.assertEqual(accepted['errors'], [])
        self.assertEqual(accepted['selection_observations']['contract'], SELECTION_OBSERVATION_CONTRACT)
        self.assertEqual(accepted['selection_observations']['matter_ids'], ['a', 'b'])
        origins = [a.get('origin') for a in accepted['selection_advisories']]
        self.assertEqual(origins, [None, 'selection_review_limit', 'selection_review_limit'])

    def test_everything_else_still_stops(self):
        failed = exhausted()['selection_feedback']['failed_checks']
        cases = {
            'disposition': {'a': finding(correction_dispositions=['reserve'])},
            'confidential rule': {'a': finding('application_rule')},
            'unbound': {'a': finding(evidence_bound=False)},
            'no field': {'a': finding(field_paths=[])},
        }
        for name, checks in cases.items():
            state = exhausted()
            state['selection_feedback']['failed_checks'] = {**failed, **checks}
            with self.subTest(name), GATE_OK:
                self.assertIsNone(accept_with_observations(state))
        for name, delta in {
            'repair still available': {'selection_review_attempts': 1, 'selection_repair_attempts': 1, 'selection_failure_history': [['a', 'b']]},
            'unknown usage': {'trace': [{'usage': {'unknown_calls': 1}}]},
            'invalid diagnostic': {'selection_diagnostic_invalid': True},
            'strategy changed since review': {'strategy': {**STRATEGY, 'thesis': 'changed'}},
        }.items():
            with self.subTest(name), GATE_OK:
                self.assertIsNone(accept_with_observations(exhausted(**delta)))
        state = exhausted()
        state['selection_feedback']['pending_diagnostics'] = {'c': {}}
        with GATE_OK:
            self.assertIsNone(accept_with_observations(state))
        with patch('core.review_graph.selection_gate', return_value={'selection_validated': False, 'errors': ['x']}):
            self.assertIsNone(accept_with_observations(exhausted()))


class GraphPath(unittest.TestCase):
    def test_saved_rejection_continues_without_any_provider_call(self):
        state = exhausted()
        with GATE_OK, patch('core.review_graph.invoke_role', side_effect=AssertionError('no paid call')), \
                patch('core.selection_review.review_selection', side_effect=AssertionError('no review')):
            chosen = review_graph.select_or_reuse(state)
            self.assertEqual(chosen, {'strategy': state['strategy'], 'errors': []})
            reviewed = review_graph.selection_review({**state, **chosen})
        self.assertEqual(reviewed['errors'], [])
        self.assertTrue(reviewed['selection_review_validated'])
        self.assertEqual(reviewed['selection_review_attempts'], 3)

    def test_last_paid_review_with_wording_findings_continues(self):
        state = exhausted(selection_review_attempts=2, selection_feedback={'strategy': {}, 'semantic_rejection': False})
        verdict = {k: v for k, v in exhausted().items() if k.startswith('selection_') or k == 'errors'}
        verdict.update(errors=['Revisar...'], selection_review_attempts=3, selection_validated=False, selection_review_validated=False)
        with GATE_OK, patch('core.selection_review.review_selection', return_value=verdict):
            reviewed = review_graph.selection_review(state)
        self.assertEqual(reviewed['errors'], [])
        self.assertTrue(reviewed['selection_validated'])
        self.assertEqual(reviewed['selection_review_attempts'], 3)


class ScopePreflight(unittest.TestCase):
    def test_declared_scope_is_returned_before_any_model_call(self):
        from main import extract_document_endpoint
        text = 'Chambers\nA1 Firm name\nEnergy & Natural Resources\nA2 Practice Area\nEnergy & Natural Resources\nA3 Location (Jurisdiction)\nMexico\n'
        payload = {'sources': [{'name': 'template.docx', 'text': text}, {'name': 'matters.docx', 'text': 'PROFEPA inspection defence.'}],
                   'context': {'scope_preflight': True, 'modality': 'scratch'}}
        with patch('main._extract_readable_source', side_effect=AssertionError('paid extraction')):
            response = asyncio.run(extract_document_endpoint(type('Request', (), {'json': AsyncMock(return_value=payload)})()))
        data = json.loads(response.body)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['scope_preflight'])
        self.assertEqual(data['source_reports'][0]['source_scope']['practice_area']['value'], 'Energy & Natural Resources')
        self.assertEqual(data['source_reports'][1]['source_scope'], {})


if __name__ == '__main__':
    unittest.main()
