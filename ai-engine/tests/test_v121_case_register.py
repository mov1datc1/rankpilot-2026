"""v1.0.121: one case register read before writing; every role uses it.

Evidence (two real runs of one firm, 26 Nov 2026): a word of a client's
description was anonymised as a client in the Word ("maintained a confidential
entity continuity"); lead partners answered "na" in the wizard were printed and
left the fact sheet without leaders; a mandate closed before the research period
stayed in the portfolio; a matter the source calls "strictly confidential" was
asked to be described by one reviewer and withdrawn by another. All names below
are synthetic.
"""
import unittest

from core import case_register as cr
from core import fact_sheet
from core.client_identity import clean_name, client_aliases
from core.editorial_case import support_ids
from core.editorial_role_policy import role_base

PERIOD = {'from': '2025-11-26', 'to': '2026-11-26'}


def package():
    return {
        'firm_name': 'Ejemplo Abogados', 'research_period': dict(PERIOD),
        'b10_source': 'The practice is run day to day by Lucia Prado, a senior associate with 16 years of experience.',
        'filing_details': {'heads': [{'name': 'Ana Ruiz', 'email': 'Na', 'phone': 'NA'}]},
        'lawyers': [{'name': 'Ana Ruiz', 'role': 'Partner'}, {'name': 'Bruno Soto Vela', 'role': 'Partner'},
                    {'name': 'Lucia Prado', 'role': 'Associate'}],
        'matters': [
            {'id': 'm1', 'client': 'Instituto Ejemplo de Gestión (IEG)- a school of management, business, and graduate studies.',
             'leadPartner': 'na', 'original_code_extraction': {'leadPartner': 'Ana Ruiz (Senior Partner) and Bruno Soto Vela (Partner).'},
             'teamMembers': 'Lucia Prado (Senior Associate).', 'completionDate': 'Ongoing.',
             'rawNotes': 'Ejemplo Abogados advises IEG on its workforce. The matter is led by Ana Ruiz.',
             'source_excerpt': 'E9 Other information about this matter\nThis matter is strictly confidential.',
             'publish_status': 'confidential', 'isConfidential': True},
            {'id': 'm2', 'client': 'Comercial Norte, C.A. - one of the leading retailers', 'leadPartner': 'The matter was led by Ana Ruiz and Bruno Soto Vela, Senior Partners and members of the Executive Committee.',
             'teamMembers': 'Lucia Prado', 'completionDate': 'August 2025', 'rawNotes': 'Ejemplo Abogados advised Norte Retail on a restructuring.',
             'publish_status': 'publishable', 'isConfidential': False},
        ]}


class ClientNameTests(unittest.TestCase):
    def test_a_description_after_a_dash_is_never_part_of_the_name(self):
        self.assertEqual(clean_name('Instituto Ejemplo (IEG)- a school of management, business, and graduate studies.'), 'Instituto Ejemplo (IEG)')
        self.assertEqual(clean_name('Comercial Norte, C.A. - one of the leading retailers'), 'Comercial Norte, C.A.')
        self.assertEqual(clean_name('Pagos Spidi-Sur, S.A.- It is a platform'), 'Pagos Spidi-Sur, S.A.')
        aliases = client_aliases(['Instituto Ejemplo (IEG)- a school of management, business, and graduate studies.'])
        self.assertIn('IEG', aliases)
        self.assertFalse({'business', 'and graduate studies.'} & set(aliases))

    def test_a_lower_case_word_or_a_company_form_is_never_a_client_identity(self):
        self.assertNotIn('N.A.', client_aliases(['Banco Ejemplo, N.A.']))
        self.assertFalse([a for a in client_aliases(['Grupo Ejemplo, data integrity and systems']) if a[:1].islower()])


