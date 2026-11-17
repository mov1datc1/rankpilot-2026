"""Known-answer prose rules: same facts, natural wording, bindings always literal."""
import unittest

from core.prose_rules import (drop_value_lines, natural_lead, place_headship, polish_candidate,
                              polish_proposal, strip_hedges)


class LeadVocabularyTests(unittest.TestCase):
    def test_form_vocabulary_becomes_natural_verbs(self):
        cases = {
            'Ramos was named lead partner in two amparo proceedings.': 'Ramos led two amparo proceedings.',
            'Eduardo is named lead partner for a manufacturing client.': 'Eduardo leads the work for a manufacturing client.',
            'Eduardo is also named co-lead partner on an ongoing mandate.': 'Eduardo also co-leads an ongoing mandate.',
            'Ramos was named lead partner when neighbours sued.': 'Ramos led the matter when neighbours sued.',
            'He is named lead partner or co-lead partner on mandates.': 'He leads or co-leads mandates.',
            'Ana is the lead partner on the appeal.': 'Ana leads the appeal.',
            'He also served as lead partner for El Cielo in two amparos.': 'He also led the work for El Cielo in two amparos.',
            'Ramos further serves as lead partner in an indirect amparo.': 'Ramos further leads an indirect amparo.',
            'Ramos served as lead partner when neighbours sued.': 'Ramos led the matter when neighbours sued.',
            'he serves as lead partner while the firm defends the client.': 'he leads the matter while the firm defends the client.',
            'As lead partner in a confidential matter, he oversees strategy.': 'Leading a confidential matter, he oversees strategy.',
            'He is also lead partner for an association.': 'He also leads the work for an association.',
            'Ramos is lead partner in an amparo.': 'Ramos leads an amparo.',
            'José Pablo Ramos Castillo is the lead partner, supported by Edgar Moro.': 'José Pablo Ramos Castillo leads the matter, supported by Edgar Moro.',
            'Jaime Bustamante was the lead partner.': 'Jaime Bustamante led the matter.',
            'Ramos Castillo has been lead partner on challenges to decrees.': 'Ramos Castillo has led challenges to decrees.',
            'He has also been the lead partner for a developer.': 'He has also led the work for a developer.',
            'Eduardo Garduño and Carlos Rivera were the lead partners on the matter.': 'Eduardo Garduño and Carlos Rivera co-led the matter.',
            'Javier was the lead partner, with Yrelia Barrón as a team member.': 'Javier led the matter, with Yrelia Barrón as a team member.',
        }
        for before, after in cases.items():
            with self.subTest(before=before):
                self.assertEqual(natural_lead(before), after)

    def test_numbers_and_names_are_never_touched(self):
        text = 'Ramos was named lead partner in a USD 172,37,026.00 dispute for Grupo Alfa.'
        self.assertIn('USD 172,37,026.00', natural_lead(text))
        self.assertIn('Grupo Alfa', natural_lead(text))

    def test_auditor_hedges_are_removed(self):
        self.assertEqual(strip_hedges('The record confirms that the firm secured the ruling.'), 'The firm secured the ruling.')
        self.assertEqual(strip_hedges('The team is described as having secured approval.'), 'The team secured approval.')

    def test_firm_reports_that_is_an_auditor_hedge(self):
        self.assertEqual(strip_hedges('he oversees the challenge; the firm reports that its argument secured restitution.'),
                         'he oversees the challenge; its argument secured restitution.')
        self.assertEqual(strip_hedges('The firm reports that the court granted relief.'), 'The court granted relief.')

    def test_duplicated_value_sentence_is_dropped(self):
        text = 'The firm obtained the suspension. The stated value was USD 2 million.'
        self.assertEqual(drop_value_lines(text), 'The firm obtained the suspension.')


