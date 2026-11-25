"""v1.0.117: one record of confirmed facts for every writer and reviewer (synthetic names)."""
import unittest

from core import fact_sheet
from core.editorial_construction import INSTITUTION_TASK
from core.prose_rules import natural_lead, polish_proposal, source_lead

PACKAGE = {
    'firm_name': 'Example Firm', 'practice_area': 'Tax',
    'filing_details': {'heads': [{'name': 'Sofía Vega Ruiz'}], 'num_partners': '2', 'num_lawyers': '5'},
    'ranking_verification': {'individuals': [
        {'status': 'verified_mismatch', 'lawyer_name': 'Sofia Vega Ruiz', 'observed_band': 'Band 2'},
        {'status': 'not_found', 'lawyer_name': 'Ana Soto Lara', 'observed_band': None}]},
    'lawyers': [{'name': 'Sofia Vega Ruiz', 'role': 'Partner', 'current_ranking': 'Ranked'},
                {'name': 'Ana Soto Lara', 'role': 'Partner', 'current_ranking': 'Not ranked'},
                {'name': 'Luis Mora Paz', 'role': 'Associate'}],
    'matters': [
        {'id': 'm1', 'client': 'Alfa Bebidas & Filiales', 'publish_status': 'publishable', 'value': 'Confidential',
         'leadPartner': 'Sofia Vega (Senior Partner, member of the Executive Committee), Ana Soto (Senior Partner) and Pedro Lugo (Senior Partner).',
         'teamMembers': 'Luis Mora Paz (Associate)'},
        {'id': 'm2', 'client': 'Beta Consultores', 'publish_status': 'publishable', 'value': 'USD 2,000,000',
         'leadPartner': 'Sofia Vega Ruiz (Senior Partner)', 'teamMembers': 'Ana Soto Lara; Luis Mora Paz'},
        {'id': 'm3', 'client': 'Gamma Holdings, C.A.', 'publish_status': 'confidential', 'publication_route': 'E',
         'leadPartner': 'Ana Soto Lara', 'teamMembers': ''},
        {'id': 'm4', 'client': 'Delta Excluded', 'publish_status': 'publishable', 'leadPartner': 'Ana Soto Lara'}],
}
STRATEGY = {'matters': [{'matter_id': 'm1', 'disposition': 'core'}, {'matter_id': 'm2', 'disposition': 'core'},
                        {'matter_id': 'm3', 'disposition': 'reserve'}, {'matter_id': 'm4', 'disposition': 'excluded'}]}
DEVELOPMENT = {'candidates': [{'name': 'Sofia Vega Ruiz', 'recommendation': 'present', 'suggested_ranking': 'Band 1'},
                              {'name': 'Luis Mora Paz', 'recommendation': 'develop', 'suggested_ranking': 'Category pending'}]}


def lawyer(sheet, name):
    return next(l for l in sheet['lawyers'] if l['name'] == name)


