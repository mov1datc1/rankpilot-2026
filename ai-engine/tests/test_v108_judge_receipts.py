"""v1.0.108: the final judge reuses its own signed MET verdicts on unchanged output."""
import copy
import unittest
from unittest.mock import patch
from core.editorial_case import obligations, execution_output
from core.judge_receipts import issue, reusable
from core.review_graph import role_payload
from test_editorial_case import fixture

SECRET={'AI_ENGINE_SERVICE_TOKEN':'test-secret'}
LETTER={'leadership':'Sofia led the negotiations.','evidence_gaps':'Routine advice adds no distinct capability.'}


def met_checks(p,s,v,letter):
    return [{'obligation_id':o['id'],'status':'met','artifact_quote':execution_output(p,v,letter,o['field'])[0],
             'source_quote':'prevented a strike','reason':'Executed.'} for o in obligations(p,s,v)]


class JudgeReceipts(unittest.TestCase):
    @patch.dict('os.environ',SECRET)
    def test_unchanged_output_reuses_every_met_verdict(self):
        p,s,v=fixture();receipts=issue(p,s,v,LETTER,met_checks(p,s,v,LETTER))
        ids={o['id'] for o in obligations(p,s,v)}
        self.assertEqual({r['obligation_id'] for r in receipts},ids)
        self.assertEqual(set(reusable(p,s,v,LETTER,receipts)),ids)

    @patch.dict('os.environ',SECRET)
    def test_a_changed_word_or_instruction_is_reviewed_again(self):
        p,s,v=fixture();receipts=issue(p,s,v,LETTER,met_checks(p,s,v,LETTER))
        changed=copy.deepcopy(v);changed['b10']=changed['b10']+' A new sentence.'
        reused=set(reusable(p,s,changed,LETTER,receipts))
        on_b10={o['id'] for o in obligations(p,s,changed) if o['field']=='b10'}
        self.assertTrue(on_b10);self.assertFalse(on_b10 & reused)
        self.assertTrue(reused)  # the untouched fields are still reused
        other_letter={**LETTER,'leadership':'Sofia led and closed the negotiations.'}
        self.assertFalse({o['id'] for o in obligations(p,s,v) if o['field']=='leadership'} & set(reusable(p,s,v,other_letter,receipts)))

    @patch.dict('os.environ',SECRET)
    def test_failed_or_forged_verdicts_are_never_reused(self):
        p,s,v=fixture();checks=met_checks(p,s,v,LETTER);checks[0]['status']='failed'
        receipts=issue(p,s,v,LETTER,checks)
        self.assertNotIn(checks[0]['obligation_id'],{r['obligation_id'] for r in receipts})
        forged=copy.deepcopy(receipts);forged[0]['signature']='0'*64
        self.assertNotIn(forged[0]['obligation_id'],reusable(p,s,v,LETTER,forged))
        with patch.dict('os.environ',{'AI_ENGINE_SERVICE_TOKEN':'another-secret'}):
            self.assertEqual(reusable(p,s,v,LETTER,receipts),[])

    def test_without_the_service_secret_nothing_is_issued_or_reused(self):
        p,s,v=fixture()
        with patch.dict('os.environ',{},clear=False):
            import os;os.environ.pop('AI_ENGINE_SERVICE_TOKEN',None)
            self.assertEqual(issue(p,s,v,LETTER,met_checks(p,s,v,LETTER)),[])

    def test_receipts_never_reach_the_model(self):
        payload=role_payload({'package':{'matters':[],'judge_receipts':[{'x':1}],'_judge_receipts_reused':{'ids':['a']}}},'editor')
        self.assertNotIn('judge_receipts',payload['package']);self.assertNotIn('_judge_receipts_reused',payload['package'])


if __name__=='__main__':unittest.main()


class RateLimitIsAKnownUnbilledOutcome(unittest.TestCase):
    TEXT="Error code: 429 - {'error': {'message': 'Rate limit reached for gpt-5.6-sol on tokens per min (TPM).', 'type': 'tokens', 'code': 'rate_limit_exceeded'}}"

    def test_rate_limit_is_unbilled_and_maps_to_its_own_code(self):
        from core.review_graph import invoke_role, Verdict, EditorialResponseError
        from utils.provider_errors import provider_failure
        with patch('core.review_graph.RAGRouter.get_rag_context'),patch('core.review_graph.create_chat_model') as model:
            model.return_value.with_structured_output.return_value.invoke.side_effect=RuntimeError(self.TEXT)
            with self.assertRaises(EditorialResponseError) as caught:
                invoke_role({'package':{}},'portfolio_reviewer',Verdict,'Check.',{'clauses':[]})
        self.assertEqual(caught.exception.trace['usage'],{'input_tokens':0,'output_tokens':0,'total_tokens':0})
        self.assertEqual(provider_failure(caught.exception)['code'],'AI_RATE_LIMITED')
        self.assertEqual(provider_failure(RuntimeError('429 insufficient_quota rate limit reached'))['code'],'AI_CREDIT_EXHAUSTED')

    def test_budget_returns_the_reservation_and_stops_siblings(self):
        from utils.provider_budget import RequestBudget, BudgetPreflightError
        budget=RequestBudget(100);reserved=budget.admit(20,15)
        budget.fail(RuntimeError(self.TEXT),reserved)
        self.assertTrue(budget.rate_limited);self.assertFalse(budget.uncertain);self.assertEqual(budget.remaining,100)
        with self.assertRaises(BudgetPreflightError) as caught:budget.stop_if_blocked()
        self.assertEqual(caught.exception.code,'AI_RATE_LIMITED')
