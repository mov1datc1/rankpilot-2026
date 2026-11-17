"""Offline contracts for the split final review and prompt-cache routing.

Signed field proofs bound to the exact files let the final reviewer skip the
source narratives of proven records; nothing here approves a delivery.
"""
import copy
import json
import os
import unittest
from unittest.mock import patch
from core import field_review as fr
from core import audit_construction as audit
from test_field_review import state as field_state, verdict
from test_audit_construction import Provider, AuditConstructionTests


class Stop(Exception):
    pass


def rendered_submission(development):
    return '\n'.join([development['b10'], development['c2']] + [m['text'] for m in development['matters']]
                     + [c['submission_bio'] for c in development['candidates']])


def signed_package(current, unproven=()):
    units = fr.units_for(current)
    proven = [u for u in units if u['field'] not in unproven]
    receipts, _ = fr.project_checks(proven, verdict(proven))
    development = current['development']
    return {**current['package'], 'field_review_receipts': receipts,
            'rendered_artifact': rendered_submission(development), 'rendered_audit': 'Audit',
            'rendered_candidate_bios': {c['name']: c['submission_bio'] for c in development['candidates']}}


@patch.dict(os.environ, {'AI_ENGINE_SERVICE_TOKEN': 'offline-test-secret'})
class ScopedFinalReviewTests(unittest.TestCase):
    def test_prose_proofs_are_reused_only_when_the_exact_file_contains_them_once(self):
        current = field_state()
        package = signed_package(current)
        verified = set(fr.verified_obligations(package, current['strategy'], current['development']))
        matter = next(u for u in fr.units_for(current) if u['field'].startswith('matters/'))
        self.assertTrue({o['id'] for o in matter['obligations']} <= verified)
        changed = {**package, 'rendered_artifact': package['rendered_artifact'].replace(matter['output'][:60], 'Different words. ')}
        self.assertFalse({o['id'] for o in matter['obligations']} & set(fr.verified_obligations(changed, current['strategy'], current['development'])))
        twice = {**package, 'rendered_artifact': package['rendered_artifact'] + '\n' + matter['output']}
        self.assertFalse({o['id'] for o in matter['obligations']} & set(fr.verified_obligations(twice, current['strategy'], current['development'])))
        with patch.dict(os.environ, {'RANKPILOT_SCOPED_FINAL_REVIEW': 'off'}):
            self.assertFalse({o['id'] for o in matter['obligations']} & set(fr.verified_obligations(package, current['strategy'], current['development'])))
        with patch.dict(os.environ, {'AI_ENGINE_SERVICE_TOKEN': ''}):
            self.assertEqual(fr.verified_obligations(package, current['strategy'], current['development']), [])

    def test_scoped_package_keeps_identity_facts_and_full_sources_where_still_needed(self):
        current = field_state()
        unit = next(u for u in fr.units_for(current) if u['field'].startswith('matters/'))
        package = signed_package(current, unproven=(unit['field'],))
        package['_verified_field_obligations'] = fr.verified_obligations(package, current['strategy'], current['development'])
        scoped, proven = fr.scoped_final_package(package, current['strategy'], current['development'])
        open_id = current['development']['matters'][int(unit['field'].split('/')[1])]['matter_id']
        records = {m['id']: m for m in scoped['matters']}
        self.assertEqual(records[open_id], next(m for m in package['matters'] if m['id'] == open_id))
        for mid in proven:
            self.assertNotIn('source_excerpt', records[mid])
            original = next(m for m in package['matters'] if m['id'] == mid)
            for key in ('client', 'publish_status', 'publication_route', 'value'):
                if key in original:
                    self.assertEqual(records[mid][key], original[key])
        self.assertEqual(len(scoped['matters']), len(package['matters']))
        self.assertNotIn('_verified_field_obligations', scoped)
        with patch.dict(os.environ, {'RANKPILOT_SCOPED_FINAL_REVIEW': 'off'}):
            same, none = fr.scoped_final_package(package, current['strategy'], current['development'])
            self.assertIs(same, package); self.assertEqual(none, [])

    def test_editor_sends_scoped_view_but_validates_bindings_against_complete_register(self):
        from core.review_graph import editor
        current = field_state()
        tail = ' This sentence keeps the reviewed field long enough to be located exactly in the Word file.'
        development = current['development']
        for key in ('b10', 'c2'):
            development[key] += tail
        for matter in development['matters']:
            matter['text'] += tail
        letter = {'executive_assessment': 'Veredicto ejecutivo.', 'portfolio': '1. Asunto seleccionado.',
                  'leadership': 'Estrategia individual.', 'evidence_gaps': 'Reservas comparadas.', 'next_steps': 'Acciones.'}
        package = {**signed_package(current), 'rendered_audit': '\n'.join(letter.values())}
        captured = {}

        def invoke(s, role, schema, instruction, payload):
            captured.update(role=role, payload=copy.deepcopy(payload), instruction=instruction,
                            binding=s.get('binding_package'))
            raise Stop()
        with patch('core.review_graph.invoke_role', side_effect=invoke):
            with self.assertRaises(Stop):
                editor({'package': package, 'strategy': current['strategy'], 'development': current['development'],
                        'letter': letter, 'trace': []})
        self.assertEqual(captured['role'], 'editor')
        self.assertIn('SCOPED FINAL REVIEW', captured['instruction'])
        sent = captured['payload']['package']['matters']
        sent_ids = [o['id'] for o in captured['payload']['case_obligations']]
        # Proven Submission obligations are not re-judged against their sources.
        self.assertFalse([i for i in sent_ids if i.startswith(('matter:', 'argument:', 'personal_case:', 'depth:', 'profile:'))], sent_ids)
        self.assertTrue(sent_ids)
        # A record keeps its full narrative only while an open obligation uses it.
        from core.editorial_case import obligations
        needed = {src.get('id') for o in obligations({**package, '_verified_field_obligations': fr.verified_obligations(package, current['strategy'], development)},
                                                     current['strategy'], development) for src in o['sources'] if isinstance(src, dict)}
        for record in sent:
            self.assertEqual('source_excerpt' in record or 'rawNotes' in record or 'summary' in record,
                             record['id'] in needed or not record.get('source_review'))
        self.assertEqual(captured['binding']['matters'], package['matters'])
        self.assertNotIn('field_review_receipts', captured['payload']['package'])

    def test_audit_proofs_are_bound_to_visible_lines_and_signature(self):
        case = AuditConstructionTests()
        state = case.fixture()
        result = audit.write(state, Provider())
        proofs = [r for r in result['field_review_receipts'] if r.get('version') == audit.REVIEW_VERSION]
        self.assertEqual({p['field'] for p in proofs}, {'leadership#L01', 'evidence_gaps', 'executive_assessment'})
        rendered = '\n'.join(audit.visible(result['letter'][k]) for k in ('executive_assessment', 'portfolio', 'leadership', 'evidence_gaps', 'next_steps'))
        package = {'rendered_audit': rendered, 'field_review_receipts': proofs}
        wanted = {o for p in proofs for o in p['obligation_ids']}
        self.assertEqual(set(audit.verified_obligations(package)), wanted)
        edited = rendered.replace(proofs[0]['output_lines'][-1], 'Una línea distinta.')
        self.assertFalse(set(proofs[0]['obligation_ids']) & set(audit.verified_obligations({**package, 'rendered_audit': edited})))
        forged = [{**proofs[0], 'obligation_ids': proofs[0]['obligation_ids'] + ['target']}] + proofs[1:]
        self.assertNotIn('target', audit.verified_obligations({**package, 'field_review_receipts': forged}))
        # A rewritten Audit replaces earlier Audit proofs and keeps Submission receipts.
        again = audit.write({**state, 'field_review_receipts': result['field_review_receipts'] + [{'version': fr.VERSION, 'field': 'b10'}]}, Provider())
        versions = [r.get('version') for r in again['field_review_receipts']]
        self.assertEqual(versions.count(fr.VERSION), 1)
        self.assertEqual(versions.count(audit.REVIEW_VERSION), 3)


