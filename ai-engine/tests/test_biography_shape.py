"""A nominated B9 that reads as a matter list is corrected once, before review, never stopped."""
import unittest
from unittest.mock import patch

from core import biography_shape
from core.editorial_construction import advance
from core.prose_rules import natural_lead, states_headship
import test_editorial_construction as construction_base

_WORDS = ['zoning', 'licence', 'decree', 'boundary', 'easement', 'permit', 'registry', 'suspension', 'appeal', 'hearing',
          'valuation', 'title', 'concession', 'expropriation', 'possession', 'tribunal', 'municipality', 'ordinance', 'covenant', 'survey']
_COUNTER = iter(range(10 ** 6))


class _Filler:
    """Distinct filler sentences so fixtures never repeat content by accident."""
    def __radd__(self, other):
        return other + self._next()

    def __mul__(self, n):
        return ''.join(self._next() for _ in range(n))

    def _next(self):
        i = next(_COUNTER)
        # Every word is unique to this sentence: no shared content by construction.
        return ' ' + ' '.join(f'{_WORDS[(i + k) % len(_WORDS)]}{i}n{k}' for k in range(22)) + '.'


FILLER = _Filler()
LIST_BIO = '\n\n'.join(
    ['Ana Ruiz is a partner who advises developers on land-use disputes.' + FILLER]
    + [f'Ana Ruiz {verb} a matter number {i} for a developer.' + FILLER * 2
       for i, verb in enumerate(['led', 'also led', 'leads', 'also leads', 'co-led'], start=1)]
    + ['Finally, Ana leads a further matter for a landowner.' + FILLER])
THEMED_BIO = '\n\n'.join([
    'Ana Ruiz, head of the Real Estate practice, advises developers whose projects are halted by land-use measures.' + FILLER,
    'Development continuity. In the most significant mandate, Ana obtained the revocation of four suspensions within three weeks; two related amparo actions followed.' + FILLER * 3,
    'Expropriation and property recovery. A developer recovered standing to seek compensation after Ana built the expert identification evidence.' + FILLER * 3,
    'She teaches Amparo at a university and serves on a bar association committee.' + FILLER,
    'This work shows sustained control of contested land-use litigation for developers.'])


class ShapeRuleTests(unittest.TestCase):
    def candidate(self, bio, recommendation='present'):
        return {'name': 'Ana Ruiz', 'recommendation': recommendation, 'submission_bio': bio}

    def test_matter_list_is_located_with_the_exact_expectation(self):
        found = biography_shape.faults(self.candidate(LIST_BIO))
        self.assertEqual(len(found), 1)
        self.assertIn('B9 SHAPE', found[0])
        self.assertIn('two to four legal themes', found[0])

    def test_themed_biography_and_short_or_secondary_profiles_pass(self):
        self.assertEqual(biography_shape.faults(self.candidate(THEMED_BIO)), [])
        self.assertEqual(biography_shape.faults(self.candidate(LIST_BIO, 'do_not_present')), [])
        self.assertEqual(biography_shape.faults(self.candidate('Ana Ruiz led one matter.')), [])

    def test_form_vocabulary_is_read_as_the_natural_lead_verb(self):
        bio = LIST_BIO.replace('Ana Ruiz led', 'Ana Ruiz was named lead partner in').replace('Ana Ruiz leads', 'Ana Ruiz is named lead partner in')
        self.assertTrue(biography_shape.faults(self.candidate(bio)))

    def test_artificial_passive_is_flagged_for_active_voice(self):
        bio = THEMED_BIO + '\n\nA challenge to an expropriation decree is led by Ana. Nullity of administrative acts is sought in further disputes; Ruiz leads the matter.'
        found = biography_shape.faults(self.candidate(bio))
        self.assertEqual(len(found), 1)
        self.assertIn('B9 VOICE', found[0])

    def test_repeated_headship_is_stated_once(self):
        bio = THEMED_BIO + '\n\nAs head of the Real Estate practice, Ana also supervises the team.'
        found = biography_shape.faults(self.candidate(bio))
        self.assertEqual(len(found), 1)
        self.assertIn('B9 HEADSHIP', found[0])

    def test_the_same_content_stated_twice_is_flagged(self):
        bio = THEMED_BIO + '\n\nShe is a founding partner of Ruiz Abogados, responsible for the firm’s administrative, constitutional and amparo litigation areas.' \
            + '\n\nAna Ruiz is a founding partner of Ruiz Abogados and responsible for the firm’s administrative, constitutional and amparo litigation areas.'
        found = biography_shape.faults(self.candidate(bio))
        self.assertTrue(any('B9 REPETITION' in f for f in found))
        self.assertEqual(biography_shape.repeated_sentences(THEMED_BIO), [])

    def test_headship_must_name_this_practice_or_the_department(self):
        self.assertFalse(states_headship('He heads the firm’s administrative, constitutional and amparo litigation areas.', 'Real Estate'))
        self.assertTrue(states_headship('He heads the firm’s real estate and construction areas.', 'Real Estate'))
        self.assertTrue(states_headship('Eduardo is Head of DeForest’s Labor & Employment department.', 'Labour & Employment'))

    def test_lead_partner_residue_becomes_natural_prose(self):
        self.assertEqual(natural_lead('His lead-partner responsibilities extend to ongoing disputes.'), 'His work extends to ongoing disputes.')


