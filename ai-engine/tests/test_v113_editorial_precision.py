"""v1.0.113: surgical editorial fixes from three real test cases. Synthetic names only."""
import unittest

from core.prose_rules import natural_lead
from core.editorial_development import submission_voice_paths
from core.audit_decisions import _current_position
from core.editorial_case import additional_leaders
from core.editorial_construction import PLAN_TASK, MATTER_TASK, INSTITUTION_TASK, bio_task
from core import audit_construction as ac


class RoleIsAFactNotARegistryEntry(unittest.TestCase):
    def test_registry_verbs_about_a_lead_role_are_removed(self):
        cases = {
            'Vega is listed as a lead partner, alongside Ana Ríos, on the representation of Alfa.':
                'Vega is a lead partner, alongside Ana Ríos, on the representation of Alfa.',
            'In that matter, Vega is listed as one of three lead partners.':
                'In that matter, Vega is one of three lead partners.',
            'Vega is listed among the lead partners on the advice to Beta.':
                'Vega is among the lead partners on the advice to Beta.',
            'He is further listed among the team members on an ongoing matter.':
                'He is further among the team members on an ongoing matter.',
        }
        for source, expected in cases.items():
            self.assertEqual(natural_lead(source), expected)

    def test_facts_and_unrelated_sentences_are_untouched(self):
        for text in ('The company is listed on the stock exchange as an issuer.',
                     'The property was recorded as a federal zone.',
                     'She led the audit, which closed at 1% of the assessment.'):
            self.assertEqual(natural_lead(text), text)

    def test_sentences_about_the_record_are_detected_as_auditor_voice(self):
        for text in ('The outcomes are attributed in the records to the firm.',
                     'Her role is recorded separately as lead partner.',
                     'The matter is recorded with a date of May 2024.',
                     'Vega is listed as a lead partner on the matter.'):
            self.assertEqual(submission_voice_paths({'b10': text, 'c2': ''}), ['b10'], text)
        self.assertEqual(submission_voice_paths({'b10': 'She co-led the audit, which closed at 1% of the assessment.', 'c2': ''}), [])


class DeclaredIndividualRanking(unittest.TestCase):
    def test_declared_ranked_is_not_printed_as_undeclared(self):
        text = _current_position('Declared as Ranked in the supplied lawyer record; no exact individual match was verified.')
        self.assertIn('la firma lo declara rankeado', text)
        self.assertNotIn('sin ranking declarado', text)

    def test_declared_not_ranked(self):
        self.assertIn('la firma lo declara sin ranking', _current_position('Not ranked (declared); no exact individual match was verified.'))

    def test_previous_wordings_are_unchanged(self):
        self.assertIn('sin ranking declarado', _current_position('No verified current individual ranking supplied.'))
        self.assertEqual(_current_position('Band 2 (verificado en la tabla 2027)'), 'Band 2 (verificado en la tabla 2027)')


class OtherLeadersAreWholePeople(unittest.TestCase):
    def test_titles_in_parentheses_do_not_split_a_person(self):
        package = {'lawyers': [{'name': 'Ana Ríos Paz'}],
                   'matters': [{'id': 'm1', 'leadPartner': 'Ana Ríos (Senior Partner, member of the Executive Committee) and Luis Mora (Corporate Senior Partner, member of the Board)',
                                'source_excerpt': 'Lead partners: Ana Ríos (Senior Partner, member of the Executive Committee) and Luis Mora (Corporate Senior Partner, member of the Board).'}]}
        strategy = {'matters': [{'matter_id': 'm1', 'disposition': 'core'}]}
        self.assertEqual([x['name'] for x in additional_leaders(package, strategy)], ['Luis Mora'])

    def test_list_with_a_final_conjunction(self):
        package = {'lawyers': [], 'matters': [{'id': 'm1', 'leadPartner': 'Ana Ríos (Partner), Luis Mora (Partner), and Eva Sanz (Partner)',
                   'source_excerpt': 'Ana Ríos, Luis Mora and Eva Sanz lead the matter.'}]}
        strategy = {'matters': [{'matter_id': 'm1', 'disposition': 'core'}]}
        self.assertEqual([x['name'] for x in additional_leaders(package, strategy)], ['Ana Ríos', 'Luis Mora', 'Eva Sanz'])


