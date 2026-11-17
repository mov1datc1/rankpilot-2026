"""Offline contracts for the constructed Audit: real orchestration, simulated provider.

These tests prove coverage, payload scope, bounded repair and retention of paid
work. They make no claim about the editorial quality of a real generation.
"""
import copy
import enum
import json
import time
import typing
import unittest
from openai.lib._pydantic import to_strict_json_schema
from pydantic import BaseModel
from utils.schema_limits import bounded_reference_schema
from core import audit_construction as audit
from core.audit_decisions import decision_heading
from core.editorial_case import prepare_case, obligations
from core.editorial_construction import VERSION as CONSTRUCTION
from test_biography_depth import depth_case


def fill(annotation, text='Texto sintético de la prueba local.'):
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return {name: fill(field.annotation, text) for name, field in annotation.model_fields.items()}
    if isinstance(annotation, type) and issubclass(annotation, enum.Enum):
        return next(iter(annotation)).value
    origin = typing.get_origin(annotation)
    if origin is typing.Literal:
        return typing.get_args(annotation)[0]
    if origin in (list, typing.List):
        return []
    if origin is typing.Union or str(origin) == "<class 'types.UnionType'>":
        return None
    return text


class Provider:
    """Answers every schema generically; individual checks can be failed once."""
    def __init__(self, fail=(), fail_times=1, slot_text=None, raise_on=None):
        self.calls, self.fail, self.left = [], set(fail), fail_times
        self.slot_text, self.raise_on = slot_text or {}, raise_on

    def __call__(self, state, role, schema, instruction, payload):
        bounded_reference_schema(to_strict_json_schema(schema))
        self.calls.append((role, schema.__name__, copy.deepcopy(payload), instruction))
        trace = state.get('trace', []) + [{'role': role, 'provider_request_id': 'offline-' + str(len(self.calls)),
                 'usage': {'input_tokens': 0, 'output_tokens': 0, 'total_tokens': 0}}]
        if self.raise_on == role:
            error = RuntimeError('provider outcome unknown')
            error.trace = {'role': role, 'usage': {'unknown_calls': 1}, 'usage_status': 'unknown'}
            error.trace_history = state.get('trace', []) + [error.trace]
            raise error
        value = fill(schema, 'Texto corregido de la prueba local.' if schema.__name__ == 'AuditSlotRepair' else 'Texto sintético de la prueba local.')
        if schema.__name__ == 'ConstructedAudit':
            for path, text in self.slot_text.items():
                audit._set(value, path, text)
        if schema.__name__ == 'SourceFieldVerdict' and self.fail and self.left > 0:
            for key in value['checks']:
                if key in self.fail:
                    value['checks'][key].update(status='failed', failure_kind='omission', reason='Omite el resultado documentado.')
            self.left -= 1
        return value, trace

    def roles(self):
        return [(role, name) for role, name, _, _ in self.calls]