class SheetReadsSavedFieldsOnly(unittest.TestCase):
    def test_titles_in_parentheses_are_not_names(self):
        self.assertEqual(fact_sheet.listed_names(PACKAGE['matters'][0]['leadPartner']), ['Sofia Vega', 'Ana Soto', 'Pedro Lugo'])
        self.assertEqual(fact_sheet.listed_names('Lead partner: N/A'), [])

    def test_a_shortened_name_matches_only_one_roster_lawyer(self):
        roster = {'sofia vega ruiz': 1, 'ana soto lara': 1, 'ana soto mora': 1}
        self.assertEqual(fact_sheet.roster_match('Sofía Vega', roster), 'sofia vega ruiz')
        self.assertIsNone(fact_sheet.roster_match('Ana Soto', roster))
        self.assertIsNone(fact_sheet.roster_match('Pedro Lugo', roster))

    def test_who_leads_alone_who_co_leads_and_who_is_on_the_team(self):
        sheet = fact_sheet.build(PACKAGE, STRATEGY, DEVELOPMENT)
        vega = lawyer(sheet, 'Sofia Vega Ruiz')
        self.assertEqual(vega['leads_alone'], ['Beta Consultores'])
        self.assertEqual(vega['co_leads'], [{'client': 'Alfa Bebidas & Filiales', 'with': ['Ana Soto Lara', 'Pedro Lugo']}])
        self.assertTrue(vega['department_head'])
        self.assertIn('Band 2 (verified', vega['verified_ranking'])
        self.assertIn('declared by the firm, not verified', vega['declared_ranking'])
        self.assertEqual(vega['current_decision'], {'recommendation': 'present', 'category': 'Band 1'})
        soto = lawyer(sheet, 'Ana Soto Lara')
        self.assertEqual(soto['leads_alone'], ['Gamma Holdings, C.A.'])
        self.assertEqual(soto['team_member'], ['Beta Consultores'])
        self.assertNotIn('verified_ranking', soto)
        self.assertNotIn('department_head', soto)
        self.assertEqual(lawyer(sheet, 'Luis Mora Paz')['team_member'], ['Alfa Bebidas & Filiales', 'Beta Consultores'])

    def test_publication_value_and_selection_come_from_the_register(self):
        sheet = fact_sheet.build(PACKAGE, STRATEGY)
        clients = {c['client']: c for c in sheet['clients']}
        self.assertEqual(set(clients), {'Alfa Bebidas & Filiales', 'Beta Consultores', 'Gamma Holdings, C.A.'})
        self.assertEqual(clients['Alfa Bebidas & Filiales']['publication'], 'publishable')
        self.assertIn('never stated', clients['Alfa Bebidas & Filiales']['value'])
        self.assertNotIn('value', clients['Beta Consultores'])
        self.assertEqual(clients['Gamma Holdings, C.A.']['publication'], 'confidential')
        self.assertEqual(clients['Gamma Holdings, C.A.']['selection'], 'reserve')
        self.assertEqual(sheet['case']['department_size'], {'partners': '2', 'other_lawyers': '5'})

    def test_a_biography_receives_its_own_lawyer_only(self):
        sheet = fact_sheet.build(PACKAGE, STRATEGY, person='Ana Soto Lara')
        self.assertEqual([l['name'] for l in sheet['lawyers']], ['Ana Soto Lara'])
        self.assertEqual({c['client'] for c in sheet['clients']}, {'Alfa Bebidas & Filiales', 'Beta Consultores', 'Gamma Holdings, C.A.'})
        self.assertNotIn('case', sheet)


class WhoReceivesTheSheet(unittest.TestCase):
    STATE = {'package': PACKAGE, 'strategy': STRATEGY}

    def test_writers_reviewers_and_the_judge_receive_it(self):
        for role in ('development', 'repair', 'writer', 'field_reviewer', 'editor'):
            self.assertEqual(fact_sheet.for_call(self.STATE, role, {})['version'], fact_sheet.VERSION, role)
        self.assertIsNone(fact_sheet.for_call(self.STATE, 'strategist', {}))
        self.assertIsNone(fact_sheet.for_call(self.STATE, 'editor', {'fact_sheet': {}}))
        self.assertIsNone(fact_sheet.for_call({'package': {}}, 'editor', {}))

    def test_scope_by_unit(self):
        bio = fact_sheet.for_call({**self.STATE, 'rag_unit': 'bio'}, 'development', {'shared_decision': {'name': 'Luis Mora Paz'}})
        self.assertEqual([l['name'] for l in bio['lawyers']], ['Luis Mora Paz'])
        self.assertIsNone(fact_sheet.for_call({**self.STATE, 'rag_unit': 'matters'}, 'development', {}))
        self.assertIsNone(fact_sheet.for_call(self.STATE, 'field_reviewer', {'units': [{'field': 'matters/0/text'}, {'field': 'comparisons/1/tradeoff'}]}))
        self.assertIsNotNone(fact_sheet.for_call(self.STATE, 'field_reviewer', {'units': [{'field': 'b10'}, {'field': 'c2'}]}))

    def test_the_rule_names_the_three_roles_and_the_decision(self):
        flat = ' '.join(fact_sheet.RULE.split())
        for text in ('"leads" a mandate only when it is in leads_alone', '"co-leads" it when it is in co_leads',
                     'a client is confidential only when its publication is confidential',
                     'a category is stated only as the current decision gives it', 'never replaces the sources'):
            self.assertIn(text, flat)
        self.assertIn('contradicts fact_sheet is a concrete defect', ' '.join(fact_sheet.REVIEW_RULE.split()))


