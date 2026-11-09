import copy
import unittest
from unittest.mock import patch
from pydantic import ValidationError
from core.biography_depth import (DEPTH_CONTRACT, biography_depth_errors,
    depth_recovery_obligation, residual_repair_groups)
from core.editorial_case import obligations
from core.editorial_development import development_contract
from core.editorial_execution import missing_head_bios
from core.editorial_repair import (repair_targets, coherent_repair_targets,
    biography_delta_contract, expand_biography_delta, apply_valid_corrections)
from core.editorial_voice import voice_matches
from test_personal_quality_contract import complete_case


def depth_case():
    p, s, v = complete_case()
    v['biography_depth_contract'] = DEPTH_CONTRACT
    v['candidates'][0]['biography_depth'] = {
        'decision': 'developed', 'source_limitation': '', 'information_to_add': ''}
    return p, s, v


class BiographyDepthTests(unittest.TestCase):
    def test_range_is_not_a_numeric_pause_but_all_own_evidence_is_reviewed(self):
        p, s, v = depth_case()
        self.assertEqual(biography_depth_errors(p, v, 0), [])
        self.assertNotIn('candidates/0', repair_targets(p, s, v))
        obligation = next(o for o in obligations(p, s, v) if o['id'] == 'depth:0:b9')
        self.assertIn('500', str(obligation))
        self.assertIn('Do not reject by word count alone', str(obligation))
        self.assertIn('m4', str(obligation['sources']))
        # A real omission still creates a repair; dropping the numerical floor
        # does not waive personal evidence or approve the final document.
        v['candidates'][0]['submission_case_coverage'].pop()
        self.assertIn('candidates/0', repair_targets(p, s, v))

    def test_range_boundaries_and_missing_metadata(self):
        p, s, v = depth_case()
        for count in (500, 1000):
            v['candidates'][0]['submission_bio'] = ' '.join(['word'] * count)
            # This asserts the length boundary only; semantic review still
            # rejects padding and the original evidence gates remain active.
            self.assertEqual(biography_depth_errors(p, v, 0), [])
        v['candidates'][0]['submission_bio'] += ' excess'
        self.assertTrue(biography_depth_errors(p, v, 0))
        v['candidates'][0].pop('biography_depth')
        self.assertTrue(biography_depth_errors(p, v, 0))

    def test_source_limit_needs_action_and_independent_own_source_review(self):
        p, s, v = depth_case(); c = v['candidates'][0]
        c['biography_depth']['decision'] = 'source_limited'
        self.assertTrue(biography_depth_errors(p, v, 0))
        c['biography_depth'].update(source_limitation='The source describes participation but not the personal procedural actions.',
                                  information_to_add='Add the personal procedural actions, if known.')
        self.assertEqual(biography_depth_errors(p, v, 0), [])
        check = next(x for x in obligations(p, s, v) if x['id'] == 'depth:0:b9')
        self.assertEqual(check['field'], 'candidates/0/submission_bio')
        self.assertTrue(any(x.get('id') == 'm4' for x in check['sources']))
        self.assertIn('not a self-certified waiver', str(check))

    def test_nomination_cannot_bypass_depth_and_non_nominated_profile_is_proportionate(self):
        p, s, v = depth_case(); c = v['candidates'][0]
        c['biography_depth']['decision'] = 'not_nominated'
        self.assertTrue(biography_depth_errors(p, v, 0))
        c['recommendation'] = 'do_not_present'
        self.assertEqual(biography_depth_errors(p, v, 0), [])

    def test_non_nominated_source_limit_does_not_create_an_editorial_blocker(self):
        p, s, v = depth_case(); c = v['candidates'][0]
        c['recommendation'] = 'develop'
        c['biography_depth'].update(decision='source_limited', source_limitation='No individual procedural action supplied.', information_to_add='Describe the individual action.')
        self.assertEqual(biography_depth_errors(p, v, 0), [])
        self.assertIsNone(depth_recovery_obligation(v, 0))

    def test_recovery_receives_measured_progress_and_is_refreshed_after_correction(self):
        from core.biography_obligations import enrich_biography_targets
        p, s, v = depth_case(); c = v['candidates'][0]
        target = {'current_value': c, 'mutable_fields': ['submission_bio']}
        targets = enrich_biography_targets(p, v, {'candidates/0': target})
        obligation = targets['candidates/0']['depth_recovery']
        self.assertEqual(obligation['current_words'], len(c['submission_bio'].split()))
        self.assertEqual(obligation['words_to_target_floor'], 500-len(c['submission_bio'].split()))
        c['submission_bio'] = ' '.join(['word'] * 600)
        self.assertNotIn('depth_recovery', enrich_biography_targets(p, v, targets)['candidates/0'])

    def test_residual_attempt_is_disjoint_and_keeps_ordinary_fields_together(self):
        targets = {'candidates/0': {'depth_recovery': {'current_words': 420}},
                   'b10': {'current_value': 'Overview'},
                   'candidates/1': {'depth_recovery': {'current_words': 470}},
                   'candidates/2': {'current_value': 'Team member'}}
        before = copy.deepcopy(targets)
        groups = residual_repair_groups(targets)
        self.assertEqual([set(g) for g in groups], [{'b10','candidates/2'}, {'candidates/0'}, {'candidates/1'}])
        self.assertEqual([p for g in groups for p in g].count('candidates/0'), 1)
        self.assertEqual(targets, before)

    def test_unknown_later_group_preserves_earlier_correction_and_cumulative_usage(self):
        from core.editorial_repair import repair_development
        from core.review_graph import EditorialResponseError
        from test_surgical_repair_postconditions import native_answer
        p, s, v = depth_case()
        good_outputs = {f'S{i+1:02d}': x['public_quote'] for i,x in enumerate(v['candidates'][0]['submission_case_coverage'])}
        v['candidates'][0]['submission_case_coverage'][0]['public_quote'] = 'Absent generated output proof.'
        # Three independent generated entries exercise the recovery scheduler;
        # duplicated test identities do not certify editorial acceptance.
        v['candidates'] = [copy.deepcopy(v['candidates'][0]) for _ in range(3)]
        calls = []
        def invoke(state, role, schema, instruction, payload):
            calls.append(list(payload['repair_targets']))
            if len(calls) == 3:
                failure = EditorialResponseError('provider outcome unknown', {'usage': {'unknown_calls': 1}})
                failure.trace_history = state['trace'] + [failure.trace]
                raise failure
            corrections = []
            for path, target in payload['repair_targets'].items():
                c = target['current_value']
                depth = copy.deepcopy(c['biography_depth'])
                if len(calls) == 2:
                    depth.update(decision='source_limited', source_limitation='Only a brief result is supplied, without personal procedural detail.', information_to_add='Add the personal procedural steps.')
                corrections.append({'path': path, 'value': {'submission_bio': c['submission_bio'], 'profile_coverage': None,
                    'submission_case_coverage': good_outputs if len(calls)==2 else None, 'biography_depth': depth}, 'reason': 'Preserve factual content.'})
            answer = native_answer({'corrections': corrections, 'unresolved': []}, payload['target_references'])
            schema.model_validate(answer)
            return answer, state.get('trace', []) + [{'usage': {'total_tokens': 11}}]
        with patch('core.review_graph.invoke_role', side_effect=invoke):
            result = repair_development({'package': p, 'strategy': s}, v, repair_targets(p, s, v))
        self.assertEqual(calls, [['candidates/0','candidates/1','candidates/2'], ['candidates/0'], ['candidates/1']])
        self.assertEqual(result['development']['candidates'][0]['biography_depth']['decision'], 'source_limited')
        self.assertEqual(result['development']['candidates'][1]['biography_depth']['decision'], 'developed')
        self.assertEqual(sum(x['usage'].get('total_tokens', 0) for x in result['trace']), 22)
        self.assertEqual(result['trace'][-1]['usage']['unknown_calls'], 1)
        self.assertEqual(result['repair_report']['retry_paths'], ['candidates/0', 'candidates/1'])
        self.assertEqual(result['repair_report']['residual_requests'], 2)
        self.assertFalse(result['development_validated'])

    def test_new_generation_requires_depth_without_reinterpreting_historical_artifacts(self):
        p, s, v = complete_case()
        self.assertEqual(biography_depth_errors(p, v, 0), [])
        schema = development_contract(p, s, personal_quality=True, biography_depth=True)
        candidate = schema.model_fields['candidates'].annotation.__args__[0]
        with self.assertRaises(ValidationError): candidate.model_validate(v['candidates'][0])
        self.assertTrue(schema.model_fields['biography_depth_contract'].is_required())

    def test_leading_practice_satisfies_headship_without_an_extra_sentence(self):
        p, s, v = complete_case()
        p['filing_details'] = {'heads': [{'name': 'Sofia Vega'}]}
        v['candidates'][0]['submission_bio'] = 'Sofia Vega is the partner leading the Labour & Employment practice.'
        self.assertEqual(missing_head_bios(p, v), [])
        v['candidates'][0]['submission_bio'] = 'Sofia Vega led the constitutional proceedings.'
        self.assertEqual(missing_head_bios(p, v), [0])

    def test_voice_repair_releases_only_defective_output_quote_not_source_links(self):
        p, s, v = complete_case(); c = v['candidates'][0]
        original = c['submission_case_coverage'][0]['public_quote']
        bad = 'As named lead, ' + original
        c['submission_bio'] = c['submission_bio'].replace(original, bad)
        c['submission_case_coverage'][0]['public_quote'] = bad
        targets = coherent_repair_targets(v, repair_targets(p, s, v), p)
        target = targets['candidates/0']
        self.assertNotIn(bad, target.get('preserve_generated_quotes', []))
        fixed = copy.deepcopy(c)
        fixed['submission_bio'] = fixed['submission_bio'].replace(bad, original)
        fixed['submission_case_coverage'][0]['public_quote'] = original
        result, failures = apply_valid_corrections(v, {'candidates/0': target},
            {'corrections': [{'path': 'candidates/0', 'value': fixed, 'reason': 'Remove source commentary, retaining facts.'}], 'unresolved': []}, p, s)
        self.assertEqual(failures, {})
        self.assertEqual(result['candidates'][0]['submission_case_coverage'][0]['source_quote'], c['submission_case_coverage'][0]['source_quote'])

    def test_bio_delta_can_refresh_depth_without_authority_to_change_category(self):
        from core.biography_obligations import enrich_biography_targets
        p, s, v = depth_case(); c = v['candidates'][0]
        targets = {'candidates/0': {'current_value': c, 'mutable_fields': ['submission_bio']}}
        target = enrich_biography_targets(p, v, targets)['candidates/0']
        schema = biography_delta_contract(target)
        self.assertIn('biography_depth', schema.model_fields)
        self.assertNotIn('suggested_ranking', schema.model_fields)
        changed = expand_biography_delta(target, {'submission_bio': c['submission_bio'], 'biography_depth': c['biography_depth']})
        self.assertEqual(changed['category_assessment'], c['category_assessment'])

    def test_repetitions_rejected_without_rejecting_legal_documentation(self):
        self.assertTrue(voice_matches('She leads the employment practice across the national offices. She leads the employment practice across the national offices.'))
        self.assertTrue(voice_matches('As named co-lead, she secured relief.'))
        self.assertFalse(voice_matches('She documented payroll irregularities and secured constitutional protection.'))


if __name__ == '__main__': unittest.main()
