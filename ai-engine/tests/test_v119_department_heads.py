"""v1.0.119: a department head is recorded exactly as the form names them.

Real run 75b8ade5 (1.0.118, a second firm, loose documents): the form named the
head by given names only and the mandates named a lead partner whose full name
begins with them. B10 and C2 wrote that the fully named lawyer heads the
department; the final judge rejected both and nothing repaired them.
Synthetic names only.
"""
import unittest

from core import fact_sheet


def package(heads, lawyers=()):
    return {'firm_name': 'Example Firm', 'practice_area': 'Energy', 'lawyers': [{'name': n} for n in lawyers],
            'filing_details': {'heads': [{'name': h} for h in heads], 'num_partners': 2, 'num_lawyers': 3},
            'matters': [{'id': 'm1', 'client': 'Alpha Corp', 'leadPartner': 'Sofia Vega Ruiz', 'publication_route': 'D'},
                        {'id': 'm2', 'client': 'Beta Ltd', 'leadPartner': 'Ana Soto Mora and Sofia Vega Ruiz', 'publication_route': 'D'}]}


class DepartmentHeads(unittest.TestCase):
    def test_a_shorter_name_is_not_confirmed_as_the_longer_known_one(self):
        self.assertEqual(fact_sheet.department_heads(package(['Sofia Vega'])),
                         [{'name': 'Sofia Vega', 'not_confirmed_as': ['Sofia Vega Ruiz']}])

    def test_the_same_name_with_or_without_accents_is_the_same_person(self):
        self.assertEqual(fact_sheet.department_heads(package(['Sofía Vega Ruiz'])), [{'name': 'Sofía Vega Ruiz'}])
        self.assertEqual(fact_sheet.department_heads(package(['Ana Soto Mora'], lawyers=['Ana Soto Mora'])), [{'name': 'Ana Soto Mora'}])

    def test_a_head_who_leads_no_listed_mandate_is_kept_as_written(self):
        self.assertEqual(fact_sheet.department_heads(package(['Laura Paz Gil'])), [{'name': 'Laura Paz Gil'}])

    def test_placeholders_are_not_heads(self):
        self.assertEqual(fact_sheet.department_heads(package(['na', 'N/A', ''])), [])

    def test_the_sheet_carries_the_heads_and_the_rule_says_how_to_use_them(self):
        sheet = fact_sheet.build(package(['Sofia Vega']))
        self.assertEqual(sheet['case']['department_heads'], [{'name': 'Sofia Vega', 'not_confirmed_as': ['Sofia Vega Ruiz']}])
        self.assertIn('not_confirmed_as', fact_sheet.RULE)
        self.assertIn('do not write who heads', fact_sheet.RULE)
        self.assertNotIn('department_heads', fact_sheet.build(package([]))['case'])

    def test_a_biography_sheet_is_not_changed(self):
        sheet = fact_sheet.build(package(['Sofia Vega'], lawyers=['Sofia Vega Ruiz']), person='Sofia Vega Ruiz')
        self.assertNotIn('case', sheet)
        self.assertNotIn('department_head', sheet['lawyers'][0])


class PlainAspiration(unittest.TestCase):
    def test_c2_states_the_aspiration_without_first_time(self):
        from core.prose_rules import plain_aspiration, polish_proposal
        self.assertEqual(plain_aspiration('This record supports first-time recognition for Example Firm in Energy.'),
                         'This record supports recognition for Example Firm in Energy.')
        self.assertEqual(plain_aspiration('First-time recognition is warranted; a first-time inclusion would follow.'),
                         'Recognition is warranted; an inclusion would follow.')
        self.assertEqual(plain_aspiration('The practice merits being ranked for the first time.'), 'The practice merits being ranked.')
        untouched = 'The client obtained a permit for the first time in the state. This was the first time a court suspended the measure.'
        self.assertEqual(plain_aspiration(untouched), untouched)
        proposal = {'b10': 'The team secured the first-time listing of the issuer.', 'c2': 'This supports first-time recognition in Energy.',
                    'institutional_execution': [{'b10_quote': 'The team secured the first-time listing of the issuer.', 'c2_quote': 'This supports first-time recognition in Energy.'}]}
        fixed, _ = polish_proposal({'matters': [], 'lawyers': []}, proposal)
        self.assertEqual(fixed['c2'], 'This supports recognition in Energy.')
        self.assertEqual(fixed['institutional_execution'][0]['c2_quote'], 'This supports recognition in Energy.')
        self.assertEqual(fixed['b10'], proposal['b10'])   # B10 describes work; only C2 carries the aspiration


if __name__ == '__main__':
    unittest.main()
