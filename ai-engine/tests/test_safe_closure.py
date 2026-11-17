"""Last-resort closure: withdraw only rejected sentences; never deliver a leak."""
import unittest
from unittest.mock import patch
from core import safe_closure as sc

BIO = ('José leads the department. He won a landmark ruling for SECRETCO in Zapopan. '
       'The source does not state the outcome of the appeal. He teaches amparo law.')
PROPOSAL = {'b10': 'Firm text.', 'c2': 'Coverage text.', 'matters': [],
            'candidates': [{'name': 'José', 'submission_bio': BIO,
                            'submission_case_coverage': [{'matter_id': 'm1', 'public_quote': 'He won a landmark ruling for SECRETCO in Zapopan.'},
                                                         {'matter_id': 'm2', 'public_quote': 'He teaches amparo law.'}]}]}


def findings(package, strategy, proposal):
    bio = proposal['candidates'][0]['submission_bio']
    return [{'matter_id': 'm1', 'path': 'candidates/0/submission_bio', 'metrics': [['place', 'zapopan']]}] if 'Zapopan' in bio else []


def facts(text):
    return {('place', 'zapopan')} if 'Zapopan' in text else set()


class SafeClosureTests(unittest.TestCase):
    def test_withdraws_only_leaking_and_auditor_sentences_and_their_bindings(self):
        with patch('core.public_privacy.public_privacy_findings', side_effect=findings), \
             patch('core.public_privacy.metric_facts', side_effect=facts):
            closed, withdrawn = sc.close_public_faults({}, {}, PROPOSAL)
        bio = closed['candidates'][0]['submission_bio']
        self.assertNotIn('Zapopan', bio)
        self.assertNotIn('does not state', bio)
        self.assertIn('José leads the department.', bio)
        self.assertIn('He teaches amparo law.', bio)
        self.assertEqual([w['reason'] for w in withdrawn], ['confidential_metrics', 'auditor_voice'])
        self.assertEqual([c['matter_id'] for c in closed['candidates'][0]['submission_case_coverage']], ['m2'])
        self.assertIn('Zapopan', PROPOSAL['candidates'][0]['submission_bio'])  # input untouched

    def test_a_leak_that_cannot_be_withdrawn_still_stops(self):
        always = lambda *a: [{'matter_id': 'm1', 'path': 'candidates/0/submission_bio', 'metrics': [['place', 'elsewhere']]}]
        with patch('core.public_privacy.public_privacy_findings', side_effect=always), \
             patch('core.public_privacy.metric_facts', side_effect=lambda t: set()):
            closed, _ = sc.close_public_faults({}, {}, PROPOSAL)
        self.assertIsNone(closed)

    def test_only_an_exhausted_complete_construction_is_closed(self):
        self.assertIsNone(sc.close_exhausted_development({}, {'errors': [], 'development': PROPOSAL}))
        self.assertIsNone(sc.close_exhausted_development({}, {'errors': ['x'], 'development_repair_unlocatable': True,
                                                               'development': PROPOSAL}))  # not a constructed proposal
        unknown = {'errors': ['x'], 'development_repair_unlocatable': True, 'trace': [{'usage': {'unknown_calls': 1}}],
                   'development': {**PROPOSAL, 'construction_contract': 'editorial-construction-v1'}}
        self.assertIsNone(sc.close_exhausted_development({}, unknown))


if __name__ == '__main__':
    unittest.main()
