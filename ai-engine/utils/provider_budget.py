"""Count the actual structured request before generation under a worker budget."""
from contextvars import ContextVar
from dataclasses import dataclass, field
from langchain_openai import ChatOpenAI


class BudgetPreflightError(RuntimeError):
    provider_request_started = False

    def __init__(self, code, details=None):
        super().__init__(code)
        self.code=code
        self.details=details or {}


@dataclass
class RequestBudget:
    remaining: int
    uncertain: bool = False
    last_stop: dict = field(default_factory=dict)

    def halt(self,code,details=None):
        self.last_stop={'code':code,'details':details or {}}
        raise BudgetPreflightError(code,details)

    def admit(self, input_tokens, output_limit):
        if self.uncertain:
            self.halt('PROVIDER_OUTCOME_UNKNOWN')
        if not isinstance(input_tokens,int) or isinstance(input_tokens,bool) or input_tokens<0 or output_limit<=0:
            self.halt('AI_BUDGET_CHECK_UNAVAILABLE')
        if input_tokens+output_limit>self.remaining:
            self.halt('EDITORIAL_BUDGET_REQUIRED',{
                'input_tokens':input_tokens,'reserved_output_tokens':output_limit,'remaining_tokens':self.remaining})

    def settle(self, result):
        usage=getattr(result.generations[0].message,'usage_metadata',None) if result.generations else None
        total=(usage or {}).get('total_tokens')
        if not isinstance(total,int) or isinstance(total,bool) or total<0:
            self.uncertain=True
            raise RuntimeError('provider outcome unknown: usage unavailable')
        self.remaining-=total


request_budget=ContextVar('editorial_request_budget',default=None)
COUNT_FIELDS={'model','input','instructions','text','tools','tool_choice','reasoning',
              'parallel_tool_calls','previous_response_id','conversation','truncation'}


class BudgetedChatOpenAI(ChatOpenAI):
    def _budget_payload(self,messages,stop,kwargs):
        payload=self._get_request_payload(messages,stop=stop,**kwargs)
        if 'input' not in payload or not payload.get('max_output_tokens'):
            request_budget.get().halt('AI_BUDGET_CHECK_UNAVAILABLE')
        return {k:v for k,v in payload.items() if k in COUNT_FIELDS},int(payload['max_output_tokens'])

    def _generate(self,messages,stop=None,run_manager=None,**kwargs):
        budget=request_budget.get()
        if budget is None:
            return super()._generate(messages,stop=stop,run_manager=run_manager,**kwargs)
        if budget.uncertain:budget.halt('PROVIDER_OUTCOME_UNKNOWN')
        payload,output_limit=self._budget_payload(messages,stop,kwargs)
        try:
            count=self.root_client.responses.input_tokens.count(**payload,timeout=10)
        except Exception:
            budget.halt('AI_BUDGET_CHECK_UNAVAILABLE')
        budget.admit(count.input_tokens,output_limit)
        try:
            result=super()._generate(messages,stop=stop,run_manager=run_manager,**kwargs)
            budget.settle(result)
            return result
        except Exception:
            budget.uncertain=True
            raise

    async def _agenerate(self,messages,stop=None,run_manager=None,**kwargs):
        budget=request_budget.get()
        if budget is None:
            return await super()._agenerate(messages,stop=stop,run_manager=run_manager,**kwargs)
        if budget.uncertain:budget.halt('PROVIDER_OUTCOME_UNKNOWN')
        payload,output_limit=self._budget_payload(messages,stop,kwargs)
        try:
            count=await self.root_async_client.responses.input_tokens.count(**payload,timeout=10)
        except Exception:
            budget.halt('AI_BUDGET_CHECK_UNAVAILABLE')
        budget.admit(count.input_tokens,output_limit)
        try:
            result=await super()._agenerate(messages,stop=stop,run_manager=run_manager,**kwargs)
            budget.settle(result)
            return result
        except Exception:
            budget.uncertain=True
            raise
