"""Explicit prompt caching: no paid write unless the same role+schema already ran."""
import os
import unittest
from unittest.mock import patch

from langchain_core.messages import HumanMessage, SystemMessage

from utils import prompt_cache


class PlanTests(unittest.TestCase):
    def test_first_call_writes_nothing_and_a_repeated_schema_gets_the_breakpoint(self):
        trace = [{'role': 'field_reviewer', 'schema_digest': 'abc'}]
        self.assertEqual(prompt_cache.plan('field_reviewer', 'new', trace), 'none')
        self.assertEqual(prompt_cache.plan('field_reviewer', 'abc', trace), 'static')
        self.assertEqual(prompt_cache.plan('repair', 'abc', trace), 'none')

    def test_switch_restores_provider_default_or_sends_nothing(self):
        for value in ('implicit', 'off'):
            with self.subTest(value=value), patch.dict(os.environ, {'RANKPILOT_PROMPT_CACHE': value}):
                self.assertIsNone(prompt_cache.plan('editor', 'abc', [{'role': 'editor', 'schema_digest': 'abc'}]))

    def test_schema_digest_is_order_independent(self):
        self.assertEqual(prompt_cache.schema_digest({'a': 1, 'b': [1, 2]}), prompt_cache.schema_digest({'b': [1, 2], 'a': 1}))
        self.assertNotEqual(prompt_cache.schema_digest({'a': 1}), prompt_cache.schema_digest({'a': 2}))


class PayloadTests(unittest.TestCase):
    payload = {'input': [{'role': 'system', 'content': [{'type': 'input_text', 'text': 'STATIC'}, {'type': 'input_text', 'text': 'dyn'}]},
                         {'role': 'user', 'content': 'case'}], 'max_output_tokens': 10}

    def test_none_is_explicit_without_breakpoint(self):
        result = prompt_cache.apply(self.payload, 'none')
        self.assertEqual(result['extra_body'], {'prompt_cache_options': {'mode': 'explicit'}})
        self.assertNotIn('prompt_cache_breakpoint', str(result['input']))

    def test_static_marks_only_the_first_system_block_and_count_payload_is_clean(self):
        result = prompt_cache.apply(self.payload, 'static')
        self.assertEqual(result['input'][0]['content'][0]['prompt_cache_breakpoint'], {'mode': 'explicit'})
        self.assertNotIn('prompt_cache_breakpoint', result['input'][0]['content'][1])
        self.assertNotIn('prompt_cache_breakpoint', str(self.payload))  # caller's payload untouched
        self.assertNotIn('prompt_cache_breakpoint', str(prompt_cache.strip(result)['input']))

    def test_chat_completions_payloads_and_no_plan_are_unchanged(self):
        chat = {'messages': [{'role': 'user', 'content': 'x'}]}
        self.assertEqual(prompt_cache.apply(chat, 'none'), chat)
        self.assertEqual(prompt_cache.apply(self.payload, None), self.payload)


class ClientTests(unittest.TestCase):
    @patch.dict(os.environ, {'OPENAI_API_KEY': 'offline-test-key'})
    def test_the_budgeted_client_sends_explicit_mode_by_default(self):
        from utils.model_factory import create_chat_model
        model = create_chat_model('repair')
        payload = model._get_request_payload([SystemMessage(content='a'), HumanMessage(content='b')])
        self.assertEqual(payload['extra_body']['prompt_cache_options'], {'mode': 'explicit'})
        static = model.model_copy(update={'cache_plan': 'static'})._get_request_payload(
            [SystemMessage(content=[{'type': 'text', 'text': 'S'}, {'type': 'text', 'text': 'D'}]), HumanMessage(content='b')])
        self.assertEqual(static['input'][0]['content'][0]['prompt_cache_breakpoint'], {'mode': 'explicit'})


if __name__ == '__main__':
    unittest.main()
