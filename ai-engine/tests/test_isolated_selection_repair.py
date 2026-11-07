import copy
import unittest
from unittest.mock import patch
from core.selection_review import review_selection,can_repair_selection,rebind_selection_diagnostics,SELECTION_DIAGNOSTIC_CONTRACT,repair_selection
from core.review_graph import create_review_graph
import test_selection_comparison_evidence as comparison_fixture
from selection_answer_fixture import repair_answer


def fixture():
    state,verdict=comparison_fixture.ComparisonEvidenceTests().fixture()
    state['strategy'].update(thesis='Collective employment work.',pending_questions=[])
    for m in state['package']['matters']:m.update(publish_status='confidential',confidentialityConfirmed=True)
    return state,verdict


class IsolatedSelectionRepairTests(unittest.TestCase):
    def mixed(self):
        state,verdict=fixture()
        verdict['checks']['M02']={'status':'repair_required','explanation':'An unbound diagnosis must remain pending.',
            'source_quote':'Invented quotation.', 'decision_quote':state['strategy']['matters'][1]['rationale']}
        return state,verdict

    def test_mixed_verdict_repairs_only_bound_findings_and_never_approves_pending(self):
        state,verdict=self.mixed();before=copy.deepcopy(state)
        result=review_selection(state,lambda *a:(verdict,[]))
        self.assertTrue(result['selection_diagnostic_invalid']);self.assertFalse(result['selection_validated'])
        self.assertTrue(can_repair_selection(result))
        self.assertEqual(set(result['selection_feedback']['failed_checks']),{'a'})
        self.assertEqual(set(result['selection_feedback']['pending_diagnostics']),{'b'})
        self.assertEqual(result['selection_failure_history'],[['a']]);self.assertEqual(state,before)

    def run_mixed(self,resolve_pending):
        state,verdict=self.mixed();before=copy.deepcopy(state);calls=[]
        def invoke(s,role,schema,instruction,payload):
            calls.append(role)
            if role=='strategist':
                self.assertEqual([m['id'] for m in payload['sources']],['a'])
                self.assertEqual(set(schema.model_fields),{'corrections'})
                fixed={**state['strategy']['matters'][0],'rationale':'Documents collective agreements and strike prevention.'}
                return repair_answer(payload,[fixed]),s.get('trace',[])
            if calls.count(role)==1:return verdict,s.get('trace',[])
            checks={ref:{'status':'supported','explanation':'Supported interpretation.','source_quote':''} for ref in payload['review_targets']}
            if not resolve_pending:checks['M02']=verdict['checks']['M02']
            return {'checks':checks},s.get('trace',[])
        with patch('core.review_graph.strategist',return_value={'strategy':state['strategy'],'errors':[]}),patch('core.review_graph.invoke_role',side_effect=invoke):
            result=create_review_graph().invoke({'package':state['package'],'operation':'strategy'})
        self.assertEqual(calls,['selection_reviewer','strategist','selection_reviewer'])
        self.assertEqual(result['strategy']['matters'][1],before['strategy']['matters'][1])
        self.assertEqual(state,before);return result

    def test_partial_repair_and_recheck_can_finish_without_reselecting_the_portfolio(self):
        result=self.run_mixed(True)
        self.assertTrue(result['selection_review_validated']);self.assertEqual(result['selection_review_attempts'],2)
        self.assertEqual(result['selection_repair_attempts'],1)

    def test_unresolved_diagnosis_remains_a_release_blocker_after_other_repairs(self):
        result=self.run_mixed(False)
        self.assertFalse(result['selection_review_validated']);self.assertFalse(result['release_verdict']['passed'])
        self.assertTrue(result['selection_diagnostic_invalid']);self.assertEqual(result['selection_repair_attempts'],1)

    def historical(self):
        state,verdict=fixture();state.update(review_selection(state,lambda *a:(verdict,[])))
        state.update(selection_diagnostic_contract='legacy',selection_diagnostic_invalid=True,
            selection_review_unavailable=True,selection_review_attempts=2,selection_diagnostic_rechecks=1,
            selection_failure_history=[[],[]],trace=[{'role':'selection_reviewer','usage':{'total_tokens':55}}])
        state['selection_review']['checks']['a']['evidence_bound']=False
        state['selection_feedback'].update(semantic_rejection=False,failed_checks={})
        state['selection_review_proofs']={}
        return state

    def test_historical_rebind_preserves_usage_and_every_paid_counter(self):
        state=self.historical();before=copy.deepcopy(state)
        result=rebind_selection_diagnostics(state)
        self.assertEqual(result['selection_review_attempts'],2)
        self.assertEqual(result['selection_diagnostic_rechecks'],1)
        self.assertEqual(result['trace'],state['trace'])
        self.assertEqual(result['selection_rebind_report']['provider_calls'],0)
        self.assertEqual(result['selection_rebind_report']['previous_failure_history'],[[],[]])
        self.assertTrue(can_repair_selection({**state,**result}));self.assertFalse(result['selection_validated'])
        self.assertEqual(state,before)
        self.assertIsNone(rebind_selection_diagnostics({**state,**result}))

    def test_same_historical_attempt_uses_only_its_remaining_review_after_repair(self):
        state=self.historical();calls=[]
        def invoke(s,role,schema,instruction,payload):
            calls.append(role)
            trace=s.get('trace',[])+[{'role':role,'usage':{'total_tokens':10}}]
            if role=='strategist':
                fixed={**state['strategy']['matters'][0],'rationale':'Documents strike prevention alongside union litigation.'}
                return repair_answer(payload,[fixed]),trace
            return {'checks':{ref:{'status':'supported','explanation':'Supported after correction.','source_quote':''} for ref in payload['review_targets']}},trace
        with patch('core.review_graph.strategist',side_effect=AssertionError('Must reuse saved strategy')),patch('core.review_graph.invoke_role',side_effect=invoke):
            result=create_review_graph().invoke({**state,'operation':'strategy'})
        self.assertEqual(calls,['strategist','selection_reviewer'])
        self.assertTrue(result['selection_review_validated']);self.assertEqual(result['selection_review_attempts'],3)
        self.assertEqual(result['selection_repair_attempts'],1)
        self.assertEqual(sum(t['usage']['total_tokens'] for t in result['trace']),75)

    def test_rebind_does_not_accept_changed_coverage_or_unknown_provider_usage(self):
        state=self.historical();state['trace'].append({'usage':{'unknown_calls':1}})
        self.assertIsNone(rebind_selection_diagnostics(state));self.assertFalse(can_repair_selection(state))
        state=self.historical();del state['selection_review']['checks']['b']
        self.assertIsNone(rebind_selection_diagnostics(state))

    def test_patch_transport_rejects_source_and_unlisted_matter_changes(self):
        from pydantic import ValidationError
        state,verdict=fixture();state.update(review_selection(state,lambda *a:(verdict,[])))
        for mid,path in [('a','source_quote'),('b','rationale'),('a','disposition')]:
            with self.subTest(mid=mid,path=path),self.assertRaises(ValidationError):
                repair_selection(state,lambda *a:({'corrections':[{'matter_id':mid,'field_path':path,'text':'Changed.'}]*2},[]))

    def test_mixed_structural_repair_cannot_rewrite_a_prose_targets_source_quote(self):
        state,verdict=fixture()
        # The peer must change disposition; the first target has only prose work.
        verdict['checks']['M02']={'status':'repair_required','explanation':'Reserve this decision.',
            'source_quote':state['package']['matters'][1]['source_excerpt'],
            'decision_quote':'core','correction_dispositions':['reserve']}
        state['strategy']['hero_matter_id']='a'
        state.update(review_selection(state,lambda *a:(verdict,[])))
        a,b=state['strategy']['matters']
        result=repair_selection(state,lambda *args:({'core_corrections':[{**a,'source_quote':'A rewritten source.'}],
            'other_corrections':[{**b,'disposition':'reserve'}],'unresolved':[]},[]))
        self.assertFalse(result['selection_validated']);self.assertEqual(result['strategy'],state['strategy'])
        self.assertEqual(result['selection_repair_attempts'],1)
