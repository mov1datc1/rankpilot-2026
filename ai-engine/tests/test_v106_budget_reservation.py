"""v1.0.106: reviewed with Jake's note; reserve before sending, billing refusals are known."""
import threading
import unittest
from types import SimpleNamespace
from utils.provider_budget import RequestBudget, BudgetPreflightError
from utils.provider_errors import provider_failure


def result(total):
    return SimpleNamespace(generations=[SimpleNamespace(message=SimpleNamespace(usage_metadata={'total_tokens':total}))])


class ReservationBeforeSending(unittest.TestCase):
    def test_parallel_calls_can_no_longer_overspend_the_cap(self):
        budget=RequestBudget(100);admitted=[];refused=[];barrier=threading.Barrier(4)
        def call():
            barrier.wait()
            try:admitted.append(budget.admit(20,15))
            except BudgetPreflightError as error:refused.append(error.code)
        threads=[threading.Thread(target=call) for _ in range(4)]
        for t in threads:t.start()
        for t in threads:t.join()
        self.assertEqual(len(admitted),2);self.assertEqual(refused,['EDITORIAL_BUDGET_REQUIRED']*2)
        for reserved in admitted:budget.settle(result(30),reserved)
        self.assertEqual(budget.spent_tokens,60);self.assertEqual(budget.remaining,40)

    def test_unlimited_budget_reserves_nothing(self):
        budget=RequestBudget(None)
        self.assertEqual(budget.admit(20,15),0);budget.settle(result(30),0)
        self.assertIsNone(budget.remaining);self.assertEqual(budget.spent_tokens,30)


class BillingRefusalIsKnown(unittest.TestCase):
    def test_a_429_returns_its_reservation_and_stops_later_calls_as_credit_exhausted(self):
        budget=RequestBudget(100);reserved=budget.admit(20,15)
        budget.fail(RuntimeError("Error code: 429 insufficient_quota credit_balance_exhausted"),reserved)
        self.assertTrue(budget.credit_exhausted);self.assertFalse(budget.uncertain);self.assertEqual(budget.remaining,100)
        with self.assertRaises(BudgetPreflightError) as caught:budget.stop_if_blocked()
        self.assertEqual(provider_failure(caught.exception)['code'],'AI_CREDIT_EXHAUSTED')

    def test_any_other_failure_stays_unknown_and_keeps_its_reservation(self):
        budget=RequestBudget(100);reserved=budget.admit(20,15)
        budget.fail(RuntimeError('Connection reset'),reserved)
        self.assertTrue(budget.uncertain);self.assertEqual(budget.remaining,65)
        with self.assertRaises(BudgetPreflightError) as caught:budget.stop_if_blocked()
        self.assertEqual(caught.exception.code,'PROVIDER_OUTCOME_UNKNOWN')


if __name__=='__main__':unittest.main()
