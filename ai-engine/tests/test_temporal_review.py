"""Offline tests: policy propagation and gates, not paid model quality claims."""
import copy
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from core.review_graph import (BASE, Verdict, calibrate_verdict, editor,
                               register_gate, release_gate, selection_gate, strategist, writer)


class TemporalReviewTests(unittest.TestCase):
    def setUp(self):
        self.state = {'package': {'directory': 'Chambers', 'research_period': None,
            'b10_source': 'The team advises employers.', 'matters': [{
                'id': 'm1', 'client': 'Synthetic Client',
                'rawNotes': 'The team advises on collective bargaining. Work is ongoing.',
                'confidentialityConfirmed': True, 'publish_status': 'non_publishable'}],
            'rendered_artifact': 'Work Highlights in last 12 months\nWork is ongoing.'},
            'strategy': {'matters': [{'matter_id': 'm1', 'disposition': 'core',
                'source_quote': 'Work is ongoing.'}], 'hero_matter_id': 'm1'},
            'letter': {}}

    def defect(self, basis, severity='critical'):
        return {'severity': severity, 'scope': 'submission', 'matter_id': 'm1',
                'temporal_basis': basis, 'field_path': 'research_period' if basis=='missing_metadata' else None, 'message': 'Hallazgo temporal con acción y evidencia.'}

    def review(self, defects):
        with patch('core.review_graph.invoke_role', return_value=({'passed': False, 'defects': defects}, [])):
            return {**self.state, **editor(self.state)}

    def test_missing_dates_and_period_do_not_block_selection_or_rendering(self):
        self.assertEqual(register_gate(self.state)['errors'], [])
        self.assertTrue(selection_gate(self.state)['selection_validated'])
        self.assertTrue(release_gate(self.state, require_judge=False)['render_gate']['passed'])
        self.assertFalse(release_gate(self.state, require_judge=False)['release_verdict']['passed'])

    def test_metadata_only_failure_becomes_nonblocking_warning(self):
        original = self.defect('missing_metadata')
        result = self.review([original])
        self.assertTrue(result['judge']['passed'])
        self.assertEqual(result['judge']['defects'][0]['severity'], 'warning')
        self.assertTrue(release_gate(result)['release_verdict']['passed'])
        self.assertEqual(original['severity'], 'critical')
        self.assertIsNone(result['package']['research_period'])
        self.assertNotIn('startDate', result['package']['matters'][0])

    def test_evidenced_out_of_period_conflict_remains_blocking(self):
        self.state['package']['research_period'] = {'from': '2025-01-01', 'to': '2025-12-31'}
        self.state['package']['matters'][0]['rawNotes'] = 'The mandate ended in 2020. No subsequent work.'
        defect = self.defect('evidenced_conflict')
        defect['message'] = 'La fuente dice «ended in 2020. No subsequent work»; el Word afirma «Work is ongoing» para 2025. Corrige el estado o retira el asunto.'
        result = self.review([defect])
        self.assertFalse(release_gate(result)['release_verdict']['passed'])
        self.assertEqual(result['judge']['defects'], [defect])

    def test_invented_date_or_outcome_is_not_downgraded(self):
        for basis in ('unsupported_claim', None):
            result = self.review([self.defect('missing_metadata'), self.defect(basis)])
            self.assertFalse(result['judge']['passed'])
            self.assertFalse(release_gate(result)['release_verdict']['passed'])
            self.assertEqual(result['judge']['defects'][1]['severity'], 'critical')

    def test_permissions_still_block_with_only_temporal_warning(self):
        self.state['package']['matters'][0]['confidentialityConfirmed'] = False
        result = self.review([self.defect('missing_metadata')])
        self.assertTrue(result['judge']['passed'])
        self.assertFalse(release_gate(result)['release_verdict']['passed'])

    def test_live_missing_period_warning_with_standard_heading_stays_nonblocking(self):
        self.state['package']['rendered_artifact'] = 'Confidential Work Highlights in last 12 months\nWork is ongoing.'
        defect = {**self.defect('missing_metadata', 'warning'), 'code': 'MISSING_TEMPORAL_METADATA',
            'matter_id': None, 'source_quote': '',
            'artifact_quote': 'Confidential Work Highlights in last 12 months',
            'message': 'No se indicó el período de investigación. Esta ausencia no contradice los estados pendiente/en curso y no impide la entrega por sí sola.'}
        result = self.review([defect])
        self.assertTrue(result['judge']['passed'])
        self.assertEqual(result['judge']['defects'][0]['severity'], 'warning')
        # A heading plus a concrete contradictory source is not just missing metadata.
        conflict = {**defect, 'source_quote': 'The work ended in 2020.'}
        self.assertFalse(self.review([conflict])['judge']['passed'])
        invented = {**defect, 'artifact_quote': 'The appeal was won in 2025.'}
        self.assertFalse(self.review([invented])['judge']['passed'])
        self.state['package']['research_period'] = {'from': '2025-01-01', 'to': '2025-12-31'}
        self.assertFalse(self.review([defect])['judge']['passed'])

    def test_empty_negative_verdict_is_not_silently_approved(self):
        self.assertFalse(calibrate_verdict({'passed': False, 'defects': []})['passed'])

    def test_semantic_metadata_request_requires_literal_audit_and_absent_field(self):
        quote='Confirmar la ventana de investigación aplicable o la actividad material durante ella.'
        self.state['package']['rendered_audit']=quote
        defect={**self.defect('missing_metadata'),'artifact_quote':quote,
                'artifact_claim_kind':'request_for_information','source_quote':''}
        self.assertTrue(self.review([defect])['judge']['passed'])
        for changes in [{'artifact_claim_kind':'factual_assertion'}, {'artifact_quote':'Texto ausente'},
                        {'source_quote':'The mandate ended.'}, {'artifact_quote':quote+' 2025'}]:
            self.assertFalse(self.review([{**defect,**changes}])['judge']['passed'])
        self.state['package']['rendered_artifact']+=quote
        self.assertFalse(self.review([defect])['judge']['passed'])
        self.state['package']['rendered_artifact']=''
        self.state['package']['research_period']={'from':'2025-01-01','to':'2025-12-31'}
        self.assertFalse(self.review([defect])['judge']['passed'])

    def test_literal_null_field_quote_is_absence_not_a_source_conflict(self):
        defect = {**self.defect('missing_metadata'), 'source_quote': '"research_period":null',
                  'artifact_quote': 'Work Highlights in last 12 months'}
        self.assertTrue(self.review([defect])['judge']['passed'])
        for quote in ['"research_period":"2020"', '"research_period":null,"outcome":"won"', 'The work ended in 2020.']:
            self.assertFalse(self.review([{**defect, 'source_quote':quote}])['judge']['passed'])
        self.assertFalse(self.review([{**defect,'artifact_quote':'Work ended in 2020.'}])['judge']['passed'])

    def test_empty_status_form_labels_do_not_invent_a_conflict(self):
        self.state['package']['matters'][0]['rawNotes'] += '\nMatter Status (closed in last year or ongoing?):'
        self.state['package']['rendered_artifact'] += '\nD8 Date of completion or current status'
        defect = {**self.defect('missing_metadata'), 'matter_id':None, 'field_path':'matter_status',
                  'source_quote':'Matter Status (closed in last year or ongoing?):',
                  'artifact_quote':'D8 Date of completion or current status'}
        self.assertTrue(self.review([defect])['judge']['passed'])
        self.assertFalse(self.review([{**defect,'source_quote':defect['source_quote']+' closed in 2020'}])['judge']['passed'])
        self.assertFalse(self.review([{**defect,'artifact_quote':'D8 Date of completion or current status: won'}])['judge']['passed'])
        self.state['package']['matters'][0]['rawNotes'] += ' ongoing'
        self.assertFalse(self.review([defect])['judge']['passed'])
        self.state['package']['matters'][0]['rawNotes'] = 'Matter Status (closed in last year or ongoing?):\n\nMatter’s Context: Source facts.'
        self.assertTrue(self.review([defect])['judge']['passed'])
        self.state['package']['matters'][0]['matter_status']='closed'
        self.assertFalse(self.review([defect])['judge']['passed'])

    def test_typed_temporal_basis_reaches_model_for_every_editorial_role(self):
        inputs = []
        responses = [{'decisions': {'M01': {'disposition': 'core', 'legal_understanding':'Source-backed work and status.', 'priority': 1, 'rationale': 'Ongoing work', 'source_quote': 'Work is ongoing.'}}, 'hero_reference': 'M01', 'pending_questions': [], 'thesis': 'Evidence'}, {k:'Confirma la actividad del periodo.' for k in ['executive_assessment','portfolio','leadership','evidence_gaps','next_steps']},
                     Verdict(passed=False, defects=[self.defect('missing_metadata')])]
        def invoke(messages):
            inputs.append(messages)
            return {'parsed': responses.pop(0), 'raw': SimpleNamespace(usage_metadata=None, response_metadata={})}
        with patch('core.review_graph.create_chat_model') as model:
            model.return_value.with_structured_output.return_value.invoke.side_effect = invoke
            strategist(self.state)
            writer(self.state)
            result = editor(self.state)
        self.assertEqual(len(inputs), 3)
        for messages in inputs:
            self.assertIn('RP16: Temporal eligibility:', messages[0][1])
            self.assertIn('Unknown dates alone never justify exclusion.', messages[0][1])
            self.assertIn('Work Highlights in last 12 months', messages[0][1])
            self.assertIn('"research_period":null', messages[1][1])
        self.assertEqual(result['trace'][0]['prompt_version'], 'review-core-v3.1')
        self.assertTrue(result['judge']['passed'])
