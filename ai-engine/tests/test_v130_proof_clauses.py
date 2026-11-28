"""v1.0.130: the plan decides each lawyer's proof of each mandate; B9 and C2 cite it.

The v1.0.129 probes showed B9 re-telling the matters whatever surface rule it was
given (team as subject, then long sentences, then subordinate clauses), because it
received each matter's full narrative. These tests pin the new input contract.
"""
import copy
import unittest

from core import editorial_strategy as es

CLAUSE = 'led the constitutional challenge that preserved the client\'s non-financial services'


class ProofClauseSelection(unittest.TestCase):
    def test_a_usable_clause_is_kept_and_a_weak_one_falls_back_to_the_record(self):
        candidate = {'name': 'Ana Ruiz Soto', 'supporting_matters': [
            {'matter_id': 'm1', 'proof_clause': CLAUSE},
            {'matter_id': 'm2', 'proof_clause': ''},
            {'matter_id': 'm3', 'proof_clause': ' '.join(['word'] * (es.PROOF_LIMIT + 1))},
            {'matter_id': 'm4', 'proof_clause': 'was part of the team that obtained the permits'},
            {'matter_id': 'm1', 'proof_clause': 'a second clause for the same mandate'}]}
        self.assertEqual(es.proof_clauses(candidate), {'m1': CLAUSE, 'm4': 'was part of the team that obtained the permits'})
        self.assertEqual(es.proof_clauses(candidate, eligible={'m4'}), {'m4': 'was part of the team that obtained the permits'})
        self.assertEqual(es.proof_clauses({'name': 'x', 'supporting_matters': [{'matter_id': 'm1', 'personal_role': 'Lead'}]}), {})

    def test_the_record_keeps_identity_roles_stage_and_restrictions_but_not_the_narrative(self):
        matter = {'id': 'm1', 'client': 'Delta Bank', 'leadPartner': 'Ana Ruiz Soto', 'teamMembers': 'Bruno Lima',
                  'completionDate': 'Ongoing', 'value': 'Confidential', 'publish_status': 'publishable',
                  'confidentialityEvidence': {'basis': 'matter_field_or_heading'},
                  'summary': 'The team prepared expert testimony on the autonomy of state entities.',
                  'rawNotes': 'Long notes.', 'source_excerpt': 'D1 Name of client ...', 'otherInfo': 'More.'}
        record = es.proof_record(matter, CLAUSE)
        for key in ('summary', 'rawNotes', 'source_excerpt', 'otherInfo'):
            self.assertNotIn(key, record)
        for key in ('id', 'client', 'leadPartner', 'teamMembers', 'completionDate', 'value', 'publish_status', 'confidentialityEvidence'):
            self.assertEqual(record[key], matter[key])
        self.assertEqual(record['proof_clause'], CLAUSE)
        self.assertIn('summary', matter)  # the register itself is untouched

    def test_c2_receives_only_the_presented_lawyers_proofs(self):
        candidates = [{'name': 'Ana Ruiz Soto', 'recommendation': 'present', 'supporting_matters': [{'matter_id': 'm1', 'proof_clause': CLAUSE}]},
                      {'name': 'Carla Vega', 'recommendation': 'develop', 'supporting_matters': [{'matter_id': 'm2', 'proof_clause': CLAUSE}]},
                      {'name': 'Bruno Lima', 'recommendation': 'present', 'supporting_matters': [{'matter_id': 'm3'}]}]
        self.assertEqual(es.presented_proofs(candidates), {'Ana Ruiz Soto': [{'matter_id': 'm1', 'proof_clause': CLAUSE}]})


