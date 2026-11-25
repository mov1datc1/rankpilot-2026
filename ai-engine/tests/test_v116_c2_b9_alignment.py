"""v1.0.116: causes found by reading the C2/B9 code against a real run (synthetic names)."""
import copy
import unittest

from core import biography_shape
from core.candidate_evidence import individual_verification_sources
from core.editorial_case import obligations, prepare_case
from core.editorial_construction import INSTITUTION_TASK, VERSION, bio_task
from core.editorial_development import bind_development
from core.editorial_repair import TASK as REPAIR_TASK
from core.editorial_repetition import drop_restated_sentences, drop_restated_with_bindings
from core.prose_rules import natural_lead, states_headship
from test_biography_depth import depth_case

REPEATED = ('Vega is one of the lead partners on the ongoing representation of Beta Uno, S.A. '
            'The department prepared a municipal tax strategy for its headquarters. '
            'Vega is one of the lead partners on the ongoing representation of Beta Uno, S.A., '
            'where the department handled the tax aspects of imports. The matter remains ongoing.')
MERGED = ('Vega is one of the lead partners on the ongoing representation of Beta Uno, S.A., '
          'where the department handled the tax aspects of imports. '
          'The department prepared a municipal tax strategy for its headquarters. The matter remains ongoing.')


def verification(name='Sofia Vega', status='verified_mismatch', band='Senior Statespeople'):
    return {'individuals': [{'status': status, 'lawyer_name': name, 'observed_band': band, 'directory': 'Chambers & Partners',
                             'practice_area': 'Tax', 'jurisdiction': 'Mexico', 'evidence': {'guide': 'Latin America', 'edition': '2027'}}],
            'profile_research': {'profiles': [
                {'status': 'retrieved', 'subject': {'kind': 'individual', 'name': name},
                 'commentary': [{'text': 'Sofia Vega is an extremely well-known tax lawyer.'}]},
                {'status': 'retrieved', 'subject': {'kind': 'competitor', 'name': 'Other Firm'},
                 'commentary': [{'text': 'Other Firm has a strong tax practice.'}]}]}}


class C2WriterAndReviewerAgree(unittest.TestCase):
    def test_an_individual_category_is_not_a_repeated_request(self):
        package, strategy, proposal = depth_case()
        state = {'package': package, 'strategy': strategy, 'selection_validated': True, 'selection_review_validated': True}
        state.update(prepare_case(state))
        proposal['construction_contract'] = VERSION
        rule = next(o for o in obligations(state['package'], state['strategy'], proposal)
                    if o['id'] == 'editorial:c2_distinct_argument')['instruction']
        self.assertIn('practice ranking aspiration at most once', rule)
        self.assertIn('requests for a named lawyer is a different aspiration', rule)
        self.assertIn('is not a repeated request', rule)
        flat = ' '.join(INSTITUTION_TASK.split())
        self.assertIn('a category the firm requests for a named lawyer is stated once for that lawyer, in that same closing paragraph', flat)

    def test_repair_no_longer_tells_c2_to_request_coverage(self):
        self.assertNotIn('C2 requests coverage directly', REPAIR_TASK)
        self.assertIn('as the conclusion of its argument', REPAIR_TASK)


class InstitutionalProseNamesPublishableClients(unittest.TestCase):
    def test_same_rule_as_the_biography(self):
        flat = ' '.join(INSTITUTION_TASK.split())
        self.assertIn('a client whose matter is publishable keeps its name in B10 and C2 and is never called confidential', flat)
        self.assertIn('generalise only the clients of confidential matters', flat)
        self.assertIn('never describe how a record, form, table or profile lists, names, records or observes them', flat)

    def test_a_confidential_value_has_no_order_of_magnitude(self):
        for task in (INSTITUTION_TASK, bio_task()):
            flat = ' '.join(task.split())
            self.assertIn('not even as a range or an order of magnitude', flat)


class CategoryReviewSeesTheOfficialObservation(unittest.TestCase):
    def test_only_this_lawyers_verified_observation_and_own_commentary(self):
        found = individual_verification_sources({'ranking_verification': verification()}, 'Sofía Vega')
        self.assertEqual(len(found), 1)
        text = found[0]['source_excerpt']
        self.assertIn('Sofia Vega is ranked as Senior Statespeople', text)
        self.assertIn('Chambers & Partners, Latin America, edition 2027, Tax Mexico', text)
        self.assertIn('extremely well-known tax lawyer', text)
        self.assertNotIn('Other Firm', text)
        self.assertEqual(individual_verification_sources({'ranking_verification': verification()}, 'Ana Ruiz'), [])
        self.assertEqual(individual_verification_sources({}, 'Sofia Vega'), [])

    def test_a_search_without_a_match_is_not_evidence(self):
        missing = verification(status='not_found', band=None)
        missing['profile_research'] = {'profiles': []}
        self.assertEqual(individual_verification_sources({'ranking_verification': missing}, 'Sofia Vega'), [])

    def test_the_category_obligation_carries_it(self):
        package, strategy, proposal = depth_case()
        state = {'package': package, 'strategy': strategy, 'selection_validated': True, 'selection_review_validated': True}
        state.update(prepare_case(state))
        name = proposal['candidates'][0]['name']
        plain = next(o for o in obligations(state['package'], state['strategy'], proposal) if o['id'] == 'category:0:fit')
        self.assertNotIn('official directory observation of THIS person', plain['instruction'])
        checked = copy.deepcopy(state['package'])
        checked['ranking_verification'] = verification(name=name)
        seen = next(o for o in obligations(checked, state['strategy'], proposal) if o['id'] == 'category:0:fit')
        self.assertEqual(len(seen['sources']), len(plain['sources']) + 1)
        self.assertIn('is ranked as Senior Statespeople', seen['sources'][-1]['source_excerpt'])
        self.assertIn('An official directory observation of THIS person', seen['instruction'])