class CandidateTests(unittest.TestCase):
    package = {'practice_area': 'Real Estate', 'filing_details': {'heads': [{'name': 'Ana Ruiz'}]}}

    def test_confirmed_head_is_placed_in_the_opening(self):
        candidate = {'name': 'Ana Ruiz', 'submission_bio': 'Ana Ruiz advises developers.'}
        result, placed = place_headship(candidate, self.package)
        self.assertTrue(placed)
        self.assertEqual(result['submission_bio'], 'Ana Ruiz, head of the Real Estate practice, advises developers.')

    def test_head_already_stated_or_not_confirmed_is_left_alone(self):
        stated = {'name': 'Ana Ruiz', 'submission_bio': 'Ana Ruiz heads the real estate practice.'}
        self.assertFalse(place_headship(stated, self.package)[1])
        other = {'name': 'Luis Mora', 'submission_bio': 'Luis Mora advises developers.'}
        self.assertFalse(place_headship(other, self.package)[1])

    def test_bindings_follow_the_rewritten_sentence(self):
        candidate = {'name': 'Ana Ruiz', 'submission_bio': 'Ana Ruiz advises developers. Ana was named lead partner in two amparo proceedings filed in 2021.',
                     'submission_case_coverage': [{'public_quote': 'Ana was named lead partner in two amparo proceedings filed in 2021.'}]}
        result, info = polish_candidate(candidate, {})
        self.assertTrue(info['changed'])
        quote = result['submission_case_coverage'][0]['public_quote']
        self.assertIn(quote, result['submission_bio'])
        self.assertIn('2021', quote)

    def test_rewrite_is_undone_when_a_binding_would_break(self):
        candidate = {'name': 'Ana Ruiz', 'submission_bio': 'Ana was named lead partner in an appeal.',
                     'profile_coverage': [{'public_quote': 'named lead partner'}]}
        result, info = polish_candidate(candidate, {})
        self.assertFalse(info['changed'])
        self.assertEqual(result, candidate)


class SharedIdentityTests(unittest.TestCase):
    def test_same_university_line_inherits_no_identity_of_its_own(self):
        from core.prose_rules import shared_identity
        candidate = {'profile_coverage': [
            {'decision': 'retain', 'entity_name': 'Universidad Panamericana', 'source_quote': 'Law degree from Universidad Panamericana.'},
            {'decision': 'retain', 'entity_name': 'Universidad Panamericana', 'source_quote': 'Postgraduate studies from the same University.'},
            {'decision': 'generalize', 'entity_name': 'Client X', 'source_quote': 'Advised a client.'}]}
        result, fixed = shared_identity(candidate)
        self.assertEqual(fixed, 1)
        self.assertEqual(result['profile_coverage'][1]['entity_name'], '')
        self.assertEqual(result['profile_coverage'][2]['entity_name'], 'Client X')  # privacy decisions untouched

    def test_an_entity_owned_by_no_unit_is_left_for_the_validator(self):
        from core.prose_rules import shared_identity
        candidate = {'profile_coverage': [{'decision': 'retain', 'entity_name': 'Invented SA', 'source_quote': 'He advised developers.'}]}
        self.assertEqual(shared_identity(candidate)[1], 0)


class ProposalTests(unittest.TestCase):
    def test_value_line_is_dropped_only_when_the_matter_has_a_value(self):
        package = {'matters': [{'id': 'm1', 'value': 'USD 2 million'}, {'id': 'm2', 'value': ''}]}
        text = 'The firm won. The stated value was USD 2 million.'
        proposal = {'matters': [{'matter_id': 'm1', 'text': text}, {'matter_id': 'm2', 'text': text}]}
        result, _ = polish_proposal(package, proposal)
        self.assertEqual(result['matters'][0]['text'], 'The firm won.')
        self.assertEqual(result['matters'][1]['text'], text)

    def test_institutional_quote_stays_literal_or_the_field_is_restored(self):
        b10 = 'The record confirms that the team won the appeal.'
        proposal = {'b10': b10, 'c2': '', 'institutional_execution': [{'b10_quote': 'The record confirms that the team won'}]}
        result, _ = polish_proposal({}, proposal)
        self.assertIn(result['institutional_execution'][0]['b10_quote'], result['b10'])


if __name__ == '__main__':
    unittest.main()
