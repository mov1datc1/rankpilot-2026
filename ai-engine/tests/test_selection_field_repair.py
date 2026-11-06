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
    def test_rounded_amount_is_rejected_and_located_without_changing_source(self):
        state=self.state();before=copy.deepcopy(state);result=selection_gate(state)
        self.assertFalse(result['selection_validated'])
        self.assertEqual(result['selection_feedback']['failed_checks']['m1']['field_path'],'rationale')
        self.assertTrue(can_repair_selection({**state,**result}))
        self.assertEqual(state,before)
    def test_patch_can_change_only_rationale_and_keeps_other_decisions(self):
        state=self.state();peer={**DECISION,'matter_id':'m2','disposition':'reserve','rationale':'Overlapping work.'}
        state['strategy']['matters'].append(peer);state['package']['matters'].append({**MATTER,'id':'m2'})
        state.update(selection_gate(state));before=copy.deepcopy(state)
        def invoke(s,role,schema,instruction,payload):
            self.assertEqual([m['id'] for m in payload['sources']],['m1'])
            self.assertNotIn('disposition',schema.model_fields)
            return {'corrections':[{'matter_id':'m1','rationale':'Core for constitutional relief; stated value US$2,345,678.00.'}]},[]
        fixed=repair_selection(state,invoke)
        self.assertTrue(selection_gate({**state,**fixed})['selection_validated'])
        expected=copy.deepcopy(before['strategy']);expected['matters'][0]['rationale']=fixed['strategy']['matters'][0]['rationale']
        self.assertEqual(fixed['strategy'],expected);self.assertEqual(state,before)
        self.assertEqual(fixed['selection_repair_attempts'],1)
    def test_repeated_bad_patch_stops_before_semantic_reviewer(self):
        state=self.state();calls=[]
        def invoke(s,role,*args):
            calls.append(role)
            return {'corrections':[{'matter_id':'m1','rationale':DECISION['rationale']}]},[]
        with patch('core.review_graph.strategist',return_value={'strategy':STRATEGY,'errors':[]}),patch('core.review_graph.invoke_role',side_effect=invoke),patch('core.review_graph.develop') as develop:
            result=create_review_graph().invoke({**state,'operation':'strategy'})
        self.assertEqual(calls,['strategist']);develop.assert_not_called()
        self.assertFalse(result['selection_validated']);self.assertTrue(result['errors'])
        self.assertFalse(result.get('selection_review_validated',False))
    def test_corrected_field_still_requires_independent_review(self):
        state=self.state();calls=[]
        def invoke(s,role,*args):
            calls.append(role)
            if role=='strategist':return {'corrections':[{'matter_id':'m1','rationale':'Core for constitutional relief; value US$2,345,678.00.'}]},[]
            return {'checks':{'M01':{'status':'supported','explanation':'Documented relief and exact source value.','source_quote':'','decision_quote':'','evidence_kind':'source','rule_id':None,'rule_quote':''}}},[]
        with patch('core.review_graph.strategist',return_value={'strategy':STRATEGY,'errors':[]}),patch('core.review_graph.invoke_role',side_effect=invoke):
            result=create_review_graph().invoke({**state,'operation':'strategy'})
        self.assertEqual(calls,['strategist','selection_reviewer']);self.assertTrue(result['selection_review_validated'])
    def test_structural_failure_does_not_buy_numeric_repair(self):
        state=self.state();state['strategy']['matters'][0]['disposition']='reserve'
        result=selection_gate(state)
        self.assertFalse(result['selection_validated']);self.assertNotIn('selection_feedback',result)
    def test_shared_repair_cap_and_unknown_usage_remain_closed(self):
        state={**self.state(),**selection_gate(self.state()),'selection_repair_attempts':2}
        self.assertFalse(can_repair_selection(state))
        self.assertFalse(can_repair_selection({**state,'selection_repair_attempts':0,'selection_review_unavailable':True}))

if __name__=='__main__':unittest.main()
