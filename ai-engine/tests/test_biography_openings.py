"""B9 style rules enforced in code; the provider is simulated."""
import unittest
from core import biography_openings as bo

BIO = ("Eduardo Garduño is Head of the firm's Labour practice and advises employers.\n"
       "Eduardo is named lead partner for a post-acquisition integration covering 5,000 workers in Mexico.\n"
       "For a consumer employer, the team restructured national policies.\n"
       "Eduardo is also named co-lead partner in an ongoing Schaeffler dispute before the Federal Court.\n"
       "He is named lead partner for a manufacturing client facing 35 proceedings.\n"
       "Eduardo is further recorded as lead partner for an energy company audit.")
CANDIDATE = {'name': 'Eduardo Garduño', 'submission_bio': BIO,
             'submission_case_coverage': [{'matter_id': 'm1', 'public_quote': 'covering 5,000 workers in Mexico'},
                                          {'matter_id': 'm2', 'public_quote': 'Eduardo is also named co-lead partner in an ongoing Schaeffler dispute'}],
             'profile_coverage': []}


class OpeningTests(unittest.TestCase):
    def test_detects_repeated_role_and_subject_openings_but_not_the_introduction(self):
        self.assertEqual(bo.repeated_openings(BIO, 'Eduardo Garduño'), [3, 4, 5])
        self.assertEqual(bo.repeated_openings('A.\nB is here.\nC is there.', 'Ana Ruiz'), [])

    def test_only_flagged_sentences_are_sent_and_valid_rewrites_update_bindings(self):
        calls = []
        rewrites = {'S01': 'In an ongoing Schaeffler dispute before the Federal Court, Eduardo acts as co-lead partner.',
                    'S02': 'A manufacturing client facing 35 proceedings retains him as lead partner.',
                    'S03': 'An energy company audit is led by him.'}  # drops nothing but too short? kept if valid
        def invoke(state, role, schema, task, payload):
            calls.append(payload)
            return {k: rewrites[k] for k in schema.model_fields}, state['trace'] + [{'role': role}]
        result, trace, report = bo.vary_openings({'trace': []}, invoke, CANDIDATE, [])
        self.assertEqual(len(calls), 1)
        self.assertEqual(len(calls[0]['opening_sentences']), 3)
        self.assertNotIn('Eduardo Garduño is Head', str(calls[0]['opening_sentences']))
        self.assertIn('In an ongoing Schaeffler dispute', result['submission_bio'])
        self.assertTrue(bo.bindings_literal(result))
        self.assertEqual(result['submission_case_coverage'][1]['public_quote'],
                         'In an ongoing Schaeffler dispute before the Federal Court, Eduardo acts as co-lead partner.')
        self.assertEqual(report['flagged'], 3)
        self.assertGreaterEqual(report['applied'], 2)

    def test_rewrite_losing_a_number_or_name_or_repeating_the_role_is_rejected(self):
        old = 'He is named lead partner for a manufacturing client facing 35 proceedings.'
        self.assertFalse(bo.acceptable(old, 'A manufacturing client faced many proceedings under his leadership.', 'Eduardo Garduño'))
        self.assertFalse(bo.acceptable(old, 'He is named lead partner for a client with 35 proceedings in manufacturing.', 'Eduardo Garduño'))
        self.assertTrue(bo.acceptable(old, 'A manufacturing client facing 35 proceedings retains him as lead partner.', 'Eduardo Garduño'))

    def test_provider_failure_keeps_the_original_and_never_raises(self):
        def invoke(state, role, schema, task, payload):
            raise RuntimeError('provider outcome unknown')
        result, trace, report = bo.vary_openings({'trace': []}, invoke, CANDIDATE, [{'role': 'development'}])
        self.assertEqual(result, CANDIDATE)
        self.assertEqual(report['applied'], 0)

    def test_confirmed_partner_title_goes_in_the_first_sentence(self):
        package = {'lawyers': [{'name': 'Andrés Cabrera Gómez', 'role': 'Partner'}, {'name': 'Erick Pérez', 'role': ''}]}
        bio = {'name': 'Andrés Cabrera Gómez', 'submission_bio': 'Andrés Cabrera Gómez leads the firm’s compliance work.',
               'submission_case_coverage': [], 'profile_coverage': []}
        titled, changed = bo.place_title(bio, package)
        self.assertTrue(changed)
        self.assertTrue(titled['submission_bio'].startswith('Andrés Cabrera Gómez, a Partner, leads'))
        self.assertFalse(bo.place_title(titled, package)[1])
        self.assertFalse(bo.place_title({'name': 'Erick Pérez', 'submission_bio': 'Erick Pérez works on audits.'}, package)[1])


if __name__ == '__main__':
    unittest.main()


class AngelaExpectationTests(unittest.TestCase):
    def test_department_size_is_exact_and_total_is_their_sum(self):
        from core.editorial_construction import department_size
        self.assertEqual(department_size({'filing_details': {'num_partners': 4, 'num_lawyers': '23'}}),
                         {'partners': 4, 'other_lawyers': 23, 'total': 27})
        self.assertEqual(department_size({'filing_details': {'num_partners': '', 'num_lawyers': 9}}),
                         {'partners': None, 'other_lawyers': 9})

    def test_audit_labels_drop_form_prefixes_only(self):
        from core.audit_construction import _label
        self.assertEqual(_label({'client': 'Client: Cinemex'}), 'Cinemex')
        self.assertEqual(_label({'client': 'SCHAEFFLER'}), 'SCHAEFFLER')
        self.assertEqual(_label({'client': 'Clientes Unidos, S.A.'}), 'Clientes Unidos, S.A.')

    def test_institutional_task_keeps_career_employers_and_exact_headcount(self):
        from core.editorial_construction import INSTITUTION_TASK
        self.assertIn('career fact', INSTITUTION_TASK)
        self.assertIn('department_size exactly', INSTITUTION_TASK)


class LengthRuleTests(unittest.TestCase):
    def test_b10_c2_develop_the_original_up_to_1000_words_never_shrink(self):
        from core.editorial_construction import length_faults
        package = {'b10_source': 'word ' * 400, 'c2_source': 'word ' * 100}
        self.assertEqual(length_faults(package, {'b10': 'w ' * 600, 'c2': 'w ' * 60}), [])
        shrunk = length_faults(package, {'b10': 'w ' * 300, 'c2': 'w ' * 60})
        self.assertEqual(len(shrunk), 1)
        self.assertIn('original b10_source has 400', shrunk[0])
        self.assertIn('at most 1,000', shrunk[0])
        self.assertIn('maximum is 1,000', length_faults(package, {'b10': 'w ' * 1200, 'c2': 'w ' * 200})[0])
