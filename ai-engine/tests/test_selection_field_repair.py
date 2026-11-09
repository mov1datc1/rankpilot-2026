import copy
import unittest
from unittest.mock import patch
from core.review_graph import create_review_graph, selection_gate
from core.selection_review import repair_selection, can_repair_selection

SOURCE='The firm restored procedural rights through constitutional proceedings.'
MATTER={'id':'m1','client':'Example','rawNotes':SOURCE,'value':'US$ 2,345,678.00','publish_status':'confidential'}
DECISION={'matter_id':'m1','disposition':'core','rationale':'Core for constitutional relief; stated value US$2.34 million.',
          'source_quote':SOURCE,'legal_understanding':'Constitutional relief restored procedural rights.'}
STRATEGY={'matters':[DECISION],'hero_matter_id':'m1','pending_questions':[],'thesis':'Procedural labour litigation.'}

class SelectionFieldRepairTests(unittest.TestCase):
    def state(self):return {'package':{'directory':'Chambers','matters':[copy.deepcopy(MATTER)]},'strategy':copy.deepcopy(STRATEGY)}
    def test_foreign_quote_repairs_the_coupled_interpretation_not_only_the_quote(self):
        state=self.state();state['strategy']['matters'][0].update(rationale='Foreign work.',legal_understanding='A different mandate.',source_quote='The firm negotiated a collective agreement.')
        state['package']['matters'].append({**MATTER,'id':'m2','source_excerpt':'The firm negotiated a collective agreement.'})
        state['strategy']['matters'].append({**DECISION,'matter_id':'m2','disposition':'reserve','source_quote':'The firm negotiated a collective agreement.','rationale':'Collective work.'})
        result=selection_gate(state)
        target=result['selection_feedback']['failed_checks']['m1']
        self.assertEqual(set(target['field_paths']),{'source_quote','rationale','legal_understanding'})
        self.assertEqual(target['foreign_quote_matter_ids'],['m2'])

    def test_first_semantic_review_after_resolved_grounding_can_use_remaining_attempt(self):
        from test_selection_decision_evidence import PACKAGE, STRATEGY, check, DECISION as D
        from core.selection_review import review_selection
        state={'package':copy.deepcopy(PACKAGE),'strategy':copy.deepcopy(STRATEGY),
            'selection_repair_attempts':1,'selection_failure_history':[['m1']],
            'selection_repair_report':{'portfolio_preserved':True,'unaffected_decisions_preserved':True,'field_paths':['source_quote'],'corrected_matter_ids':['m1']}}
        state.update(review_selection(state,lambda *args:(check(D['rationale']),[{'usage':{'total_tokens':7}}])))
        before=copy.deepcopy(state)
        self.assertTrue(can_repair_selection(state));self.assertEqual(state,before)
        for change in [{'selection_repair_attempts':2},{'selection_review_attempts':2},{'selection_review_attempts':3},{'trace':[{'usage':{'unknown_calls':1}}]},{'selection_diagnostic_invalid':True}]:
            self.assertFalse(can_repair_selection({**state,**change}))
        state['strategy']['matters'][0]['source_quote']='Still invented'
        self.assertFalse(can_repair_selection(state))

    def test_graph_repairs_first_semantic_finding_after_literal_patch_without_reset(self):
        from test_selection_decision_evidence import PACKAGE, STRATEGY, SOURCE as OWN, check, DECISION as D
        strategy=copy.deepcopy(STRATEGY);strategy['matters'][0]['source_quote']='Invented initial quote'
        calls=[]
        def invoke(state,role,schema,instruction,payload):
            calls.append(role)
            if role=='strategist':
                corrections=[]
                for mid,c in payload['failed_checks'].items():
                    for field in c['field_paths']:
                        corrections.append({'matter_id':mid,'field_path':field,'text':OWN if field=='source_quote' else 'The firm implemented employment agreements and workplace regulations.'})
                answer={'corrections':corrections}
            elif calls.count('selection_reviewer')==1:answer=check(D['rationale'])
            else:answer={'checks':{'M01':{'status':'supported','explanation':'Own deliverables are accurately stated.','source_quote':''}}}
            return answer,state.get('trace',[])+[{'role':role,'usage':{'total_tokens':7}}]
        with patch('core.review_graph.strategist',return_value={'strategy':strategy,'errors':[]}),patch('core.review_graph.invoke_role',side_effect=invoke):
            result=create_review_graph().invoke({'package':copy.deepcopy(PACKAGE),'operation':'strategy'})
        self.assertEqual(calls,['strategist','selection_reviewer','strategist','selection_reviewer'])
        self.assertTrue(result['selection_review_validated'])
        self.assertEqual(result['selection_repair_attempts'],2)
        self.assertEqual(result['selection_review_attempts'],2)
        self.assertEqual(sum(t['usage']['total_tokens'] for t in result['trace']),28)
        self.assertEqual(result['strategy']['hero_matter_id'],'m1')

    def test_rounded_amount_is_rejected_and_located_without_changing_source(self):
        state=self.state();before=copy.deepcopy(state);result=selection_gate(state)
        self.assertFalse(result['selection_validated'])
        self.assertEqual(result['selection_feedback']['failed_checks']['m1']['field_paths'],['rationale'])
        self.assertTrue(can_repair_selection({**state,**result}))
        self.assertEqual(state,before)
    def test_patch_can_change_only_rationale_and_keeps_other_decisions(self):
        state=self.state();peer={**DECISION,'matter_id':'m2','disposition':'reserve','rationale':'Overlapping work.'}
        state['strategy']['matters'].append(peer);state['package']['matters'].append({**MATTER,'id':'m2'})
        state.update(selection_gate(state));before=copy.deepcopy(state)
        def invoke(s,role,schema,instruction,payload):
            self.assertEqual([m['id'] for m in payload['sources']],['m1'])
            self.assertNotIn('disposition',schema.model_fields)
            return {'corrections':[{'matter_id':'m1','field_path':'rationale','text':'Core for constitutional relief; stated value US$2,345,678.00.'}]},[]
        fixed=repair_selection(state,invoke)
        self.assertTrue(selection_gate({**state,**fixed})['selection_validated'])
        expected=copy.deepcopy(before['strategy']);expected['matters'][0]['rationale']=fixed['strategy']['matters'][0]['rationale']
        self.assertEqual(fixed['strategy'],expected);self.assertEqual(state,before)
        self.assertEqual(fixed['selection_repair_attempts'],1)
    def test_repeated_bad_patch_stops_before_semantic_reviewer(self):
        state=self.state();calls=[]
        def invoke(s,role,*args):
            calls.append(role)
            return {'corrections':[{'matter_id':'m1','field_path':'rationale','text':DECISION['rationale']}]},[]
        with patch('core.review_graph.strategist',return_value={'strategy':STRATEGY,'errors':[]}),patch('core.review_graph.invoke_role',side_effect=invoke),patch('core.review_graph.develop') as develop:
            result=create_review_graph().invoke({**state,'operation':'strategy'})
        self.assertEqual(calls,['strategist']);develop.assert_not_called()
        self.assertFalse(result['selection_validated']);self.assertTrue(result['errors'])
        self.assertFalse(result.get('selection_review_validated',False))
    def test_corrected_field_still_requires_independent_review(self):
        state=self.state();calls=[]
        def invoke(s,role,*args):
            calls.append(role)
            if role=='strategist':return {'corrections':[{'matter_id':'m1','field_path':'rationale','text':'Core for constitutional relief; value US$2,345,678.00.'}]},[]
            return {'checks':{'M01':{'status':'supported','explanation':'Documented relief and exact source value.','source_quote':'','decision_quote':'','evidence_kind':'source','rule_id':None,'rule_quote':''}}},[]
        with patch('core.review_graph.strategist',return_value={'strategy':STRATEGY,'errors':[]}),patch('core.review_graph.invoke_role',side_effect=invoke):
            result=create_review_graph().invoke({**state,'operation':'strategy'})
        self.assertEqual(calls,['strategist','selection_reviewer']);self.assertTrue(result['selection_review_validated'])
    def test_invalid_generated_quote_can_be_repaired_without_changing_rationale(self):
        state=self.state();state['strategy']['matters'][0].update(rationale='Core for constitutional relief.',source_quote='Invented quotation about a different case.')
        state.update(selection_gate(state));self.assertTrue(state['selection_field_repairable'])
        fixed=repair_selection(state,lambda *args:({'corrections':[{'matter_id':'m1','field_path':'source_quote','text':SOURCE}]},[]))
        self.assertEqual(fixed['strategy']['matters'][0]['rationale'],'Core for constitutional relief.')
        self.assertTrue(selection_gate({**state,**fixed})['selection_validated'])

    def test_undeclared_field_patch_cannot_change_strategy(self):
        state=self.state();state.update(selection_gate(state))
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            repair_selection(state,lambda *args:({'corrections':[{'matter_id':'m1','field_path':'source_quote','text':SOURCE}]},[]))

    def test_own_supplementary_source_number_is_not_an_invention(self):
        state=self.state();state['package']['matters'][0]['otherInfo']='The documented exposure was USD 7654321.'
        state['strategy']['matters'][0]['rationale']='Constitutional relief on exposure USD 7654321.'
        self.assertTrue(selection_gate(state)['selection_validated'])

    def test_structural_failure_does_not_buy_numeric_repair(self):
        state=self.state();state['strategy']['matters'][0]['disposition']='reserve'
        result=selection_gate(state)
        self.assertFalse(result['selection_validated']);self.assertNotIn('selection_feedback',result)
    def test_shared_repair_cap_and_unknown_usage_remain_closed(self):
        state={**self.state(),**selection_gate(self.state()),'selection_repair_attempts':2}
        self.assertFalse(can_repair_selection(state))
        self.assertFalse(can_repair_selection({**state,'selection_repair_attempts':0,'selection_review_unavailable':True}))

if __name__=='__main__':unittest.main()