class ProofsAreSharedDecisions(unittest.TestCase):
    def test_an_entry_without_a_clause_serialises_as_before(self):
        from core.editorial_development import SupportingMatter
        plain = {'matter_id': 'm', 'personal_role': 'Lead', 'source_quote': 'q'}
        self.assertEqual(SupportingMatter.model_validate(plain).model_dump(), plain)
        self.assertEqual(SupportingMatter.model_validate({**plain, 'proof_clause': CLAUSE}).model_dump()['proof_clause'], CLAUSE)

    def test_a_repair_keeps_the_plan_clauses_and_cannot_add_one(self):
        current = {'name': 'Ana Ruiz Soto', 'supporting_matters': [
            {'matter_id': 'm1', 'personal_role': 'Lead', 'source_quote': 'q1', 'proof_clause': CLAUSE},
            {'matter_id': 'm2', 'personal_role': 'Team', 'source_quote': 'q2'}]}
        repaired = {'name': 'Ana Ruiz Soto', 'submission_bio': 'New text.', 'supporting_matters': [
            {'matter_id': 'm1', 'personal_role': 'Lead', 'source_quote': 'q1'},
            {'matter_id': 'm2', 'personal_role': 'Team', 'source_quote': 'q2', 'proof_clause': 'invented by the repair'}]}
        kept = es.keep_proofs(repaired, current)
        self.assertEqual(kept['supporting_matters'], current['supporting_matters'])
        self.assertEqual(kept['submission_bio'], 'New text.')
        self.assertNotIn('proof_clause', repaired['supporting_matters'][0])  # input untouched
        self.assertEqual(es.keep_proofs({'name': 'x'}, current), {'name': 'x'})

    def test_a_biography_repair_that_omits_the_clause_is_not_rejected(self):
        from core.editorial_repair import apply_corrections
        from test_editorial_construction import ConstructionTests
        _, v = ConstructionTests().fixture()
        v = copy.deepcopy(v)
        v['candidates'][0]['supporting_matters'][0]['proof_clause'] = CLAUSE
        target = {'current_value': copy.deepcopy(v['candidates'][0]), 'mutable_fields': ['submission_bio']}
        fixed = copy.deepcopy(v['candidates'][0])
        fixed['supporting_matters'][0].pop('proof_clause')
        fixed['submission_bio'] = fixed['submission_bio'] + ' She also leads the team.'
        result = apply_corrections(v, {'candidates/0': target}, {'corrections': [{'path': 'candidates/0', 'value': fixed, 'reason': 'Bio.'}]})
        self.assertEqual(result['candidates'][0]['supporting_matters'][0]['proof_clause'], CLAUSE)


class PlanAndWriters(unittest.TestCase):
    def test_the_plan_asks_for_the_clause_and_its_schema_carries_it(self):
        from core.editorial_construction import PLAN_TASK
        from core.editorial_development import SupportingMatter
        self.assertIn(es.PROOF_CLAUSES, PLAN_TASK)
        self.assertIn('proof_clause', SupportingMatter.model_fields)
        self.assertEqual(SupportingMatter(matter_id='m', personal_role='Lead', source_quote='q').proof_clause, '')

    def _run(self, clause):
        from core.editorial_construction import advance
        from test_editorial_construction import ConstructionTests
        case = ConstructionTests(); state, v = case.fixture(); calls = []
        v = copy.deepcopy(v)
        support = v['candidates'][0]['supporting_matters'][0]
        support['proof_clause'] = clause
        result = advance(state, case.provider(v, calls))
        return state, v, calls, result, support['matter_id']

    def test_b9_receives_the_clause_instead_of_the_narrative_and_c2_receives_the_proofs(self):
        state, v, calls, result, mid = self._run(CLAUSE)
        self.assertTrue(result['development_validated'], result['errors'])
        bio = next(p for name, p in calls if name == 'OwnedBiography')
        own = next(m for m in bio['package']['matters'] if m['id'] == mid)
        self.assertEqual(own['proof_clause'], CLAUSE)
        self.assertFalse(set(es.NARRATIVE_KEYS) & set(own))
        self.assertEqual(bio['proof_clauses'], {mid: CLAUSE})
        self.assertNotIn(mid, bio['mandate_results'])
        original = next(m for m in state['package']['matters'] if m['id'] == mid)
        self.assertTrue(any(k in original for k in ('summary', 'rawNotes', 'source_excerpt')))  # the case itself keeps it
        institutional = next(p for name, p in calls if name == 'InstitutionalProse')
        self.assertEqual(v['candidates'][0]['recommendation'], 'present')
        self.assertEqual(institutional['proof_clauses'][v['candidates'][0]['name']][0]['proof_clause'], CLAUSE)

    def test_without_a_clause_b9_reads_the_complete_record_as_before(self):
        state, v, calls, result, mid = self._run('')
        self.assertTrue(result['development_validated'], result['errors'])
        bio = next(p for name, p in calls if name == 'OwnedBiography')
        self.assertNotIn('proof_clauses', bio)
        original = next(m for m in state['package']['matters'] if m['id'] == mid)
        self.assertEqual(next(m for m in bio['package']['matters'] if m['id'] == mid), original)


if __name__ == '__main__':
    unittest.main()
