import asyncio
import threading
import unittest
from unittest.mock import AsyncMock, patch


class MicroConcurrencyTests(unittest.IsolatedAsyncioTestCase):
    async def test_writers_do_not_block_health_or_other_requests(self):
        from main import optimize_b10_endpoint, optimize_matter_endpoint, health_check
        for endpoint, name in [(optimize_b10_endpoint, 'optimize_b10_micro'),
                               (optimize_matter_endpoint, 'optimize_matter_micro')]:
            with self.subTest(endpoint=name):
                entered, release = threading.Event(), threading.Event()
                def slow_model(**kwargs):
                    entered.set()
                    release.wait(2)
                    return {'success': True}
                request = type('Request', (), {'json': AsyncMock(return_value={})})()
                with patch('agents.micro_optimizer.' + name, side_effect=slow_model):
                    task = asyncio.create_task(endpoint(request))
                    try:
                        for _ in range(100):
                            if entered.is_set():
                                break
                            await asyncio.sleep(.005)
                        self.assertTrue(entered.is_set())
                        self.assertFalse(task.done(), 'Model call blocked the event loop')
                        await asyncio.wait_for(health_check(), timeout=.5)
                    finally:
                        release.set()
                        response = await task
                    self.assertEqual(response.status_code, 200)

class SelectionReuseTests(unittest.IsolatedAsyncioTestCase):
    async def test_rechecks_failed_selection_before_paying_for_another_proposal(self):
        import json
        from main import review_step_endpoint
        source='The firm manages more than twenty proceedings.'
        strategy={'matters':[{'matter_id':'m','disposition':'core','rationale':'More than 20 proceedings.','source_quote':source}], 'hero_matter_id':'m','thesis':'Proceedings','pending_questions':[]}
        payload={'stage':'strategy','package':{'matters':[{'id':'m','rawNotes':source,'publish_status':'publishable','confidentialityConfirmed':True}]},'state':{'selection_feedback':{'strategy':strategy}}}
        request=type('Request',(),{'json':AsyncMock(return_value=payload)})()
        with patch('utils.ranking_verifier.verify_ranking_claim',return_value={}),patch('core.review_graph.strategist') as model, patch('core.review_graph.selection_review',return_value={'selection_review_validated':True,'errors':[]}):
            response=await review_step_endpoint(request)
        result=json.loads(response.body)
        self.assertEqual(result['next_stage'],'development')
        self.assertTrue(result['state']['selection_validated'])
        self.assertEqual(result['state']['trace'],[])
        model.assert_not_called()
