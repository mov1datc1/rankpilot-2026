"""v1.0.120: a finished answer stays readable by the caller that asked for it.

Evidence: a real job stopped with an unknown provider outcome 33 seconds after
the engine had logged 200 for that very request. The answer existed and was
paid for; the application had lost the connection while reading it.
"""
import ast
import asyncio
import hmac
import json
import os
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.responses import JSONResponse, StreamingResponse

from utils import request_results

ROOT = Path(__file__).resolve().parents[1]
REQUEST_ID = '0f8fad5b-d9cb-469f-a165-70867728950e'


def endpoint(name):
    tree = ast.parse((ROOT / 'main.py').read_text())
    fn = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == name)
    fn.decorator_list = []
    scope = {'Request': object, 'JSONResponse': JSONResponse, 'os': os, 'hmac': hmac,
             'asyncio': asyncio, 'REVIEW_POLICY_VERSION': 'fixture'}
    exec(compile(ast.Module(body=[fn], type_ignores=[]), 'main.py', 'exec'), scope)
    return scope[name]


def request(method='POST', request_id=REQUEST_ID, path='/review-step'):
    headers = {'x-rankpilot-request-id': request_id} if request_id else {}
    return SimpleNamespace(method=method, url=SimpleNamespace(path=path), headers=headers)


class RequestResultTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        request_results.clear()
        self.boundary = endpoint('service_boundary')
        self.result = endpoint('request_result_endpoint')

    async def test_a_finished_answer_is_returned_again_exactly(self):
        payload = {'success': True, 'next_stage': 'writer', 'state': {'b10': 'Texto con acentos: energía'}}

        async def handler(_):
            seen = await self.result(REQUEST_ID)
            self.assertEqual(seen.status_code, 202)  # still running while the role works
            return JSONResponse(payload)

        sent = await self.boundary(request(), handler)
        self.assertEqual(sent.status_code, 200)
        self.assertEqual(json.loads(sent.body), payload)
        self.assertEqual(sent.headers['X-RankPilot-Policy'], 'fixture')
        self.assertEqual(sent.headers['content-length'], str(len(sent.body)))
        again = await self.result(REQUEST_ID)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.body, sent.body)
        self.assertEqual(again.headers['X-RankPilot-Original-Status'], '200')

    async def test_a_streamed_body_and_a_failure_status_are_kept_as_sent(self):
        async def chunks():
            yield b'{"success": false, '
            yield b'"code": "AI_RATE_LIMITED"}'

        async def handler(_):
            return StreamingResponse(chunks(), status_code=502, media_type='application/json')

        sent = await self.boundary(request(), handler)
        self.assertEqual(sent.status_code, 502)
        self.assertEqual(json.loads(sent.body)['code'], 'AI_RATE_LIMITED')
        again = await self.result(REQUEST_ID)
        self.assertEqual(again.headers['X-RankPilot-Original-Status'], '502')
        self.assertEqual(again.body, sent.body)

    async def test_nothing_is_kept_without_a_valid_id_or_for_a_read(self):
        original = JSONResponse({'ok': True})

        async def handler(_):
            return original

        self.assertIs(await self.boundary(request(request_id=None), handler), original)
        self.assertIs(await self.boundary(request(request_id='short'), handler), original)
        self.assertIs(await self.boundary(request(method='GET'), handler), original)
        self.assertEqual((await self.result(REQUEST_ID)).status_code, 404)
        self.assertEqual((await self.result('../../etc/passwd')).status_code, 404)

    async def test_a_role_that_raises_leaves_no_running_mark(self):
        async def handler(_):
            raise RuntimeError('synthetic failure')

        with self.assertRaises(RuntimeError):
            await self.boundary(request(), handler)
        self.assertEqual((await self.result(REQUEST_ID)).status_code, 404)

    async def test_the_lookup_sits_behind_the_service_token(self):
        async def handler(_):
            return JSONResponse({'ok': True})

        with patch.dict(os.environ, {'AI_ENGINE_SERVICE_TOKEN': 'synthetic-secret'}):
            denied = await self.boundary(request(method='GET', request_id=None, path=f'/request-result/{REQUEST_ID}'), handler)
        self.assertEqual(denied.status_code, 401)

    def test_answers_expire_and_the_store_stays_small(self):
        for index in range(request_results.MAX_RESULTS + 5):
            request_results.finish(f'request-id-number-{index:04d}', 200, b'{}', 'application/json')
        self.assertIsNone(request_results.lookup('request-id-number-0000'))
        self.assertEqual(request_results.lookup(f'request-id-number-{request_results.MAX_RESULTS + 4:04d}')[0], 'finished')
        request_results.finish(REQUEST_ID, 200, b'{}', 'application/json')
        with patch('utils.request_results.time.time', return_value=request_results.time.time() + request_results.TTL_SECONDS + 1):
            self.assertIsNone(request_results.lookup(REQUEST_ID))
        request_results.finish(REQUEST_ID, 200, b'x' * (request_results.MAX_BODY_BYTES + 1), 'application/json')
        self.assertIsNone(request_results.lookup(REQUEST_ID))


if __name__ == '__main__':
    unittest.main()
