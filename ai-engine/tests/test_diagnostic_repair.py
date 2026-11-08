import copy,json,unittest
from enum import Enum
from types import SimpleNamespace
from typing import Literal
from unittest.mock import patch
from pydantic import BaseModel,ConfigDict,ValidationError,create_model
from core.diagnostic_repair import diagnostic_plan,repair_diagnostic
from core.review_graph import invoke_role,EditorialResponseError
from utils.provider_errors import provider_failure

class SourceRef(str,Enum):
    ONE='S1'
class Proof(BaseModel):
    model_config=ConfigDict(extra='forbid')
    status:Literal['met','failed']
    source_ref:SourceRef
    artifact_ref:Literal['P1']
    reason:str
class Verdict(BaseModel):
    passed:bool
    acceptance:list[str]
    defects:list[str]
    case_checks:create_model('OwnChecks',one=(Proof,...),two=(Proof,...))


def fixture():
    good={'status':'met','source_ref':'S1','artifact_ref':'P1','reason':'The own original and output support this check.'}
    bad={'passed':False,'acceptance':['failed criterion retained'],'defects':['Critical finding retained'],
        'case_checks':{'one':{**good,'source_ref':'invented'},'two':good}}
    payload={'package':{'matters':[{'id':'one','source_excerpt':'Own source words.'},{'id':'other','source_excerpt':'Unrelated source must not be resent.'}]},
        'development':{'b10':'Current exact output.'},'letter':{},
        'case_obligations':[{'id':'one','field':'b10','sources':[{'id':'one','source_excerpt':'Own source words.'}],'instruction':'Check own evidence.'}],
        'source_passages':{'S1':'Own source words.','FOREIGN':'Unrelated source must not be resent.'}}
    try:Verdict.model_validate(bad)
    except ValidationError as error:return good,bad,payload,error

