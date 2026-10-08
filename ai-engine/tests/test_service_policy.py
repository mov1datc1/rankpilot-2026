"""Exercise the actual middleware without starting models or the full server."""
import ast
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from utils.review_policy import REVIEW_POLICY_VERSION

ROOT = Path(__file__).resolve().parents[1]

class ServicePolicyTest(unittest.IsolatedAsyncioTestCase):
    async def test_success_header_matches_current_rules(self):
        tree = ast.parse((ROOT / 'main.py').read_text())
        boundary = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == 'service_boundary')
        boundary.decorator_list = []
        namespace = {'Request': object, 'REVIEW_POLICY_VERSION': REVIEW_POLICY_VERSION}
        exec(compile(ast.Module(body=[boundary], type_ignores=[]), 'main.py', 'exec'), namespace)
        response = SimpleNamespace(headers={})
        async def handler(request):
            return response
        result = await namespace['service_boundary'](SimpleNamespace(url=SimpleNamespace(path='/health')), handler)
        self.assertEqual(result.headers['X-RankPilot-Policy'], json.loads((ROOT / 'config/editorial_rules.v1.json').read_text())['version'])
        self.assertIs(result, response)
