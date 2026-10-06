import os
import unittest
from unittest.mock import patch
from core.review_graph import compact_review_payload, role_payload, review_rendered_package, strategist
from utils.model_factory import get_model_settings
from utils.provider_errors import provider_failure


class ReviewCostTests(unittest.TestCase):
    def test_short_tasks_do_not_inherit_register_sized_allowance(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(get_model_settings('extraction')['max_tokens'], 32768)
            for purpose in ('rewrite', 'letter'):
                config = get_model_settings(purpose)
                self.assertEqual(config['max_tokens'], 4096)
                self.assertEqual(config['reasoning_effort'], 'low')
                self.assertEqual(config['max_retries'], 0)
            self.assertEqual(get_model_settings('editorial')['reasoning_effort'], 'high')

    def test_purpose_override_wins_without_changing_other_tasks(self):
        with patch.dict(os.environ, {'OPENAI_MAX_OUTPUT_TOKENS': '20000', 'OPENAI_MAX_OUTPUT_TOKENS_JUDGE': '9000'}, clear=True):
            self.assertEqual(get_model_settings('judge')['max_tokens'], 9000)
            self.assertEqual(get_model_settings('extraction')['max_tokens'], 20000)

    def test_compaction_removes_only_exact_alias_duplicates(self):
        source = {'matters': [{'source_excerpt': 'Pending. Not won.', 'rawNotes': 'Pending. Not won.', 'summary': 'Conflicting version', 'optimizedText': 'Draft', 'optimized_text': 'Draft', 'isPartner': False, 'valueResolution': {'confirmed': False}}]}
        compact = compact_review_payload(source)['matters'][0]
        self.assertNotIn('rawNotes', compact)
        self.assertNotIn('optimized_text', compact)
        self.assertEqual(compact['summary'], 'Conflicting version')
        self.assertFalse(compact['isPartner'])
        self.assertFalse(compact['valueResolution']['confirmed'])
        self.assertIn('rawNotes', source['matters'][0])

    def test_billing_error_is_distinct_and_never_exposes_provider_body(self):
        for text in ('429 insufficient_quota secret', 'credit_balance_exhausted secret', 'You have no credits remaining'):
            result = provider_failure(RuntimeError(text))
            self.assertEqual(result['code'], 'AI_CREDIT_EXHAUSTED')
            self.assertNotIn('secret', result['error'])

    def test_role_context_keeps_sources_and_the_actual_text_being_reviewed(self):
        payload = {'package': {'b10_source': 'Source', 'b10_draft': 'Draft', 'matters': [{'rawNotes': 'Source facts', 'optimizedText': 'Draft facts'}]}}
        for role in ('strategist', 'writer'):
            package = role_payload(payload, role)['package']
            self.assertNotIn('b10_draft', package)
            self.assertEqual(package['matters'][0]['rawNotes'], 'Source facts')
        self.assertEqual(role_payload(payload, 'editor')['package']['matters'][0]['optimizedText'], 'Draft facts')
        payload['package']['rendered_artifact'] = 'Exact Word text'
        package = role_payload(payload, 'editor')['package']
        self.assertEqual(package['rendered_artifact'], 'Exact Word text')
        self.assertNotIn('optimizedText', package['matters'][0])

    def test_portfolio_role_does_not_repeat_candidate_leadership_analysis(self):
        package = {'lawyers':[{'name':'Sofia Vega','isPartner':True}], 'matters':[{'id':'m','rawNotes':'Pending appeal','optimizedText':'Draft','status':'Optimized'}], 'ranking_verification':{'status':'verified_match','individuals':[{'name':'Sofia Vega'}]}}
        strategy_input = role_payload(package,'strategist')
        self.assertNotIn('lawyers',strategy_input)
        self.assertNotIn('individuals',strategy_input['ranking_verification'])
        self.assertNotIn('status',strategy_input['matters'][0])
        letter_input = role_payload({'package':package},'writer')['package']
        self.assertEqual(letter_input['lawyers'][0]['name'],'Sofia Vega')
        self.assertIn('individuals',letter_input['ranking_verification'])
        self.assertIn('lawyers',package)

    def test_partial_model_response_cannot_replace_source(self):
        from types import SimpleNamespace
        from agents.micro_optimizer import optimize_b10_micro
        with patch('agents.micro_optimizer.get_micro_model') as model:
            model.return_value.invoke.return_value = SimpleNamespace(content='A cut off sentence', response_metadata={'status':'incomplete','incomplete_details':{'reason':'max_output_tokens'}})
            result = optimize_b10_micro('The original department source.')
        self.assertFalse(result['success'])
        self.assertEqual(result['code'], 'AI_OUTPUT_LIMIT')
        self.assertNotIn('enhanced_b10', result)

    def test_final_judge_does_not_start_a_hidden_repair_loop(self):
        verdict = {'judge': {'passed': False, 'defects': [{'severity': 'critical', 'scope': 'letter', 'message': 'Role conflict'}]}, 'trace': []}
        with patch('core.review_graph.editor', return_value=verdict) as editor, patch('core.review_graph.writer') as writer:
            result = review_rendered_package({'letter': {}, 'trace': []}, allow_repair=False)
        self.assertFalse(result['judge']['passed'])
        editor.assert_called_once()
        writer.assert_not_called()

    def test_hero_order_is_shared_with_letter_and_exports(self):
        decisions = {ref: {'disposition': 'core', 'priority': i, 'rationale': 'Evidence', 'source_quote': 'Source'} for i, ref in enumerate(['M01', 'M02', 'M03'], 1)}
        proposal = {'decisions': decisions, 'hero_reference': 'M03', 'pending_questions': [], 'thesis': 'Source'}
        with patch('core.review_graph.invoke_role', return_value=(proposal, [])):
            result = strategist({'package': {'matters': [{'id': x} for x in ['a', 'b', 'c']]}})
        self.assertEqual([x['matter_id'] for x in result['strategy']['matters']], ['c', 'a', 'b'])

    def test_known_internal_references_are_rendered_as_names_without_a_paid_repair(self):
        from core.review_graph import writer
        matter_id = '11111111-2222-3333-4444-555555555555'
        state = {'package': {'matters':[{'id':matter_id,'client':'Synthetic Buyer'}]}, 'strategy':{}}
        with patch('core.review_graph.invoke_role', return_value=({'portfolio':f'Hero: {matter_id}.'}, [])) as invoke:
            result = writer(state)
        self.assertEqual(result['letter']['portfolio'], 'Hero: Synthetic Buyer.')
        invoke.assert_called_once()

    def test_role_correction_blocks_only_release_until_confirmed(self):
        from core.review_graph import release_gate, register_gate
        state = {'package': {'directory':'Chambers','b10_source':'Source', 'matters':[{'id':'m','rawNotes':'Source'}], 'lawyers':[{'name':'Sofia Vega','role':'Partner','isPartner':True,'roleResolution':{'role':'Partner','reason':'Official roster for the submission period','confirmed':False}}]}, 'judge':{'passed':True,'defects':[]}}
        self.assertEqual(register_gate(state)['errors'], [])
        self.assertFalse(release_gate(state)['release_verdict']['passed'])
        state['package']['lawyers'][0]['roleResolution']['confirmed'] = True
        self.assertTrue(release_gate(state)['release_verdict']['passed'])

    def test_render_permission_never_implies_delivery_approval(self):
        from core.review_graph import release_gate
        state = {'package': {'directory':'Chambers','b10_source':'Source','matters':[]}}
        result = release_gate(state, require_judge=False)
        self.assertTrue(result['render_gate']['passed'])
        self.assertFalse(result['release_verdict']['passed'])
        self.assertFalse(release_gate(state)['release_verdict']['passed'])
        state['package']['matters'] = [{'id':'m','confidentialityConfirmed':False}]
        self.assertFalse(release_gate(state, require_judge=False)['render_gate']['passed'])
