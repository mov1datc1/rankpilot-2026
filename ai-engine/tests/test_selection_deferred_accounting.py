"""Checkpointing before a provider call cannot consume a semantic review."""
import copy
import time
import unittest
from unittest.mock import patch
from core.review_graph import selection_review, run_editorial_stage, SelectionReviewDeferred
from test_selection_repair_capacity import fixture, SOURCE

class DeferredSelectionAccountingTests(unittest.TestCase):
    def test_unexpected_sdk_invocation_error_never_becomes_zero_known_usage(self):
        package,strategy=fixture(1)
        with patch('core.review_graph.create_chat_model') as model:
            model.return_value.with_structured_output.return_value.invoke.side_effect=RuntimeError('SDK invocation failed')
            result=selection_review({'package':package,'strategy':strategy,'trace':[{'usage':{'total_tokens':123}}]})
        self.assertEqual(result['trace'][0]['usage']['total_tokens'],123)
        self.assertEqual(result['trace'][-1]['usage'],{'unknown_calls':1})
        self.assertFalse(result['selection_diagnostic_invalid'])
    def test_pre_call_deferral_preserves_counter_history_trace_and_sources(self):
        package,strategy=fixture(2)
        for attempts in (0,1,2):
            with self.subTest(attempts=attempts):
                state={'package':package,'strategy':strategy,'stage_deadline':time.monotonic()+40,
                       'selection_review_attempts':attempts,'selection_failure_history':[['m0']],
                       'trace':[{'role':'strategist','usage':{'total_tokens':123}}]}
                before=copy.deepcopy(state)
                with patch('core.review_graph.create_chat_model') as model:
                    result=selection_review(state)
                model.assert_not_called()
                self.assertEqual(result['selection_review_attempts'],attempts)
                self.assertTrue(result['selection_review_deferred'])
                self.assertFalse(result['selection_review_validated'])
                self.assertFalse(result['selection_validated'])
                self.assertEqual(result['trace'],state['trace'])
                self.assertEqual(state,before)

    def test_resume_after_deferral_allows_only_the_remaining_real_reviews(self):
        package,strategy=fixture(2);before=copy.deepcopy((package,strategy))
        events=[];real_reviews=0;deferred=False
        def invoke(state,role,schema,instruction,payload):
            nonlocal real_reviews,deferred
            if role=='strategist':
                events.append('repair')
                decisions=[{**d,'rationale':d['rationale']+' Corrected interpretation.'} for d in payload['rejected_decisions']]
                return {'core_corrections':[d for d in decisions if d['disposition']=='core'],
                        'other_corrections':[d for d in decisions if d['disposition']!='core'],'unresolved':[]},state.get('trace',[])
            if real_reviews==1 and not deferred:
                deferred=True;events.append('defer_before_call')
                raise SelectionReviewDeferred('Checkpoint before the next request')
            real_reviews+=1;events.append('review')
            bad_index=real_reviews-1 if real_reviews<3 else -1
            checks={f'M{i+1:02d}':{'status':'repair_required' if i==bad_index else 'supported',
                'explanation':'Concrete source-grounded interpretation correction.','source_quote':SOURCE if i==bad_index else '', 'decision_quote':strategy['matters'][i]['rationale'] if i==bad_index else ''} for i in range(3) if f'M{i+1:02d}' in payload['review_targets']}
            return {'checks':checks},state.get('trace',[])+[{'role':'selection_reviewer','usage':{'total_tokens':10}}]
        with patch('core.review_graph.strategist',return_value={'strategy':strategy,'errors':[]}) as select,patch('core.review_graph.invoke_role',side_effect=invoke),patch('core.review_graph.develop') as develop:
            paused=run_editorial_stage('strategy',{'package':package})
            self.assertTrue(paused['selection_review_deferred'])
            self.assertEqual(paused['selection_review_attempts'],1)
            self.assertFalse(paused['selection_review_validated'])
            self.assertEqual(paused['selection_failure_history'],[['m0']])
            resumed=run_editorial_stage('strategy',paused)
        select.assert_called_once()
        develop.assert_not_called()
        self.assertEqual(events,['review','repair','defer_before_call','review','repair','review'])
        self.assertEqual(real_reviews,3)
        self.assertEqual(resumed['selection_review_attempts'],3)
        self.assertTrue(resumed['selection_review_validated'])
        self.assertEqual(sum(t['usage']['total_tokens'] for t in resumed['trace']),30)
        self.assertEqual((package,strategy),before)
        self.assertNotIn('approved_artifact',resumed)

    def test_real_provider_failure_is_not_a_completed_semantic_review(self):
        package,strategy=fixture(1)
        with patch('core.review_graph.invoke_role',side_effect=TimeoutError('Provider outcome unavailable')):
            result=selection_review({'package':package,'strategy':strategy,'selection_review_attempts':1})
        self.assertEqual(result['selection_review_attempts'],1)
        self.assertFalse(result['selection_review_deferred'])
        self.assertFalse(result['selection_review_validated'])

    def test_sdk_connection_loss_keeps_prior_usage_and_marks_unknown_once(self):
        import httpx
        from openai import APIConnectionError, APITimeoutError
        package,strategy=fixture(1)
        for error_type in (APIConnectionError,APITimeoutError):
            with self.subTest(error=error_type.__name__):
                state={'package':package,'strategy':strategy,'stage_deadline':time.monotonic()+120,
                       'selection_review_attempts':1,'trace':[{'role':'strategist','usage':{'total_tokens':123}}]}
                with patch('core.review_graph.create_chat_model') as factory:
                    chain=factory.return_value.with_structured_output.return_value
                    chain.invoke.side_effect=error_type(request=httpx.Request('POST','https://api.openai.com/v1/responses'))
                    result=selection_review(state)
                chain.invoke.assert_called_once()
                self.assertEqual(result['selection_review_attempts'],1)
                self.assertEqual(result['trace'][0],state['trace'][0])
                self.assertEqual(result['trace'][-1]['usage'],{'unknown_calls':1})
                self.assertEqual(result['trace'][-1]['usage_status'],'unknown')
                self.assertFalse(result['selection_review_deferred'])
                self.assertTrue(result['selection_review_unavailable'])
                self.assertFalse(result['selection_review_validated'])

    def test_uncaught_role_transport_error_retains_all_prior_call_usage(self):
        import httpx
        from openai import APITimeoutError
        from core.review_graph import invoke_role, Letter, EditorialResponseError
        state={'package':{},'trace':[{'role':'writer','provider_request_id':'first','usage':{'total_tokens':123}}]}
        with patch('core.review_graph.create_chat_model') as factory:
            factory.return_value.with_structured_output.return_value.invoke.side_effect=APITimeoutError(request=httpx.Request('POST','https://api.openai.com/v1/responses'))
            with self.assertRaises(EditorialResponseError) as caught:
                invoke_role(state,'writer',Letter,'Condense the previous Audit',{})
        self.assertEqual(caught.exception.trace_history[0],state['trace'][0])
        self.assertEqual(caught.exception.trace_history[1]['usage'],{'unknown_calls':1})