class DiagnosticRepairTests(unittest.TestCase):
    def test_only_invalid_item_is_rechecked_and_valid_decisions_are_immutable(self):
        good,bad,payload,error=fixture();before=copy.deepcopy((bad,payload));calls=[]
        def invoke(state,role,schema,instruction,context):
            calls.append(context);self.assertEqual(role,'diagnostic_reviewer')
            self.assertEqual(set(context['targets']),{'T01'})
            self.assertNotIn('Unrelated source',json.dumps(context));self.assertEqual(set(context['source_passages']),{'S1'})
            strict=schema.model_json_schema();self.assertNotIn('passed',strict['properties'])
            return {'repairs':{'T01':{'value':{**good,'status':'failed'},'reason':'Fresh scoped assessment remains a failure.'}}},state['trace']+[{'role':role,'usage':{'total_tokens':12}}]
        fixed,trace=repair_diagnostic({},Verdict,bad,error,payload,[{'usage':{'total_tokens':100}}],invoke)
        self.assertEqual(len(calls),1);self.assertEqual(fixed['case_checks']['two'],bad['case_checks']['two'])
        for key in ('passed','acceptance','defects'):self.assertEqual(fixed[key],bad[key])
        self.assertEqual(fixed['case_checks']['one']['status'],'failed');self.assertEqual(sum(t['usage']['total_tokens'] for t in trace),112)
        self.assertEqual((bad,payload),before)

    def test_global_acceptance_errors_and_unaddressable_items_do_not_buy_a_scoped_call(self):
        good,bad,payload,error=fixture();bad['acceptance']=None
        try:Verdict.model_validate(bad)
        except ValidationError as e:self.assertIsNone(diagnostic_plan(Verdict,bad,e))
        with patch('core.diagnostic_repair.scoped_diagnostic_context',return_value=None),patch('core.review_graph.invoke_role') as invoke:
            self.assertIsNone(repair_diagnostic({},Verdict,bad,error,payload,[],invoke))
            invoke.assert_not_called()

    def test_failed_merge_preserves_the_second_paid_trace(self):
        good,bad,payload,error=fixture()
        def invoke(state,*args):return {'repairs':{'T01':{'value':{**good,'source_ref':'wrong'},'reason':'Invalid result'}}},state['trace']+[{'usage':{'total_tokens':12}}]
        with self.assertRaises(ValidationError) as caught:
            repair_diagnostic({},Verdict,bad,error,payload,[{'usage':{'total_tokens':100}}],invoke)
        self.assertEqual(sum(t['usage']['total_tokens'] for t in caught.exception.trace_history),112)

    def run_native_boundary(self,second=None,transport_error=False):
        good,bad,payload,error=fixture();calls=[];model=SimpleNamespace()
        def call(messages):
            calls.append(messages)
            if len(calls)==2 and transport_error:raise RuntimeError('Connection lost after request')
            value=bad if len(calls)==1 else (second or {'repairs':{'T01':{'value':good,'reason':'Exact own source reference restored.'}}})
            raw=SimpleNamespace(id='existing'+str(len(calls)),usage_metadata={'total_tokens':100 if len(calls)==1 else 12},response_metadata={'status':'completed','model_name':'gpt-5.6-sol'})
            return {'raw':raw,'parsed':value,'parsing_error':None}
        model.model_copy=lambda **kwargs:model
        model.with_structured_output=lambda *args,**kwargs:SimpleNamespace(invoke=call)
        with patch('core.review_graph.create_chat_model',return_value=model):
            try:return invoke_role({'package':payload['package'],'trace':[{'usage':{'total_tokens':7}}]},'editor',Verdict,'Review exact output.',payload),calls
            except Exception as error:return error,calls

    def test_real_invoke_route_uses_one_small_second_request_not_another_full_review(self):
        result,calls=self.run_native_boundary();self.assertFalse(isinstance(result,Exception),str(result))
        value,trace=result;self.assertEqual(len(calls),2);self.assertEqual(value['acceptance'],['failed criterion retained'])
        self.assertEqual(sum(t['usage']['total_tokens'] for t in trace),119)
        self.assertTrue(trace[-1]['diagnostic_recheck']['acceptance_preserved'])
        self.assertFalse(trace[-1]['diagnostic_recheck']['full_review_repeated'])
        self.assertNotIn('Unrelated source',str(calls[1]))

    def test_scoped_failure_is_terminal_for_full_retry_and_retains_all_known_usage(self):
        result,calls=self.run_native_boundary(second={'repairs':{'T01':{'value':{'status':'met','source_ref':'wrong','artifact_ref':'P1','reason':'wrong'},'reason':'wrong'}}})
        self.assertIsInstance(result,EditorialResponseError);self.assertEqual(len(calls),2)
        self.assertFalse(provider_failure(result)['retryable'])
        self.assertEqual(sum(t.get('usage',{}).get('total_tokens',0) for t in result.trace_history),119)

    def test_connection_loss_in_scoped_recheck_is_unknown_not_zero_and_never_retried(self):
        result,calls=self.run_native_boundary(transport_error=True)
        self.assertEqual(len(calls),2);self.assertFalse(provider_failure(result)['retryable'])
        self.assertEqual(result.trace_history[-1]['usage'],{'unknown_calls':1})
        self.assertEqual(sum(t.get('usage',{}).get('total_tokens',0) for t in result.trace_history),107)

    def test_malformed_register_evidence_is_rechecked_as_one_owned_item_not_a_full_verdict(self):
        from core.register_review import register_verdict_contract
        from core.review_graph import Verdict as FullVerdict
        from core.diagnostic_repair import validate_diagnostic_bindings
        package={'rendered_artifact':'The team handled labour proceedings.','rendered_audit':'The firm handled the disputes.',
            'matters':[{'id':'m1','source_excerpt':'The client manages private security workforces.',
                'confidentialityEvidence':{'client_register':[{'quote':'Example Client | Private education'}]}}]}
        schema=register_verdict_contract(package,FullVerdict)
        check={'relationship':'conflicting','rationale':'Compare the same industry attribute.', 'register_quote':'Foreign industry',
            'narrative_quote':'private security workforces','nonessential_sector':True,'claims':[]}
        value=schema.model_validate({'passed':False,'defects':[],'acceptance':[],'case_checks':[], 'register_checks':{'m1':check}}).model_dump(mode='json')
        try:validate_diagnostic_bindings(schema,value,{'package':package})
        except ValidationError as error:
            def invoke(state,role,contract,instruction,context):
                self.assertEqual(context['targets']['T01']['key'],'m1')
                return {'repairs':{'T01':{'value':{**check,'register_quote':'Private education'},'reason':'Use the original row of this same client.'}}},[{'usage':{'total_tokens':8}}]
            fixed,trace=repair_diagnostic({},schema,value,error,{'package':package},[],invoke)
        self.assertFalse(fixed['passed']);self.assertEqual(fixed['register_checks']['m1']['register_quote'],'Private education')
        self.assertEqual(trace[-1]['diagnostic_recheck']['items'],1)

    def test_typed_but_still_foreign_register_quote_is_not_a_successful_recheck(self):
        from core.register_review import register_verdict_contract
        from core.review_graph import Verdict as FullVerdict
        from core.diagnostic_repair import validate_diagnostic_bindings
        p={'rendered_artifact':'Employment work.','rendered_audit':'Internal work.',
            'matters':[{'id':'m','source_excerpt':'Narrative security.', 'confidentialityEvidence':{'client_register':[{'quote':'Source education'}]}}]}
        schema=register_verdict_contract(p,FullVerdict)
        check={'relationship':'conflicting','rationale':'Grounding required','register_quote':'Foreign','narrative_quote':'security','nonessential_sector':True,'claims':[]}
        value=schema.model_validate({'passed':False,'defects':[],'acceptance':[],'case_checks':[], 'register_checks':{'m':check}}).model_dump(mode='json')
        try:validate_diagnostic_bindings(schema,value,{'package':p})
        except ValidationError as error:
            def invoke(state,*args):return {'repairs':{'T01':{'value':check,'reason':'Still invalid.'}}},[{'usage':{'total_tokens':9}}]
            with self.assertRaises(ValidationError) as caught:repair_diagnostic({},schema,value,error,{'package':p},[],invoke)
        self.assertEqual(caught.exception.trace_history[-1]['usage']['total_tokens'],9)

    def test_later_editor_gate_keeps_both_paid_calls_without_overriding_failed_acceptance(self):
        from core.review_graph import editor,ACCEPTANCE_CRITERIA
        from test_editorial_development import PACKAGE,STRATEGY,DEV
        verdict={'passed':False,'defects':[],'acceptance':[{'criterion':c,'status':'failed' if c=='decisive_evidence' else 'met','evidence':'A concrete full review finding is still missing.'} for c in ACCEPTANCE_CRITERIA]}
        trace=[{'role':'editor','usage':{'total_tokens':100}},{'role':'diagnostic_reviewer','usage':{'total_tokens':12}}]
        with patch('core.review_graph.invoke_role',return_value=(verdict,trace)):
            with self.assertRaises(EditorialResponseError) as caught:editor({'package':{**PACKAGE,'editorial_development':DEV},'strategy':STRATEGY,'letter':{}})
        self.assertEqual(sum(t['usage']['total_tokens'] for t in caught.exception.trace_history),112)
        self.assertFalse(provider_failure(caught.exception)['retryable'])
