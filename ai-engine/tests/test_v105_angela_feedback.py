"""v1.0.105: Ángela's DeForest feedback of 19 Nov 2026, without regressing what she praised."""
import copy
import unittest
from core.editorial_construction import advance, MATTER_TASK, INSTITUTION_TASK, PLAN_TASK
from core.candidate_evidence import CHAMBERS_CATEGORY_GUIDANCE


class MatterNarrativesKeepTheStrategicReasons(unittest.TestCase):
    def test_the_matter_writer_receives_why_each_matter_was_selected(self):
        from test_editorial_construction import ConstructionTests
        case=ConstructionTests();state,v=case.fixture();calls=[]
        for d in state['strategy']['matters']:d['rationale']='Selected for its strike prevention.'
        result=advance(state,case.provider(v,calls))
        self.assertTrue(result['development_validated'],result['errors'])
        payload=next(p for name,p in calls if name=='MatterNarratives')
        ids={m['id'] for m in payload['package']['matters']}
        self.assertEqual(set(payload['selection_rationale']),ids)
        self.assertTrue(all(r=='Selected for its strike prevention.' for r in payload['selection_rationale'].values()))

    def test_depth_is_proportional_and_names_are_uniform(self):
        for phrase in ('DEPTH PROPORTIONAL TO THE EVIDENCE','never compressed','is not padded',
                       'selection_rationale','Name the client consistently with its register name'):
            self.assertIn(phrase,MATTER_TASK)


class InstitutionalVoiceAndCategories(unittest.TestCase):
    def test_c2_is_assertive_and_still_requests_coverage_once(self):
        self.assertIn('assertive institutional voice',INSTITUTION_TASK)
        self.assertIn('make the coverage request plainly once',INSTITUTION_TASK)
        self.assertIn('respectfully submits',INSTITUTION_TASK)  # named only as a formula to avoid

    def test_categories_are_calibrated_per_person(self):
        guidance=CHAMBERS_CATEGORY_GUIDANCE['guidance']
        for phrase in ('Band N candidate','Up and Coming','compare a band target with Up and Coming','Established Individual'):
            self.assertIn(phrase,guidance)
        self.assertIn('never give every partner the same category by default',PLAN_TASK)


if __name__=='__main__':unittest.main()


class CreditExhaustionIsAKnownUnbilledOutcome(unittest.TestCase):
    """DeForest 19-11 15:50: HTTP 429 insufficient_quota froze the case as an unknown outcome."""
    def invoke(self, error):
        from unittest.mock import patch
        from core.review_graph import invoke_role, Verdict, EditorialResponseError
        with patch('core.review_graph.RAGRouter.get_rag_context'),patch('core.review_graph.create_chat_model') as model:
            model.return_value.with_structured_output.return_value.invoke.side_effect=error
            with self.assertRaises(EditorialResponseError) as caught:
                invoke_role({'package':{}},'portfolio_reviewer',Verdict,'Check.',{'clauses':[]})
        return caught.exception

    def test_billing_rejection_records_zero_billed_usage_and_maps_to_credit_exhausted(self):
        from utils.provider_errors import provider_failure
        failure=self.invoke(RuntimeError("Error code: 429 - {'error': {'message': 'You have no credits remaining.', 'type': 'insufficient_quota', 'code': 'credit_balance_exhausted'}}"))
        self.assertEqual(failure.trace['usage'],{'input_tokens':0,'output_tokens':0,'total_tokens':0})
        self.assertEqual(failure.trace['usage_status'],'rejected_unbilled')
        self.assertNotIn('unknown_calls',failure.trace['usage'])
        self.assertEqual(provider_failure(failure)['code'],'AI_CREDIT_EXHAUSTED')

    def test_any_other_provider_failure_stays_an_unknown_outcome(self):
        from utils.provider_errors import provider_failure
        failure=self.invoke(RuntimeError('Connection reset by peer'))
        self.assertEqual(failure.trace['usage'],{'unknown_calls':1})
        self.assertEqual(provider_failure(failure)['code'],'AI_REVIEW_UNAVAILABLE')
