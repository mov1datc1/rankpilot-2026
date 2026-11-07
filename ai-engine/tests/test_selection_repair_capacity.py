"""A grounded local repair must still fit the complete portfolio."""
import copy
import unittest
from unittest.mock import patch
from pydantic import ValidationError
from core.review_graph import create_review_graph, selection_gate
from core.selection_review import repair_selection

SOURCE='The firm coordinated collective bargaining and documented workforce transition.'

def fixture(count=20):
    matters=[{'id':f'm{i}','client':f'Fictional Client {i}','source_excerpt':SOURCE,
              'publish_status':'confidential','confidentialityConfirmed':True} for i in range(count+1)]
    decisions=[{'matter_id':m['id'],'disposition':'core' if i<count else 'reserve',
        'rationale':'Distinct documented collective bargaining work.','legal_understanding':SOURCE,'source_quote':SOURCE}
        for i,m in enumerate(matters)]
    strategy={'matters':decisions,'hero_matter_id':'m0','pending_questions':[],'thesis':'Collective employment work.'}
    package={'directory':'Chambers','practice_area':'Labour & Employment','matters':matters}
    return package,strategy

def repair_state(package,strategy,failed):
    checks={mid:{'status':'repair_required','explanation':'Use a comparative rationale, not missing optional publication consent.','source_quote':SOURCE} for mid in failed}
    return {'package':package,'strategy':strategy,'selection_feedback':{'strategy':strategy,'semantic_rejection':True,'failed_checks':checks}}

class SelectionRepairCapacityTests(unittest.TestCase):
    def test_full_portfolio_can_repair_reserve_reason_and_independently_pass(self):
        package,strategy=fixture();original=copy.deepcopy((package,strategy));calls=[]
        def invoke(state,role,schema,instruction,payload):
            calls.append(role)
            if role=='strategist':
                self.assertEqual(payload['portfolio_constraints']['correction_core_capacity'],0)
                self.assertEqual(len(payload['unchanged_core_context']),20)
                corrected={**strategy['matters'][-1],'rationale':'Reserve because the selected mandates document more differentiated collective negotiations; consent remains unconfirmed.'}
                answer={'core_corrections':[],'other_corrections':[corrected],'unresolved':[]}
                return schema.model_validate(answer).model_dump(),[]
            return {'checks':{f'M{i+1:02d}':{'status':'repair_required' if len(calls)==1 and i==20 else 'supported',
                'explanation':'Compare legal contribution rather than optional consent.','source_quote':SOURCE if i==20 else '', 'decision_quote':strategy['matters'][i]['rationale'] if i==20 else ''} for i in range(21)}},[]
        with patch('core.review_graph.strategist',return_value={'strategy':strategy,'errors':[]}),patch('core.review_graph.invoke_role',side_effect=invoke),patch('core.review_graph.develop') as develop:
            result=create_review_graph().invoke({'package':package,'operation':'strategy'})
        self.assertEqual(calls,['selection_reviewer','strategist','selection_reviewer'])
        self.assertTrue(result['selection_review_validated'])
        self.assertEqual(sum(d['disposition']=='core' for d in result['strategy']['matters']),20)
        self.assertEqual(result['strategy']['matters'][:-1],strategy['matters'][:-1])
        self.assertEqual((package,strategy),original)
        self.assertNotIn('approved_artifact',result)
        develop.assert_not_called()

    def test_schema_and_runtime_both_reject_twenty_first_core(self):
        package,strategy=fixture();state=repair_state(package,strategy,['m20'])
        def invoke(state,role,schema,instruction,payload):
            bad={'core_corrections':[{**strategy['matters'][-1],'disposition':'core'}],'other_corrections':[],'unresolved':[]}
            with self.assertRaises(ValidationError):schema.model_validate(bad)
            return bad,[]
        with self.assertRaises(ValidationError):repair_selection(state,invoke)
        self.assertEqual(sum(d['disposition']=='core' for d in strategy['matters']),20)

    def test_paired_swap_only_changes_rejected_decisions_and_preserves_hero(self):
        package,strategy=fixture();state=repair_state(package,strategy,['m19','m20'])
        state['selection_feedback']['failed_checks']['m19']['correction_dispositions']=['reserve']
        state['selection_feedback']['failed_checks']['m20']['correction_dispositions']=['core']
        def invoke(state,role,schema,instruction,payload):
            self.assertEqual(payload['portfolio_constraints']['correction_core_capacity'],1)
            return {'core_corrections':[{**strategy['matters'][-1],'disposition':'core'}],
                    'other_corrections':[{**strategy['matters'][-2],'disposition':'reserve'}],'unresolved':[]},[]
        result=repair_selection(state,invoke)
        self.assertEqual(result['strategy']['matters'][:-2],strategy['matters'][:-2])
        self.assertEqual(result['strategy']['hero_matter_id'],'m0')
        self.assertTrue(selection_gate({'package':package,**result})['selection_validated'])
        self.assertNotIn('selection_review_validated',result)

    def test_promotion_can_use_real_spare_capacity(self):
        package,strategy=fixture(19);state=repair_state(package,strategy,['m19'])
        state['selection_feedback']['failed_checks']['m19']['correction_dispositions']=['core']
        def invoke(state,role,schema,instruction,payload):
            self.assertEqual(payload['portfolio_constraints']['correction_core_capacity'],1)
            return {'core_corrections':[{**strategy['matters'][-1],'disposition':'core'}],'other_corrections':[],'unresolved':[]},[]
        result=repair_selection(state,invoke)
        self.assertTrue(selection_gate({'package':package,**result})['selection_validated'])
        self.assertEqual(sum(d['disposition']=='core' for d in result['strategy']['matters']),20)