class ShapeConstructionTests(unittest.TestCase):
    """Control flow with the real orchestrator; faults() is scripted per call."""

    def run_with(self, scripted, invoke=None):
        base = construction_base.ConstructionTests()
        state, v = base.fixture()
        calls = []
        sequence = list(scripted)
        provider = invoke(base.provider(v, calls)) if invoke else base.provider(v, calls)
        with patch.dict('os.environ', {'RANKPILOT_PARALLEL_UNITS': '1'}), \
             patch('core.biography_shape.faults', side_effect=lambda c: sequence.pop(0) if sequence else []):
            result = advance(state, provider)
        return result, calls

    def test_shape_fault_buys_exactly_one_correction_with_the_expectation(self):
        result, calls = self.run_with([['B9 SHAPE: list form'], []])
        self.assertTrue(result['development_validated'], result['errors'])
        names = [c[0] for c in calls]
        self.assertEqual(names.count('OwnedBiography'), 2)
        feedback = calls[[i for i, n in enumerate(names) if n == 'OwnedBiography'][1]][1]['validator_feedback']
        self.assertIn('B9 SHAPE', feedback['errors'])

    def test_worse_correction_keeps_the_better_first_draft_and_continues(self):
        result, calls = self.run_with([['one'], ['one', 'two'], ['one']])
        self.assertTrue(result['development_validated'], result['errors'])
        report = result['development_build_report']
        self.assertEqual(report['bio_shape'][0]['kept_prior'], True)
        self.assertEqual(report['shape_observations'], ['one'])
        self.assertEqual([c[0] for c in calls].count('OwnedBiography'), 2)

    def test_broken_correction_never_stops_the_case(self):
        def breaking(real):
            seen = []

            def invoke(state, role, schema, instruction, payload):
                if schema.__name__ == 'OwnedBiography':
                    seen.append(1)
                    if len(seen) == 2:
                        value, trace = real(state, role, schema, instruction, payload)
                        return {}, trace  # an invalid corrected biography
                return real(state, role, schema, instruction, payload)
            return invoke
        result, calls = self.run_with([['B9 SHAPE: list form']], breaking)
        self.assertTrue(result['development_validated'], result['errors'])
        self.assertTrue(result['development_build_report']['bio_shape'][0]['kept_prior'])


class ParallelSiblingTests(unittest.TestCase):
    def test_self_correction_keeps_paid_parallel_siblings(self):
        base = construction_base.ConstructionTests()
        state, v = base.fixture()
        state['durable_repair_steps'] = True
        calls = []
        real = base.provider(v, calls)
        first = []

        def invoke(state, role, schema, instruction, payload):
            if schema.__name__ == 'MatterNarratives' and not first:
                first.append(1)
                value, trace = real(state, role, schema, instruction, payload)
                return {'matters': [{'matter_id': 'other', 'text': 'Wrong source', 'completion_status': ''}]}, trace
            return real(state, role, schema, instruction, payload)
        with patch.dict('os.environ', {'RANKPILOT_PARALLEL_UNITS': '4'}):
            for _ in range(8):
                result = advance(state, invoke)
                state = {**state, **result}
                if result.get('development_validated') or result.get('errors'):
                    break
        self.assertTrue(result['development_validated'], result.get('errors'))
        names = [c[0] for c in calls]
        # The biography bought in the same parallel batch is used, never bought again.
        self.assertEqual(names.count('OwnedBiography'), 1)
        self.assertEqual(names.count('MatterNarratives'), 2)


if __name__ == '__main__':
    unittest.main()
