import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.outputs import ChatResult, ChatGeneration
from pydantic import BaseModel
from openai.lib._pydantic import to_strict_json_schema
from utils.provider_budget import BudgetedChatOpenAI, RequestBudget, request_budget, BudgetPreflightError
from utils.provider_errors import provider_failure


class Answer(BaseModel):
    answer:str


class ProviderBudgetTests(unittest.TestCase):
    def model(self,count=100):
        model=BudgetedChatOpenAI(model='gpt-5.6-sol',api_key='offline-test-key',use_responses_api=True,max_tokens=100,max_retries=0)
        counter=Mock(return_value=SimpleNamespace(input_tokens=count))
        model=model.model_copy(update={'root_client':SimpleNamespace(responses=SimpleNamespace(input_tokens=SimpleNamespace(count=counter)))})
        chain=model.with_structured_output(to_strict_json_schema(Answer),method='json_schema',strict=True,include_raw=True)
        kwargs=chain.steps[0].steps__['raw'].kwargs
        return model,counter,kwargs

    def result(self,total=120):
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content='{"answer":"ok"}',
            usage_metadata={'input_tokens':100,'output_tokens':total-100,'total_tokens':total}))])

    def test_exact_responses_input_schema_and_full_output_cap_are_reserved(self):
        model,count,kwargs=self.model();messages=[SystemMessage(content='Original instructions'),HumanMessage(content='Original source')]
        expected=model._get_request_payload(messages,**kwargs)
        token=request_budget.set(RequestBudget(199))
        try:
            with patch.object(ChatOpenAI,'_generate',side_effect=AssertionError('No generation')):
                with self.assertRaises(BudgetPreflightError) as caught:model._generate(messages,**kwargs)
            self.assertEqual(caught.exception.code,'EDITORIAL_BUDGET_REQUIRED')
            self.assertEqual(count.call_args.kwargs['input'],expected['input'])
            self.assertEqual(count.call_args.kwargs['text'],expected['text'])
            self.assertEqual(caught.exception.details['reserved_output_tokens'],100)
            self.assertEqual(request_budget.get().remaining,199)
            self.assertFalse(caught.exception.provider_request_started)
        finally:request_budget.reset(token)

    def test_multiple_calls_in_one_stage_consume_one_shared_allowance(self):
        model,count,kwargs=self.model();token=request_budget.set(RequestBudget(300))
        try:
            with patch.object(ChatOpenAI,'_generate',return_value=self.result()) as generated:
                model._generate([HumanMessage(content='First')],**kwargs)
                self.assertEqual(request_budget.get().remaining,180)
                with self.assertRaises(BudgetPreflightError):model._generate([HumanMessage(content='Second')],**kwargs)
            self.assertEqual(generated.call_count,1);self.assertEqual(count.call_count,2)
        finally:request_budget.reset(token)

    def test_count_failure_is_known_unstarted_and_does_not_spend_or_mark_unknown(self):
        model,count,kwargs=self.model();count.side_effect=TimeoutError('count unavailable')
        token=request_budget.set(RequestBudget(300))
        try:
            with patch.object(ChatOpenAI,'_generate',side_effect=AssertionError('No generation')):
                with self.assertRaises(BudgetPreflightError) as caught:model._generate([HumanMessage(content='Test')],**kwargs)
            self.assertEqual(provider_failure(caught.exception)['code'],'AI_BUDGET_CHECK_UNAVAILABLE')
            self.assertEqual(request_budget.get().remaining,300);self.assertFalse(request_budget.get().uncertain)
        finally:request_budget.reset(token)

    def test_lost_generation_blocks_further_counts_and_generations(self):
        model,count,kwargs=self.model();token=request_budget.set(RequestBudget(300))
        try:
            with patch.object(ChatOpenAI,'_generate',side_effect=TimeoutError('generation unknown')):
                with self.assertRaises(TimeoutError):model._generate([HumanMessage(content='Test')],**kwargs)
            with self.assertRaises(BudgetPreflightError):model._generate([HumanMessage(content='Another')],**kwargs)
            self.assertTrue(request_budget.get().uncertain);self.assertEqual(count.call_count,1)
        finally:request_budget.reset(token)

    def test_threaded_stage_sees_request_budget_and_next_request_does_not(self):
        async def run():
            budget=RequestBudget(123)
            token=request_budget.set(budget)
            try:self.assertIs(await asyncio.to_thread(request_budget.get),budget)
            finally:request_budget.reset(token)
            self.assertIsNone(request_budget.get())
        asyncio.run(run())

    def test_uncapped_calls_skip_count_keep_spend_and_stop_unknown_outcomes(self):
        model,count,kwargs=self.model();budget=RequestBudget(None);token=request_budget.set(budget)
        try:
            with patch.object(ChatOpenAI,'_generate',return_value=self.result(1500000)):
                model._generate([HumanMessage(content='First')],**kwargs)
                model._generate([HumanMessage(content='Second')],**kwargs)
            self.assertEqual(budget.spent_tokens,3000000);self.assertIsNone(budget.remaining)
            count.assert_not_called()
            with patch.object(ChatOpenAI,'_generate',side_effect=TimeoutError('unknown')):
                with self.assertRaises(TimeoutError):model._generate([HumanMessage(content='Third')],**kwargs)
            with patch.object(ChatOpenAI,'_generate') as generated:
                with self.assertRaises(BudgetPreflightError):model._generate([HumanMessage(content='Do not repeat')],**kwargs)
                generated.assert_not_called()
        finally:request_budget.reset(token)

    def test_uncapped_async_calls_require_usage_and_do_not_repeat_missing_receipts(self):
        from unittest.mock import AsyncMock
        async def run():
            model,count,kwargs=self.model();budget=RequestBudget(None);token=request_budget.set(budget)
            try:
                with patch.object(ChatOpenAI,'_agenerate',new_callable=AsyncMock,return_value=self.result()):
                    await model._agenerate([HumanMessage(content='First')],**kwargs)
                self.assertEqual(budget.spent_tokens,120);count.assert_not_called()
                missing=ChatResult(generations=[ChatGeneration(message=AIMessage(content='{}'))])
                with patch.object(ChatOpenAI,'_agenerate',new_callable=AsyncMock,return_value=missing):
                    with self.assertRaises(RuntimeError):await model._agenerate([HumanMessage(content='Second')],**kwargs)
                with patch.object(ChatOpenAI,'_agenerate',new_callable=AsyncMock) as generated:
                    with self.assertRaises(BudgetPreflightError):await model._agenerate([HumanMessage(content='Do not repeat')],**kwargs)
                    generated.assert_not_called()
            finally:request_budget.reset(token)
        asyncio.run(run())
