"""v1.0.126: contradictions between roles found across the real runs of several
practice areas (27 Nov). Synthetic names."""
import inspect
import unittest

from core import audit_construction as ac
from core import audit_decisions, editorial_construction as ec, fact_sheet, public_privacy
from core.editorial_development import MatterDraft


class ConfidentialValueHasOneRule(unittest.TestCase):
    def test_no_writer_is_told_to_give_a_confidential_amount_a_size(self):
        bio = ec.bio_task()
        self.assertNotIn('a multi-million-dollar exposure', bio)
        self.assertIn('has no size at all in public text', bio)
        self.assertIn('A non-monetary figure', bio)
        self.assertIn('no size at all (no\n"substantial"', ec.INSTITUTION_TASK)
        self.assertNotIn('state scale qualitatively instead;', ec.INSTITUTION_TASK)
        self.assertIn('a monetary amount no size at all', inspect.getsource(public_privacy))
        self.assertIn('never describe its size in words', inspect.getsource(fact_sheet))


class AuditHasRoomForThePeerContrasts(unittest.TestCase):
    STATE = {'package': {}, 'ranking_verification': {'profile_research': {'profiles': [
        {'subject': {'kind': 'competitor', 'name': 'Firm One'}, 'status': 'retrieved', 'commentary': 'Known for audits.'},
        {'subject': {'kind': 'competitor', 'name': 'Firm Two'}, 'status': 'retrieved', 'commentary': 'Known for M&A tax.'},
        {'subject': {'kind': 'competitor', 'name': 'Firm Three'}, 'status': 'retrieved', 'commentary': ''},
        {'subject': {'kind': 'firm', 'name': 'Our Firm'}, 'status': 'retrieved', 'commentary': 'Ours.'}]}}}

    def test_peers_with_commentary_raise_the_budget_and_the_cap(self):
        self.assertEqual(ac.peer_profiles(self.STATE), ['Firm One', 'Firm Two'])
        plan = {'peers': ac.peer_profiles(self.STATE)}
        self.assertEqual(ac.executive_words(plan), 340)
        self.assertEqual(ac.executive_chars(plan), 3900)
        self.assertEqual(ac.word_limit(self.STATE), ac.WORD_LIMIT + 120)
        self.assertEqual(ac.word_limit({'package': {}}), ac.WORD_LIMIT)

    def test_writers_are_told_about_the_peer_allowance(self):
        self.assertIn('plus about 60 words for each profile in\npeer_profiles', ac.TASK)
        self.assertIn('plus about 60\nwords for each retrieved peer profile', audit_decisions.WRITING_TASK)


class FirmStaysTheActor(unittest.TestCase):
    def test_matter_rules_keep_the_firm_as_actor(self):
        self.assertIn('never make the client its subject', MatterDraft.model_fields['text'].description)
        self.assertIn('never removes the firm as the actor of its work', ec.MATTER_TASK)


class FirmRequestedCategories(unittest.TestCase):
    PACKAGE = {'lawyers': [{'name': 'Ana María Ruiz Calvo'}, {'name': 'Bruno Soto Lima'}, {'name': 'Carla Inés Soto Vidal'}],
               'c2_source': 'Our practice is strong. In particular, we believe that Ms. Ana María Ruiz deserves to be recognised in Band 1, '
                            'and Carla Inés Soto should be highlighted as an associate to watch. Bruno Soto Lima is a Senior Statesperson.'}

    def test_requests_are_found_per_lawyer_and_descriptions_are_not_requests(self):
        found = fact_sheet.firm_requests(self.PACKAGE)
        self.assertIn('ana maria ruiz calvo', found)
        self.assertIn('carla ines soto vidal', found)
        self.assertNotIn('bruno soto lima', found)
        self.assertTrue(found['ana maria ruiz calvo'][0].startswith('In particular, we believe that Ms. Ana María Ruiz'))

    def test_the_audit_explains_a_different_decision(self):
        self.assertIn("the Audit's\nassessment of that person states what the firm asked for", fact_sheet.RULE)
        sheet = fact_sheet.build(self.PACKAGE, {}, None)
        by = {l['name']: l for l in sheet['lawyers']}
        self.assertIn('firm_request', by['Ana María Ruiz Calvo'])
        self.assertNotIn('firm_request', by['Bruno Soto Lima'])


class CurrentRankingIsEvidence(unittest.TestCase):
    def test_a_current_ranking_before_the_close_is_allowed(self):
        c2 = 'Ranked in Band 2, the practice leads complex audits.\n\nThe breadth of this work is that of a Band 1 practice.'
        self.assertEqual(ec.aspiration_faults({}, {'c2': c2}), [])


if __name__ == '__main__':
    unittest.main()