class RulesRegisterTests(unittest.TestCase):
    def test_a_placeholder_answer_is_replaced_by_the_form_cell_and_real_answers_stay(self):
        pkg = cr.apply(package())
        self.assertEqual(pkg['matters'][0]['leadPartner'], 'Ana Ruiz; Bruno Soto Vela')
        self.assertTrue(pkg['matters'][1]['leadPartner'].startswith('The matter was led by'))  # a real answer is never rewritten

    def test_titles_and_committees_are_not_people(self):
        reg = cr.rules_register(package())
        self.assertEqual([p['name'] for p in reg['matters']['m2']['leads']], ['Ana Ruiz', 'Bruno Soto Vela'])
        for text in ('Senior Partners', 'members of the Executive Committee', 'international standard'):
            self.assertFalse(cr.person_like(text))
        self.assertTrue(cr.person_like('María de la Cruz Pérez'))
        self.assertEqual(cr._names('Ana Ruiz (Senior Partner) Bruno Soto Vela (Partner, member of the Committee)'), ['Ana Ruiz', 'Bruno Soto Vela'])
        self.assertEqual(cr._names('Ana Ruiz (Senior Partner, member). Bruno Soto Vela (Partner) Lucia Prado (Partner)'), ['Ana Ruiz', 'Bruno Soto Vela', 'Lucia Prado'])

    def test_period_and_restriction_are_computed_by_code(self):
        reg = cr.rules_register(package())
        self.assertIs(reg['matters']['m2']['in_research_period'], False)
        self.assertIs(reg['matters']['m1']['in_research_period'], True)
        self.assertTrue(reg['matters']['m1']['public_use_restricted'])
        self.assertFalse(reg['matters']['m2']['public_use_restricted'])
        self.assertIs(cr.in_period('completed', 2025, 12, PERIOD), True)
        self.assertIs(cr.in_period('completed', 2025, 0, PERIOD), True)  # month unknown: not excluded
        self.assertIsNone(cr.in_period('unknown', 0, 0, PERIOD))


class ModelReadingTests(unittest.TestCase):
    def reading(self):
        return {
            'clients': [{'matter_id': 'm1', 'name': 'Instituto Ejemplo de Gestión (IEG)', 'other_names': ['IEG', 'business', 'Ana Ruiz']},
                        {'matter_id': 'm2', 'name': 'Comercial Norte, C.A. - one of the leading retailers', 'other_names': ['Norte Retail', 'Venezuela Retail']}],
            'matters': [{'matter_id': 'm1', 'leads': [{'name': 'Ana Ruiz', 'quote': 'The matter is led by Ana Ruiz.'}, {'name': 'Carla Invented', 'quote': 'Carla Invented leads it'}],
                         'team': [{'name': 'Lucia Prado', 'quote': 'Lucia Prado (Senior Associate).'}], 'status': 'ongoing', 'completion_year': 0,
                         'completion_month': 0, 'completion_quote': 'Ongoing.', 'public_use_restricted': True, 'restriction_quote': 'This matter is strictly confidential.'},
                        {'matter_id': 'm2', 'leads': [], 'team': [], 'status': 'completed', 'completion_year': 2025, 'completion_month': 8,
                         'completion_quote': 'August 2025', 'public_use_restricted': True, 'restriction_quote': 'a restructuring'}],
            'lawyers': [{'name': 'Lucia Prado', 'title': 'senior associate', 'title_quote': 'Lucia Prado, a senior associate with 16 years', 'other_names': []},
                        {'name': 'Bruno Soto Vela', 'title': 'Managing Partner', 'title_quote': 'Bruno Soto Vela, Managing Partner', 'other_names': []},
                        {'name': 'Someone Else', 'title': 'Partner', 'title_quote': '', 'other_names': []}]}

    def test_code_keeps_only_what_is_literally_in_the_sources(self):
        reg = cr.validate(self.reading(), package())
        self.assertEqual(reg['method'], 'model')
        self.assertEqual(reg['clients']['m1']['other_names'], ['IEG'])  # "business" and a person are rejected
        self.assertEqual(reg['clients']['m2']['name'], 'Comercial Norte, C.A.')  # a name with its description falls back
        self.assertEqual(reg['clients']['m2']['other_names'], ['Norte Retail'])  # not in the sources: rejected
        self.assertEqual([p['name'] for p in reg['matters']['m1']['leads']], ['Ana Ruiz'])
        self.assertEqual(reg['lawyers']['Lucia Prado']['title'], 'senior associate')
        self.assertEqual(reg['lawyers']['Bruno Soto Vela']['title'], 'Partner')  # unsupported title: form role stays
        self.assertTrue(reg['matters']['m1']['public_use_restricted'])
        self.assertFalse(reg['matters']['m2']['public_use_restricted'])  # no literal restriction sentence
        self.assertIs(reg['matters']['m2']['in_research_period'], False)
        self.assertTrue(any('not in roster' in r for r in reg['rejected']))

    def test_one_call_builds_it_and_a_failed_call_falls_back_to_the_rules(self):
        calls = []

        def invoke(state, role, schema, instruction, payload):
            calls.append((role, schema.__name__, sorted(payload)))
            return self.reading(), [{'role': role, 'usage': {'input_tokens': 10, 'output_tokens': 5, 'total_tokens': 15}}]
        reg, trace = cr.build(package(), invoke)
        self.assertEqual(calls, [('case_register', 'Register', ['department_description', 'department_heads', 'firm_name', 'lawyers', 'matters'])])
        self.assertEqual(reg['method'], 'model')
        self.assertEqual(trace[0]['usage']['total_tokens'], 15)

        class Failure(Exception):
            trace = {'role': 'case_register', 'usage': {'unknown_calls': 1}, 'usage_status': 'unknown'}

        def broken(*_):
            raise Failure('provider outcome unknown')
        reg, trace = cr.build(package(), broken)
        self.assertEqual(reg['method'], 'rules')
        self.assertEqual(trace[0]['usage_status'], 'unknown')

    def test_the_reader_has_its_own_short_instructions(self):
        self.assertEqual(role_base('case_register', 'LONG REVIEW RULES'), cr.REGISTER_BASE)
        self.assertEqual(role_base('editor', 'LONG REVIEW RULES'), 'LONG REVIEW RULES')