class WritersReceiveTheRules(unittest.TestCase):
    def test_plan_reads_the_whole_record_and_keeps_requested_categories(self):
        self.assertIn('ONE unit of evidence across all its fields', PLAN_TASK)
        self.assertIn('the firm itself requests for a named lawyer', PLAN_TASK)

    def test_matter_writer_may_use_the_whole_record(self):
        self.assertIn('not its limit', MATTER_TASK)
        self.assertIn('result stated in the status', MATTER_TASK)

    def test_bio_states_role_as_fact_and_result_as_mandate_outcome(self):
        task = bio_task()
        self.assertIn('participation becomes a positioning argument', task)
        self.assertIn('never called confidential', task)

    def test_c2_argues_first_and_never_mentions_first_time(self):
        self.assertIn('seeking first-time', INSTITUTION_TASK)
        self.assertIn('Never open with the request', INSTITUTION_TASK)
        self.assertIn('naming the confirmed practice\nheads early', INSTITUTION_TASK)

    def test_audit_separates_leadership_from_execution(self):
        self.assertIn('verb of personal\nexecution', ac.TASK)
        self.assertIn('leading a matter is not personally performing each act', ac.REVIEW_TASK)



class AuditExplainsPortfolioDecisions(unittest.TestCase):
    PLAN = {'portfolio': {f'P{i}': {} for i in range(9)}, 'people': [{'contributions': {}}], 'leaders': {}, 'comparisons': {f'C{i}': {} for i in range(6)}}

    def test_budgets_leave_room_for_the_reasoning(self):
        words = ac.budgets(self.PLAN)
        self.assertGreaterEqual(words['portfolio'], 80)
        self.assertGreaterEqual(words['comparison'], 80)
        large = ac.budgets({**self.PLAN, 'portfolio': {f'P{i}': {} for i in range(20)}})
        self.assertGreaterEqual(large['portfolio'], 45)

    def test_writer_must_explain_position_reserve_and_exclusion(self):
        self.assertIn('WHY it holds this place in the portfolio', ac.TASK)
        self.assertIn('The value of an asset alone is not competitive relevance', ac.TASK)
        self.assertIn('the selected matter was preferred', ac.TASK)
        self.assertIn('names every excluded matter', ac.TASK)

    def test_one_ceiling_everywhere(self):
        from core.review_graph import AUDIT_WORD_LIMIT
        self.assertEqual(ac.WORD_LIMIT, AUDIT_WORD_LIMIT)
        self.assertEqual(ac.WORD_LIMIT, 2600)


class BandNumberWithinTheObservedTable(unittest.TestCase):
    def test_band_beyond_the_official_table_becomes_its_lowest_band(self):
        from core.editorial_construction import reconcile_categories
        verification = {'market_context': {'competitors': [{'band': 'Band 1'}, {'band': 'Band 3'}, {'band': 'Band 4'}]}}
        plan = {'candidates': [{'name': 'Ana Ríos', 'recommendation': 'present', 'suggested_ranking': 'Band 5 candidate',
                                'category_rationale': 'Band 5 candidate is an editorial target.'}]}
        fixed = reconcile_categories(plan, {'directory': 'Chambers', 'practice_area': 'Zeta', 'jurisdiction': 'Nowhere'}, verification)['candidates'][0]
        self.assertEqual(fixed['suggested_ranking'], 'Band 4 candidate')
        self.assertIn('Band 4', fixed['category_rationale'])

    def test_no_table_information_changes_nothing(self):
        from core.editorial_construction import reconcile_categories
        plan = {'candidates': [{'name': 'Ana Ríos', 'recommendation': 'present', 'suggested_ranking': 'Band 5 candidate', 'category_rationale': 'x'}]}
        self.assertEqual(reconcile_categories(plan, {'directory': 'Chambers', 'practice_area': 'Zeta', 'jurisdiction': 'Nowhere'}, {})['candidates'][0]['suggested_ranking'], 'Band 5 candidate')


if __name__ == '__main__':
    unittest.main()