class RepetitionAfterRepair(unittest.TestCase):
    def test_a_sentence_repeated_as_the_opening_of_another_is_kept_once(self):
        self.assertEqual(drop_restated_sentences(REPEATED), MERGED)

    def test_a_company_form_followed_by_lower_case_is_not_a_sentence_end(self):
        text = ('Vega advised on the ongoing representation of Beta Uno, S.A. in Mexico since 2017. Then came more work. '
                'Vega advised on the ongoing representation of Beta Uno, S.A., where audits followed.')
        self.assertEqual(drop_restated_sentences(text), text)

    def test_a_quotation_that_contains_the_repetition_moves_with_it(self):
        quote = REPEATED[:REPEATED.index(' The matter remains')]
        self.assertEqual(drop_restated_sentences(REPEATED, [quote]), REPEATED)
        text, moved = drop_restated_with_bindings(REPEATED, [quote])
        self.assertEqual(text, MERGED)
        self.assertIn(moved[quote], text)

    def test_a_quotation_that_cannot_follow_blocks_the_change(self):
        quote = 'Vega is one of the lead partners on the ongoing representation of Beta Uno, S.A. The department prepared a municipal tax strategy for its headquarters.'
        text, moved = drop_restated_with_bindings(REPEATED, [quote])
        self.assertEqual((text, moved), (REPEATED, {}))

    def test_binding_applies_it_and_keeps_the_quotation_literal(self):
        quote = REPEATED[:REPEATED.index(' The matter remains')]
        proposal = {'matters': [], 'candidates': [{'name': 'Sofia Vega', 'submission_bio': REPEATED, 'profile_coverage': [],
                    'supporting_matters': [], 'submission_case_coverage': [{'matter_id': 'm1', 'source_quote': 'x', 'public_quote': quote}]}]}
        bound = bind_development({'matters': [], 'lawyers': []}, proposal)['candidates'][0]
        self.assertEqual(bound['submission_bio'], MERGED)
        self.assertIn(bound['submission_case_coverage'][0]['public_quote'], bound['submission_bio'])

    def test_repair_is_told_to_integrate_additions(self):
        self.assertIn('never repeat an existing sentence, or its opening, to introduce the addition', REPAIR_TASK)


class HeadshipIsNotAMandateLed(unittest.TestCase):
    BIO = ('Sofia Vega is a Partner and one of the heads of the firm’s Tax Department. ' + 'Her work spans audits and planning. ' * 40
           + 'She co-leads the matter, in which the Tax Department advises on the planning needed to manage income.')

    def test_leading_a_matter_is_not_a_second_headship(self):
        self.assertEqual([f for f in biography_shape.faults({'name': 'Sofia Vega', 'recommendation': 'present', 'submission_bio': self.BIO})
                          if f.startswith('B9 HEADSHIP')], [])
        self.assertFalse(states_headship('She co-leads the matter, in which the Tax Department advises.', 'Tax'))
        self.assertTrue(states_headship('She heads the Tax Department.', 'Tax'))

    def test_two_real_headship_statements_are_still_found(self):
        bio = self.BIO + ' She also leads the Tax practice.'
        self.assertTrue(any(f.startswith('B9 HEADSHIP') for f in biography_shape.faults(
            {'name': 'Sofia Vega', 'recommendation': 'present', 'submission_bio': bio})))


class RegisterVoiceInInstitutionalProse(unittest.TestCase):
    def test_register_wording_becomes_the_fact(self):
        cases = {
            'Vega is repeatedly listed as lead partner on mandates spanning audits and planning.':
                'Vega leads mandates spanning audits and planning.',
            'Ruiz is listed on lead roles involving municipal strategy.': 'Ruiz holds lead roles involving municipal strategy.',
            'Soto is listed on significant Tax mandates.': 'Soto acts on significant Tax mandates.',
            'They were also listed on several cross-border mandates.': 'They also acted on several cross-border mandates.',
            'Soto is observed in the scoped Chambers Tax Mexico profile as a Senior Statesperson.':
                'Soto is recognised in the Chambers Tax Mexico profile as a Senior Statesperson.',
            'In particular, the portfolio records tax analysis on an acquisition.':
                'In particular, the portfolio includes tax analysis on an acquisition.',
        }
        for source, expected in cases.items():
            self.assertEqual(natural_lead(source), expected)

    def test_facts_that_use_the_same_words_are_untouched(self):
        for text in ('The company is listed on the stock exchange as an issuer.', 'The issuer is listed on NASDAQ.',
                     'The client is listed on Caracas stock exchange and faces several tax matters.',
                     'The scoped review covered three fiscal years.', 'The audit was observed in the 2020 fiscal year.'):
            self.assertEqual(natural_lead(text), text)


if __name__ == '__main__':
    unittest.main()
