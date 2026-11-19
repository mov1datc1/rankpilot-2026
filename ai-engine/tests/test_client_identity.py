"""v1.0.101: one client identity table for writer, validator and Word renderer."""
import json
import os
import unittest

from core.client_identity import client_aliases, same_entity, identity_basis, profile_identity_table
from core.candidate_evidence import profile_privacy_error, bind_profile_identities, retained_confidential_clients
from core.public_privacy import public_disclosure, metric_spans

FIXTURE = os.path.join(os.path.dirname(__file__), '..', '..', 'tests', 'fixtures', 'client-identities.json')
CONFIDENTIAL = {'publication_route': 'E', 'resolved_publication_status': 'confidential'}
PACKAGE = {'matters': [
    {'id': 'm1', 'client': 'GeNI de México, S.A de C.V.', **CONFIDENTIAL},
    {'id': 'm2', 'client': 'SCHAEFFLER', **CONFIDENTIAL},
    {'id': 'm3', 'client': 'SKF Industrial', **CONFIDENTIAL},
    {'id': 'm4', 'client': 'Volkswagen de México and VW Financial Services', **CONFIDENTIAL},
    {'id': 'm5', 'client': 'Open Foods', 'publish_status': 'publishable', 'publication_route': 'D'},
]}
PERSON = {'name': 'Ana Prado', 'bio': 'Ana advises GeNi, Scheaffler, SKF, Volkswagen and Megacable on collective bargaining. She was General Counsel at Example Motors.'}


def item(entity, decision='generalize', basis=None, relationship='client'):
    return {'reference': 'P01', 'relationship': relationship, 'entity_name': entity, 'decision': decision,
            'source_quote': PERSON['bio'].split('. ')[0] + '.', 'public_quote': 'Ana advises', 'reason': 'r', 'privacy_basis': basis}


class SharedAliasRule(unittest.TestCase):
    def test_python_aliases_match_the_word_renderer_fixture(self):
        fixture = json.load(open(FIXTURE, encoding='utf-8'))
        for case in fixture['aliases']:
            aliases = client_aliases([case['client']])
            for alias in case['includes']:
                self.assertIn(alias, aliases, case['client'])
        for case in fixture['excludes']:
            self.assertFalse(set(case['not']) & set(client_aliases([case['client']])), case['client'])


class ProfileSpellingsBindToTheRegister(unittest.TestCase):
    def test_deforest_profile_spellings_are_the_registered_clients(self):
        self.assertTrue(same_entity('GeNi', 'GeNI de México, S.A de C.V.'))
        self.assertTrue(same_entity('Scheaffler', 'SCHAEFFLER'))
        self.assertTrue(same_entity('SKF', 'SKF Industrial'))
        self.assertTrue(same_entity('Volkswagen', 'Volkswagen de México and VW Financial Services'))
        for other, registered in (('SK', 'SKF Industrial'), ('Grupo', 'Grupo Alfa'), ('Schaefer', 'SCHAEFFLER'),
                                  ('Volvo', 'Volkswagen de México'), ('Gen', 'GeNI de México, S.A de C.V.')):
            self.assertFalse(same_entity(other, registered), other)

    def test_the_previously_impossible_answers_now_validate(self):
        for entity, mid, quote in (('GeNi', 'm1', 'GeNI de México, S.A de C.V.'), ('Scheaffler', 'm2', 'SCHAEFFLER'),
                                   ('SKF', 'm3', 'SKF'), ('Volkswagen', 'm4', 'Volkswagen')):
            basis = {'kind': 'client_register', 'source_quote': quote, 'matter_id': mid}
            self.assertIsNone(profile_privacy_error(PERSON, item(entity, basis=basis), PACKAGE), entity)

    def test_a_wrong_matter_or_a_former_employer_still_fails(self):
        wrong = {'kind': 'client_register', 'source_quote': 'SKF', 'matter_id': 'm1'}
        self.assertIsNotNone(profile_privacy_error(PERSON, item('SKF', basis=wrong), PACKAGE))
        employer = {'kind': 'client_register', 'source_quote': 'Example Motors', 'matter_id': ''}
        self.assertIsNotNone(profile_privacy_error(PERSON, item('Example Motors', basis=employer, relationship='former_employer'), PACKAGE))

    def test_binding_fills_the_canonical_basis_only_toward_privacy(self):
        candidate = {'profile_coverage': [item('GeNi', basis={'kind': 'client_register', 'source_quote': 'GeNi', 'matter_id': 'x'}),
                                          item('Open Foods', basis=None), item('Megacable'),
                                          item('Example Motors', relationship='former_employer')]}
        bind_profile_identities(candidate, PACKAGE)
        bases = [c['privacy_basis'] for c in candidate['profile_coverage']]
        self.assertEqual(bases[0], {'kind': 'client_register', 'source_quote': 'GeNI de México, S.A de C.V.', 'matter_id': 'm1'})
        self.assertIsNone(bases[1])  # a publishable client is never generalised by code
        self.assertEqual(bases[2], {'kind': 'client_register', 'source_quote': 'Megacable', 'matter_id': ''})
        self.assertIsNone(bases[3])
        self.assertIsNone(profile_privacy_error(PERSON, candidate['profile_coverage'][2], PACKAGE))
        self.assertIsNone(identity_basis('Open Foods', PACKAGE))

    def test_writer_receives_the_identity_table_and_a_retained_confidential_client_is_flagged(self):
        table = profile_identity_table(PERSON, PACKAGE)
        self.assertEqual({r['profile_name'] for r in table}, {'GeNi', 'Scheaffler', 'SKF', 'Volkswagen'})
        self.assertNotIn('Example Motors', {r['profile_name'] for r in table})
        found = retained_confidential_clients({'profile_coverage': [item('SKF', 'retain'), item('Open Foods', 'retain')]}, PACKAGE)
        self.assertEqual(len(found), 1)
        self.assertIn('SKF', found[0])


class PublicViewOfConfidentialMatters(unittest.TestCase):
    def test_writer_receives_the_names_and_figures_that_stay_private(self):
        package = {'matters': [{'id': 'c1', 'client': 'Example Cable S.A. de C.V.', **CONFIDENTIAL,
                                'rawNotes': 'Strike threat across 3 plants; exposure of US$ 4.2 million; 2,300 employees; 35% wage claim. Filed 2024.'},
                               {'id': 'p1', 'client': 'Open Foods', 'publish_status': 'publishable', 'rawNotes': 'US$ 9 million'}]}
        view = public_disclosure(package, {'c1', 'p1'})
        self.assertEqual([v['matter_id'] for v in view], ['c1'])
        self.assertIn('Example Cable S.A. de C.V.', view[0]['client_names_not_public'])
        self.assertEqual(view[0]['figures_not_public'], ['US$ 4.2 million', '2,300 employees', '35%'])
        self.assertEqual(metric_spans('Filed in 2024 under article 123.'), [])


if __name__ == '__main__':
    unittest.main()
