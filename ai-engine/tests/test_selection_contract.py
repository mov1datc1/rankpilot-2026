import copy
import unittest
from unittest.mock import patch
from pydantic import ValidationError
from core.selection_contract import selection_contract, project_selection
from core.review_graph import strategist, selection_gate


class SelectionContractTests(unittest.TestCase):
    def setUp(self):
        self.matters = [{'id': f'uuid-{i}', 'client': f'Client {i}', 'rawNotes': f'The team advised on mandate {i}.'} for i in range(32)]
        self.schema, self.refs = selection_contract(self.matters)
        self.proposal = {'decisions': {ref: {'disposition': 'core' if i < 20 else 'reserve', 'priority': i + 1,
            'rationale': 'Source-backed mandate', 'source_quote': self.matters[i]['rawNotes']} for i, ref in enumerate(self.refs)},
            'hero_reference': 'M01', 'pending_questions': [], 'thesis': 'Evidence'}

    def test_all_32_references_required_and_project_to_original_ids(self):
        result = project_selection(self.proposal, self.schema, self.refs)
        self.assertEqual([d['matter_id'] for d in result['matters']], [m['id'] for m in self.matters])
        self.assertTrue(selection_gate({'package': {'matters': self.matters}, 'strategy': result})['selection_validated'])
        self.assertEqual(len(self.schema.model_json_schema()['$defs']['RegisteredDecisions']['required']), 32)

    def test_omission_and_invented_reference_cannot_parse(self):
        for change in ('missing', 'unknown', 'hero'):
            bad = copy.deepcopy(self.proposal)
            if change == 'missing': del bad['decisions']['M31']
            elif change == 'unknown': bad['decisions']['M99'] = bad['decisions'].pop('M31')
            else: bad['hero_reference'] = 'M99'
            with self.assertRaises(ValidationError): project_selection(bad, self.schema, self.refs)

    def test_mixed_quotes_are_still_rejected_not_repaired_by_fabricating_evidence(self):
        bad = copy.deepcopy(self.proposal)
        bad['decisions']['M32']['source_quote'] = self.matters[30]['rawNotes'] + ' ' + self.matters[31]['rawNotes']
        result = selection_gate({'package': {'matters': self.matters}, 'strategy': project_selection(bad, self.schema, self.refs)})
        self.assertFalse(result['selection_validated'])
        self.assertIn('Client 31', result['errors'][0])

    def test_retry_provides_diagnostics_and_preserves_source_register(self):
        package = {'matters': self.matters, 'preferred_hero_id': 'uuid-0'}
        before = copy.deepcopy(package)
        feedback = {'errors': ['Mixed quote'], 'strategy': {'matters': [{'matter_id': 'uuid-31', 'source_quote': 'Wrong combined quote'}]}}
        with patch('core.review_graph.invoke_role', return_value=(self.proposal, [])) as invoke:
            result = strategist({'package': package, 'selection_feedback': feedback})
        payload = invoke.call_args.args[-1]
        self.assertEqual(payload['matters'][31]['id'], 'M32')
        self.assertEqual(payload['previous_failed_selection']['decisions'][0]['matter_id'], 'M32')
        self.assertEqual(payload['preferred_hero_id'], 'M01')
        self.assertEqual(package, before)
        self.assertEqual(result['strategy']['hero_matter_id'], 'uuid-0')

    def test_transport_refs_resolve_in_prose_without_rewriting_source_quotes(self):
        proposal=copy.deepcopy(self.proposal)
        proposal['thesis']='M01 leads; M26 supports. M260 is not a registered reference.'
        proposal['pending_questions']=['Confirm M26 activity.']
        proposal['decisions']['M01']['rationale']='M01 leads.'
        proposal['decisions']['M01']['source_quote']='M01 is verbatim evidence.'
        result=project_selection(proposal,self.schema,self.refs,self.matters)
        self.assertEqual(result['thesis'],'Client 0 leads; Client 25 supports. M260 is not a registered reference.')
        self.assertEqual(result['matters'][0]['source_quote'],'M01 is verbatim evidence.')
        self.assertEqual(result['matters'][0]['matter_id'],'uuid-0')