class PromptCacheTests(unittest.TestCase):
    def test_key_names_role_and_revision_only_and_can_be_disabled(self):
        from core.review_graph import prompt_cache_key
        key = prompt_cache_key('field_reviewer')
        self.assertTrue(key.startswith('rp:field_reviewer:'))
        # Provider limit: a longer key is rejected with HTTP 400 before generation.
        for role in ('strategist', 'selection_reviewer', 'diagnostic_reviewer', 'portfolio_reviewer', 'field_reviewer',
                     'development', 'repair', 'writer', 'editor', 'x' * 200):
            self.assertLessEqual(len(prompt_cache_key(role)), 64, role)
        self.assertNotIn('scoped', key)
        self.assertNotEqual(key, prompt_cache_key('repair'))
        with patch.dict(os.environ, {'RANKPILOT_PROMPT_CACHE': 'off'}):
            self.assertIsNone(prompt_cache_key('field_reviewer'))

    def test_key_reaches_the_request_but_not_the_budget_count(self):
        from core.review_graph import prompt_cache_key
        from utils.model_factory import create_chat_model
        from utils.provider_budget import COUNT_FIELDS
        model = create_chat_model('judge')
        model = model.model_copy(update={'model_kwargs': {**(model.model_kwargs or {}), 'prompt_cache_key': prompt_cache_key('editor')}})
        payload = model._get_request_payload([('system', 'static'), ('human', 'data')])
        self.assertEqual(payload['prompt_cache_key'], prompt_cache_key('editor'))
        self.assertNotIn('prompt_cache_key', COUNT_FIELDS)


if __name__ == '__main__':
    unittest.main()