class AuditConstructionTests(unittest.TestCase):
    def fixture(self, leader=False):
        package, strategy, proposal = depth_case()
        if leader:
            package['matters'][3] = {**package['matters'][3], 'leadPartner': 'Edgar Moro', 'lead_partner': 'Edgar Moro'}
        state = {'package': package, 'strategy': strategy}
        state.update(prepare_case(state))
        proposal = {**proposal, 'construction_contract': CONSTRUCTION}
        if leader:
            proposal['case_plan'] = {**proposal['case_plan'], 'additional_leaders': [{'name': 'Edgar Moro', 'matter_ids': ['m4'],
                'decision': 'Do not nominate in this filing.', 'remaining_action': 'A biography would change this.'}]}
        return {**state, 'development': proposal}

    def test_contract_is_owned_by_new_cases_and_can_be_switched_off(self):
        state = self.fixture()
        self.assertTrue(audit.active(state))
        self.assertFalse(audit.active({**state, 'case_requirements': {k: v for k, v in state['case_requirements'].items() if k != 'audit_contract'}}))
        self.assertFalse(audit.active({**state, 'development': {**state['development'], 'construction_contract': None}}))

    def test_writer_receives_decisions_and_anchors_not_the_register(self):
        state = self.fixture()
        provider = Provider()
        result = audit.write(state, provider)
        role, schema, payload, _ = provider.calls[0]
        self.assertEqual((role, schema), ('writer', 'ConstructedAudit'))
        self.assertNotIn('package', payload)
        for entry in payload['matter_register']:
            self.assertFalse({'source_excerpt', 'rawNotes', 'summary'} & set(entry))
            source = next(m for m in state['package']['matters'] if m['id'] == entry['id'])
            narrative = ' '.join(str(source.get(k) or '') for k in ('source_excerpt', 'rawNotes', 'summary', 'otherInfo'))
            for anchor in entry['anchors']:
                self.assertIn(' '.join(anchor.split())[:40], ' '.join(narrative.split()))
        self.assertTrue(result['writer_validated'], result['errors'])

    def test_every_enforced_audit_obligation_is_a_rendered_slot(self):
        state = self.fixture()
        result = audit.write(state, Provider())
        letter, plan = result['letter'], audit.slots(state)
        candidate = state['development']['candidates'][0]
        self.assertIn(decision_heading(candidate), letter['leadership'])
        expected = [o['id'] for o in obligations(state['package'], state['strategy'], state['development'])
                    if o['id'].startswith('personal_audit:')]
        owned = [item['obligation_id'] for person in plan['people'] for item in person['contributions'].values()]
        self.assertEqual(owned, expected)
        self.assertEqual(letter['leadership'].count('\n' + audit.LINE), len(expected))
        core = [d['matter_id'] for d in state['strategy']['matters'] if d['disposition'] == 'core']
        numbered = [line for line in letter['portfolio'].splitlines()]
        self.assertEqual([line.split('.')[0] for line in numbered], [str(i + 1) for i in range(len(core))])
        self.assertIn(audit.RESERVE_HEADING, letter['evidence_gaps'])
        self.assertTrue(all(isinstance(letter[k], str) for k in ('executive_assessment', 'portfolio', 'leadership', 'evidence_gaps', 'next_steps')))

    def test_review_covers_every_audit_obligation_once_and_signs_only_met_units(self):
        state = self.fixture()
        provider = Provider()
        result = audit.write(state, provider)
        self.assertEqual(provider.roles(), [('writer', 'ConstructedAudit'), ('field_reviewer', 'SourceFieldVerdict')])
        reviewed = set(provider.calls[1][2]['units'][i]['obligations'][j]['id']
                       for i in range(len(provider.calls[1][2]['units']))
                       for j in range(len(provider.calls[1][2]['units'][i]['obligations'])))
        wanted = {o['id'] for o in obligations(state['package'], state['strategy'], state['development']) if o['output_scope'] == 'audit'}
        self.assertEqual(reviewed, wanted)
        report = result['audit_review']
        self.assertEqual(report['status'], 'reviewed')
        self.assertEqual({r['field'] for r in report['receipts']}, {'leadership#L01', 'evidence_gaps', 'executive_assessment'})
        self.assertEqual(report['observations'], [])
        # Review evidence is anchors and current B9 passages, not source narratives.
        self.assertNotIn('rawNotes', json.dumps(provider.calls[1][2]))

    def test_failed_slot_is_repaired_once_and_only_its_unit_is_rechecked(self):
        state = self.fixture()
        provider = Provider(fail={'personal_audit:0:1'})
        result = audit.write(state, provider)
        self.assertEqual(provider.roles(), [('writer', 'ConstructedAudit'), ('field_reviewer', 'SourceFieldVerdict'),
                                            ('writer', 'AuditSlotRepair'), ('field_reviewer', 'SourceFieldVerdict')])
        repair_payload = provider.calls[2][2]
        self.assertEqual([s['slot'] for s in repair_payload['slots'].values()], ['leadership/L01/contributions/C02'])
        self.assertNotIn('matter_register', repair_payload)
        self.assertEqual([u['field'] for u in provider.calls[3][2]['units']], ['leadership#L01'])
        self.assertEqual(result['audit_review']['repaired_slots'], ['leadership/L01/contributions/C02'])
        self.assertEqual(result['audit_review']['status'], 'repaired_and_rechecked')
        self.assertTrue(result['writer_validated'], result['errors'])
        self.assertEqual(len({r['field'] for r in result['audit_review']['receipts']}), 3)

    def test_persistent_failure_ends_as_observation_without_a_second_repair(self):
        state = self.fixture()
        provider = Provider(fail={'personal_audit:0:1'}, fail_times=5)
        result = audit.write(state, provider)
        self.assertEqual([r for r, _ in provider.roles()].count('writer'), 2)
        self.assertEqual(len(provider.calls), 4)
        self.assertFalse(result['writer_validated'])
        self.assertEqual([d['obligation_id'] for d in result['audit_review']['observations']], ['personal_audit:0:1'])
        self.assertTrue(all(result['letter'][k].strip() for k in ('executive_assessment', 'portfolio', 'leadership', 'evidence_gaps')))

    def test_unconfirmed_partner_title_is_a_located_deterministic_finding(self):
        state = self.fixture(leader=True)
        plan = audit.slots(state)
        self.assertEqual([i['name'] for i in plan['leaders'].values()], ['Edgar Moro'])
        provider = Provider(slot_text={'leadership/additional/A01': 'Figura como socio líder del asunto; no se propone su candidatura.'})
        result = audit.write(state, provider)
        repair_call = next(c for c in provider.calls if c[1] == 'AuditSlotRepair')
        self.assertEqual([s['slot'] for s in repair_call[2]['slots'].values()], ['leadership/additional/A01'])
        self.assertIn('socio', repair_call[2]['slots']['R01']['findings'][0]['message'])
        self.assertNotIn('socio líder', result['letter']['leadership'])
        # The confirmed partner may be called socia; another person's title is not hers.
        content = result['audit_build']['content']
        content['leadership']['L01']['argument'] = 'Sofia Vega es socia y dirige la práctica.'
        self.assertEqual(audit.title_findings(state, plan, content), [])
        content['executive_assessment'] = 'El asunto lo dirige el socio Edgar Moro.'
        self.assertEqual([f['path'] for f in audit.title_findings(state, plan, content)], ['executive_assessment'])
        content['executive_assessment'] = 'Edgar Moro trabajó con la socia Sofia Vega.'
        self.assertEqual(audit.title_findings(state, plan, content), [])

    def test_stage_time_budget_keeps_the_paid_letter_unreviewed(self):
        state = {**self.fixture(), 'stage_deadline': time.monotonic() + 30}
        provider = Provider()
        result = audit.write(state, provider)
        self.assertEqual(provider.roles(), [('writer', 'ConstructedAudit')])
        self.assertEqual(result['audit_review']['status'], 'partially_reviewed')
        self.assertEqual(len(result['audit_review']['unreviewed_units']), 3)
        self.assertTrue(result['letter']['leadership'])

    def test_unknown_provider_outcome_during_review_keeps_letter_and_trace(self):
        state = self.fixture()
        provider = Provider(raise_on='field_reviewer')
        result = audit.write(state, provider)
        self.assertTrue(result['letter']['portfolio'])
        self.assertEqual(result['audit_review']['status'], 'review_unavailable')
        self.assertTrue(any(call.get('usage_status') == 'unknown' for call in result['trace']))
        self.assertFalse(result['writer_validated'])
        self.assertEqual(len(provider.calls), 2)

    def test_graph_writer_uses_constructed_audit_and_persists_its_state(self):
        from unittest.mock import patch
        from core.review_graph import run_editorial_stage
        state = {**self.fixture(), 'selection_validated': True, 'selection_review_validated': True, 'development_validated': True}
        provider = Provider()
        with patch('core.review_graph.invoke_role', provider):
            result = run_editorial_stage('writer', state)
        self.assertEqual(result['audit_build']['version'], audit.VERSION)
        self.assertEqual(result['audit_review']['status'], 'reviewed')
        self.assertTrue(result['writer_validated'])
        json.dumps(result['audit_build']); json.dumps(result['audit_review'])


if __name__ == '__main__':
    unittest.main()
