import copy
import unittest
from pydantic import ValidationError
from core.biography_depth import DEPTH_CONTRACT, biography_depth_errors
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
    def test_short_nominated_bio_is_located_for_repair_not_silently_accepted(self):
        p, s, v = depth_case()
        self.assertTrue(any('500' in e for e in biography_depth_errors(p, v, 0)))
        target = repair_targets(p, s, v)['candidates/0']
        self.assertIn('500', target['problem'])
        self.assertIn('biography_depth', target['problem'])
        self.assertEqual(set(target['mutable_fields']), {'submission_bio','profile_coverage','submission_case_coverage','biography_depth'})

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
