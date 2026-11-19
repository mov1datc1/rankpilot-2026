"""Count the actual structured request before generation under a worker budget."""
import threading
from contextvars import ContextVar
from dataclasses import dataclass, field

BILLING_REJECTION=('insufficient_quota','credit_balance_exhausted','no credits remaining','billing_hard_limit')


RATE_LIMIT=('rate_limit_exceeded','rate limit reached')


def billing_rejection(error):
    """An explicit HTTP 429 billing refusal: the provider billed nothing."""
    return any(term in str(error).lower() for term in BILLING_REJECTION)


def rate_limited(error):
    """v1.0.108: an HTTP 429 request-rate refusal (not billing): nothing was billed."""
    text=str(error).lower()
    return not billing_rejection(error) and any(term in text for term in RATE_LIMIT)
from langchain_openai import ChatOpenAI


class BudgetPreflightError(RuntimeError):
    provider_request_started = False

    def __init__(self, code, details=None):
        super().__init__(code)
        self.code=code
        self.details=details or {}


@dataclass
class RequestBudget:
    remaining: int | None
    spent_tokens: int = 0
    uncertain: bool = False
    credit_exhausted: bool = False
    rate_limited: bool = False
    last_stop: dict = field(default_factory=dict)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False, compare=False)

    def halt(self,code,details=None):
        self.last_stop={'code':code,'details':details or {}}
        raise BudgetPreflightError(code,details)

    def stop_if_blocked(self):
        if self.credit_exhausted:self.halt('AI_CREDIT_EXHAUSTED')
        if self.rate_limited:self.halt('AI_RATE_LIMITED')
        if self.uncertain:self.halt('PROVIDER_OUTCOME_UNKNOWN')

    def admit(self, input_tokens, output_limit):
        """Reserve the worst case BEFORE sending (v1.0.106): parallel calls used
        to pass the same check and overspend the cap together (140 of 100)."""
        with self.lock:
            self.stop_if_blocked()
            if not isinstance(input_tokens,int) or isinstance(input_tokens,bool) or input_tokens<0 or output_limit<=0:
                self.halt('AI_BUDGET_CHECK_UNAVAILABLE')
            if self.remaining is not None and input_tokens+output_limit>self.remaining:
                self.halt('EDITORIAL_BUDGET_REQUIRED',{
                    'input_tokens':input_tokens,'reserved_output_tokens':output_limit,'remaining_tokens':self.remaining})
            reserved=input_tokens+output_limit if self.remaining is not None else 0
            if self.remaining is not None:self.remaining-=reserved
            return reserved

    def settle(self, result, reserved=0):
        usage=getattr(result.generations[0].message,'usage_metadata',None) if result.generations else None
        total=(usage or {}).get('total_tokens')
        with self.lock:
            if not isinstance(total,int) or isinstance(total,bool) or total<0:
                self.uncertain=True  # the reservation stays spent: outcome unknown
                raise RuntimeError('provider outcome unknown: usage unavailable')
            self.spent_tokens+=total
            if self.remaining is not None:
                self.remaining+=reserved-total

    def fail(self, error, reserved=0):
        """A billing refusal is a known, unbilled outcome; anything else is unknown."""
        with self.lock:
            if billing_rejection(error) or rate_limited(error):
                if billing_rejection(error):self.credit_exhausted=True
                else:self.rate_limited=True
                if self.remaining is not None:self.remaining+=reserved
            else:
                self.uncertain=True


request_budget=ContextVar('editorial_request_budget',default=None)
COUNT_FIELDS={'model','input','instructions','text','tools','tool_choice','reasoning',
              'parallel_tool_calls','previous_response_id','conversation','truncation'}


class BudgetedChatOpenAI(ChatOpenAI):
    # Prompt-cache plan for this call (utils.prompt_cache): None keeps the
    # provider default; 'none'/'static' use explicit mode.
    cache_plan: str | None = None

    def _get_request_payload(self,input_,*,stop=None,**kwargs):
        from utils import prompt_cache
        plan=self.cache_plan if self.cache_plan is not None else ('none' if prompt_cache.mode()=='explicit' else None)
        return prompt_cache.apply(super()._get_request_payload(input_,stop=stop,**kwargs),plan)

    def _budget_payload(self,messages,stop,kwargs):
        from utils import prompt_cache
        payload=prompt_cache.strip(self._get_request_payload(messages,stop=stop,**kwargs))
        if 'input' not in payload or not payload.get('max_output_tokens'):
            request_budget.get().halt('AI_BUDGET_CHECK_UNAVAILABLE')
        return {k:v for k,v in payload.items() if k in COUNT_FIELDS},int(payload['max_output_tokens'])

    def _generate(self,messages,stop=None,run_manager=None,**kwargs):
        budget=request_budget.get()
        if budget is None:
            return super()._generate(messages,stop=stop,run_manager=run_manager,**kwargs)
        budget.stop_if_blocked()
        reserved=0
        if budget.remaining is not None:
            payload,output_limit=self._budget_payload(messages,stop,kwargs)
            try:
                count=self.root_client.responses.input_tokens.count(**payload,timeout=10)
            except Exception:
                budget.halt('AI_BUDGET_CHECK_UNAVAILABLE')
            reserved=budget.admit(count.input_tokens,output_limit)
        try:
            result=super()._generate(messages,stop=stop,run_manager=run_manager,**kwargs)
        except Exception as error:
            budget.fail(error,reserved)
            raise
        budget.settle(result,reserved)
        return result

    async def _agenerate(self,messages,stop=None,run_manager=None,**kwargs):
        budget=request_budget.get()
        if budget is None:
            return await super()._agenerate(messages,stop=stop,run_manager=run_manager,**kwargs)
        budget.stop_if_blocked()
        reserved=0
        if budget.remaining is not None:
            payload,output_limit=self._budget_payload(messages,stop,kwargs)
            try:
                count=await self.root_async_client.responses.input_tokens.count(**payload,timeout=10)
            except Exception:
                budget.halt('AI_BUDGET_CHECK_UNAVAILABLE')
            reserved=budget.admit(count.input_tokens,output_limit)
        try:
            result=await super()._agenerate(messages,stop=stop,run_manager=run_manager,**kwargs)
        except Exception as error:
            budget.fail(error,reserved)
            raise
        budget.settle(result,reserved)
        return result