class TheRealCallCarriesTheSheet(unittest.TestCase):
    def call(self, role, state, payload):
        from types import SimpleNamespace
        from unittest.mock import patch
        from core.review_graph import invoke_role
        from core.editorial_repair import Repair
        raw = SimpleNamespace(usage_metadata=None, response_metadata={})
        with patch('core.review_graph.RAGRouter.get_rag_context', return_value=''), patch('core.review_graph.create_chat_model') as model:
            model.return_value.with_structured_output.return_value.invoke.return_value = {
                'parsed': {'corrections': [], 'unresolved': ['Offline fixture']}, 'raw': raw}
            invoke_role(state, role, Repair, 'TASK TEXT', payload)
        return model.return_value.with_structured_output.return_value.invoke.call_args.args[0]

    def test_a_writer_call_has_the_sheet_and_its_rule(self):
        messages = self.call('repair', {'package': PACKAGE, 'strategy': STRATEGY}, {'repair_targets': {}})
        self.assertIn('"fact_sheet"', messages[1][1])
        self.assertIn('"leads_alone":["Beta Consultores"]', messages[1][1])
        self.assertIn('FACT SHEET: fact_sheet is the application', messages[0][1])
        self.assertNotIn('contradicts fact_sheet is a concrete defect', ' '.join(messages[0][1].split()))

    def test_a_selection_call_is_unchanged(self):
        messages = self.call('strategist', {'package': PACKAGE, 'strategy': STRATEGY}, {'x': 1})
        self.assertNotIn('fact_sheet', messages[1][1])
        self.assertNotIn('FACT SHEET', messages[0][1])


class LeadRewriteKnowsTheSource(unittest.TestCase):
    def test_co_led_mandates_are_never_written_as_led(self):
        cases = {
            'Sofia Vega Ruiz is listed as lead partner on the Alfa Bebidas mandate.': 'Sofia Vega Ruiz co-leads the Alfa Bebidas mandate.',
            'Vega Ruiz is lead partner on the Beta Consultores mandate.': 'Vega Ruiz leads the Beta Consultores mandate.',
            'Sofia Vega Ruiz is lead partner on the Alfa Bebidas and Beta Consultores mandates, as well as on confidential work.':
                'Sofia Vega Ruiz is a lead partner on the Alfa Bebidas and Beta Consultores mandates, as well as on confidential work.',
            'Vega Ruiz is repeatedly listed as lead partner on mandates spanning audits and planning.':
                'Vega Ruiz leads mandates spanning audits and planning.',
        }
        for source, expected in cases.items():
            self.assertEqual(source_lead(source, PACKAGE), expected)

    def test_a_biography_uses_its_own_lawyer(self):
        self.assertEqual(source_lead('She was named lead partner in the Alfa Bebidas audit.', PACKAGE, 'Sofia Vega Ruiz'), 'She co-led the Alfa Bebidas audit.')
        self.assertEqual(source_lead('She was named lead partner in the Beta Consultores audit.', PACKAGE, 'Sofia Vega Ruiz'), 'She led the Beta Consultores audit.')
        self.assertEqual(source_lead('She is co-lead partner on the Alfa Bebidas mandate.', PACKAGE, 'Sofia Vega Ruiz'), 'She co-leads the Alfa Bebidas mandate.')

    def test_text_without_the_form_wording_is_unchanged_and_whitespace_is_kept(self):
        text = 'She led the audit, which closed at 1% of the assessment.\n\nThe company is listed on the stock exchange.'
        self.assertEqual(source_lead(text, PACKAGE), text)
        self.assertEqual(source_lead(text, PACKAGE), natural_lead(text))

    def test_institutional_prose_is_polished_with_the_source(self):
        proposal = {'candidates': [], 'matters': [], 'institutional_execution': [],
                    'b10': 'Example Firm advises on tax.', 'c2': 'Ana Soto Lara is listed as lead partner on the Alfa Bebidas mandate.'}
        polished, _ = polish_proposal(PACKAGE, proposal)
        self.assertEqual(polished['c2'], 'Ana Soto Lara co-leads the Alfa Bebidas mandate.')


class C2NamesOnlyDecidedCategories(unittest.TestCase):
    def test_the_category_comes_from_the_shared_decision(self):
        flat = ' '.join(INSTITUTION_TASK.split())
        self.assertIn('An individual category comes ONLY from shared_decisions', flat)
        self.assertIn('receives no category or recognition request in C2, even when the firm\'s own text asks for one', flat)
        self.assertNotIn('any category the firm itself requests for a lawyer', flat)


if __name__ == '__main__':
    unittest.main()
