import ast
import asyncio
import hmac
import os
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from fastapi.responses import JSONResponse
from utils.provider_budget import RequestBudget, request_budget

ROOT=Path(__file__).resolve().parents[1]

def endpoint(name):
    tree=ast.parse((ROOT/'main.py').read_text())
    fn=next(n for n in tree.body if isinstance(n,ast.AsyncFunctionDef) and n.name==name)
    fn.decorator_list=[]
    scope={'Request':object,'JSONResponse':JSONResponse,'os':os,'hmac':hmac,
           'asyncio':asyncio,'REVIEW_POLICY_VERSION':'fixture'}
    exec(compile(ast.Module(body=[fn],type_ignores=[]),'main.py','exec'),scope)
    return scope[name]

class BudgetHttpBoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def test_authentication_precedes_allowance_and_context_is_isolated(self):
        boundary=endpoint('service_boundary');called=[]
        async def handler(request):
            called.append(request_budget.get().remaining)
            return JSONResponse({'ok':True})
        request=SimpleNamespace(url=SimpleNamespace(path='/review-step'),headers={'x-rankpilot-token-allowance':'120'})
        with patch.dict(os.environ,{'AI_ENGINE_SERVICE_TOKEN':'synthetic-secret'}):
            self.assertEqual((await boundary(request,handler)).status_code,401)
            self.assertFalse(called)
            request.headers['authorization']='Bearer synthetic-secret'
            self.assertEqual((await boundary(request,handler)).status_code,200)
            self.assertEqual(called,[120]);self.assertIsNone(request_budget.get())
            request.headers['x-rankpilot-token-allowance']='-1'
            self.assertEqual((await boundary(request,handler)).status_code,400)

    async def test_swallowed_final_preflight_failure_cannot_approve_documents(self):
        import json
        request=SimpleNamespace()
        async def body():return {'package':{'rendered_artifact':'Synthetic document'}}
        request.json=body
        budget=RequestBudget(10);token=request_budget.set(budget)
        def stopped(*args):
            budget.last_stop={'code':'EDITORIAL_BUDGET_REQUIRED','details':{}}
            return {'judge':{'passed':True,'defects':[]},'trace':[{'usage':{'total_tokens':7}}]}
        try:
            with patch('core.review_graph.review_rendered_package',side_effect=stopped):
                response=await endpoint('verify_rendered_package_endpoint')(request)
            self.assertEqual(response.status_code,502)
            result=json.loads(response.body)
            self.assertEqual(result['code'],'EDITORIAL_BUDGET_REQUIRED')
            self.assertNotIn('judge',result)
            self.assertEqual(result['trace'][0]['usage']['total_tokens'],7)
        finally:request_budget.reset(token)