class ConsumerTests(unittest.TestCase):
    def test_the_fact_sheet_reads_leads_titles_period_and_restriction_from_the_register(self):
        pkg = package()
        pkg['case_register'] = cr.validate(ModelReadingTests().reading(), pkg)
        cr.apply(pkg)
        sheet = fact_sheet.build(pkg)
        lucia = next(l for l in sheet['lawyers'] if l['name'] == 'Lucia Prado')
        self.assertEqual(lucia['title'], 'senior associate')
        ana = next(l for l in sheet['lawyers'] if l['name'] == 'Ana Ruiz')
        self.assertEqual(len(ana['leads_alone']) + len(ana['co_leads']), 2)
        clients = {c['matter_id']: c for c in sheet['clients']}
        self.assertIn('never described in B9, B10 or C2', clients['m1']['public_use'])
        self.assertEqual(clients['m1']['client'], 'Instituto Ejemplo de Gestión (IEG)')
        self.assertIn('closed before', clients['m2']['research_period'])
        self.assertIn('public_use', fact_sheet.RULE)

    def test_a_restricted_matter_is_never_public_evidence_of_a_person(self):
        pkg = cr.apply(package())
        strategy = {'matters': [{'matter_id': 'm1', 'disposition': 'core'}, {'matter_id': 'm2', 'disposition': 'core'}]}
        self.assertEqual(support_ids(pkg, strategy), {'m2'})

    def test_a_mandate_closed_before_the_period_leaves_the_portfolio_in_code(self):
        from core.review_graph import selection_gate
        pkg = cr.apply(package())
        state = {'package': pkg, 'strategy': {'hero_matter_id': 'm1', 'matters': [
            {'matter_id': 'm1', 'disposition': 'core', 'source_quote': 'Ejemplo Abogados advises IEG on its workforce'},
            {'matter_id': 'm2', 'disposition': 'core', 'source_quote': 'Ejemplo Abogados advised Norte Retail on a restructuring'}]}}
        self.assertTrue(selection_gate(state)['selection_validated'])
        self.assertEqual([d['disposition'] for d in state['strategy']['matters']], ['core', 'excluded'])


class EndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_the_engine_reads_the_register_in_one_call_and_every_stage_applies_it(self):
        import ast, asyncio, json, logging
        from pathlib import Path
        from types import SimpleNamespace
        from unittest.mock import patch
        from fastapi.responses import JSONResponse
        source = (Path(__file__).resolve().parents[1] / 'main.py').read_text()
        self.assertIn('apply_case_register(payload)', source)
        tree = ast.parse(source)
        fn = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == 'case_register_endpoint')
        fn.decorator_list = []
        scope = {'Request': object, 'JSONResponse': JSONResponse, 'asyncio': asyncio, 'logger': logging.getLogger('test')}
        exec(compile(ast.Module(body=[fn], type_ignores=[]), 'main.py', 'exec'), scope)
        calls = []

        def invoke(state, role, schema, instruction, payload):
            calls.append(role)
            return ModelReadingTests().reading(), [{'role': role, 'usage': {'input_tokens': 1, 'output_tokens': 1, 'total_tokens': 2}}]

        async def body():
            return {'package': package()}
        with patch('core.review_graph.invoke_role', invoke):
            response = await scope['case_register_endpoint'](SimpleNamespace(json=body))
        result = json.loads(response.body)
        self.assertEqual(calls, ['case_register'])
        self.assertTrue(result['success'])
        self.assertEqual(result['register']['clients']['m1']['other_names'], ['IEG'])


if __name__ == '__main__':
    unittest.main()
