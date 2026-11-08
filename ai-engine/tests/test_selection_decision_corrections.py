"""Selection corrections resolve decisions, with bounded measurable progress."""
import copy
import unittest
from unittest.mock import patch
from pydantic import ValidationError
from core.selection_review import can_repair_selection, repair_selection, review_selection

SOURCE='The firm coordinates local proceedings for another law firm. The represented side is not stated.'


def fixture():
    matters=[{'id':mid,'client':'Fictional '+mid,'rawNotes':SOURCE,
              'publish_status':'confidential','confidentialityConfirmed':True} for mid in ('hero','local')]
    decisions=[{'matter_id':m['id'],'disposition':'core','source_quote':SOURCE,
                'legal_understanding':SOURCE,'rationale':'Documented regional coordination.'} for m in matters]
    strategy={'matters':decisions,'hero_matter_id':'hero','pending_questions':[],'thesis':'Employer-side work.'}
    check={'status':'repair_required','explanation':'The inclusion does not establish the represented employer side.',
           'source_quote':SOURCE,'decision_quote':'core','correction_dispositions':['reserve']}
    return {'package':{'matters':matters},'strategy':strategy,
            'selection_feedback':{'strategy':strategy,'semantic_rejection':True,'failed_checks':{'local':check}}}


class SelectionDecisionCorrectionTests(unittest.TestCase):
    def test_graph_finishes_shrinking_residual_within_original_caps(self):
        from core.review_graph import create_review_graph
        state=fixture();peer={**state['package']['matters'][1],'id':'peer'}
        state['package']['matters'].append(peer)
        state['strategy']['matters'].append({**state['strategy']['matters'][1],'matter_id':'peer'})
        before=copy.deepcopy(state);calls=[]
        def invoke(current,role,schema,instruction,payload):
            calls.append(role)
            if role=='strategist':
                self.assertEqual(len(payload['rejected_decisions']),2 if calls.count(role)==1 else 1)
                return {'core_corrections':payload['rejected_decisions'],'other_corrections':[],'unresolved':[]},[]
            attempt=calls.count(role)
            failed={'local','peer'} if attempt==1 else {'local'} if attempt==2 else set()
            return {'checks':{f'M{i+1:02d}':{'status':'repair_required' if m['id'] in failed else 'supported',
                'explanation':'Concrete source interpretation needs correction.','source_quote':SOURCE if m['id'] in failed else '',
                'decision_quote':'core' if m['id'] in failed else ''} for i,m in enumerate(state['package']['matters']) if f'M{i+1:02d}' in payload['review_targets']}},[]
        with patch('core.review_graph.strategist',return_value={'strategy':state['strategy'],'errors':[]}),patch('core.review_graph.invoke_role',side_effect=invoke):
            result=create_review_graph().invoke({'package':state['package'],'operation':'strategy'})
        self.assertTrue(result['selection_review_validated'])
        self.assertEqual(result['selection_review_attempts'],3)
        self.assertEqual(result['selection_repair_attempts'],2)
        self.assertEqual(calls,['selection_reviewer','strategist','selection_reviewer','strategist','selection_reviewer'])
        self.assertEqual(state,before)

    def test_strictly_shrinking_residual_can_use_existing_second_repair(self):
        state={'selection_review_attempts':2,'selection_repair_attempts':1,
               'selection_failure_history':[['a','b','c'],['b']]}
        self.assertTrue(can_repair_selection(state))
        for changes in ({'selection_review_attempts':3},{'selection_repair_attempts':2},
                        {'selection_diagnostic_invalid':True},{'selection_review_unavailable':True}):
            self.assertFalse(can_repair_selection({**state,**changes}))

    def test_graph_repairs_smaller_batch_with_new_and_remaining_findings(self):
        from core.review_graph import create_review_graph
        state=fixture()
        for mid in ('old1','old2','old3','new'):
            state['package']['matters'].append({**state['package']['matters'][1],'id':mid})
            state['strategy']['matters'].append({**state['strategy']['matters'][1],'matter_id':mid})
        state.update(selection_review_attempts=2,selection_repair_attempts=1,
            selection_failure_history=[['local','old1','old2','old3'],['local','new']])
        state['selection_feedback']['failed_checks']['new']={**state['selection_feedback']['failed_checks']['local'],'correction_dispositions':[]}
        before=copy.deepcopy(state);calls=[]
        def invoke(current,role,schema,instruction,payload):
            calls.append(role)
            if role=='strategist':
                self.assertEqual({d['matter_id'] for d in payload['rejected_decisions']},{'local','new'})
                self.assertEqual(payload['allowed_dispositions']['local'],['reserve'])
                return {'core_corrections':[d for d in payload['rejected_decisions'] if d['matter_id']=='new'],
                    'other_corrections':[{**d,'disposition':'reserve'} for d in payload['rejected_decisions'] if d['matter_id']=='local'],
                    'unresolved':[]},[]
            return {'checks':{ref:{'status':'supported','explanation':'Corrected decision agrees with source.','source_quote':''}
                for ref in payload['review_targets']}},[]
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            result=create_review_graph().invoke({**state,'operation':'strategy'})
        self.assertTrue(result['selection_review_validated'])
        self.assertEqual(calls,['strategist','selection_reviewer'])
        self.assertEqual(result['selection_review_attempts'],3)
        self.assertEqual(result['selection_repair_attempts'],2)
        self.assertEqual(next(d for d in result['strategy']['matters'] if d['matter_id']=='local')['disposition'],'reserve')
        self.assertEqual(state,before)

    def test_fewer_failures_with_new_matter_can_use_remaining_second_repair(self):
        state={'selection_review_attempts':2,'selection_repair_attempts':1,
               'selection_failure_history':[['a','b','c','d'],['b','new']]}
        self.assertTrue(can_repair_selection(state))
        for changes in ({'selection_review_attempts':3},{'selection_repair_attempts':2},
                        {'trace':[{'usage':{'unknown_calls':1}}]},
                        {'selection_diagnostic_invalid':True}, {'selection_review_unavailable':True}):
            self.assertFalse(can_repair_selection({**state,**changes}))

    def test_same_expanding_or_partial_overlap_failures_do_not_buy_retries(self):
        for history in ([['a'],['a']],[['a','b'],['a','b']],[['a'],['a','b']],
                        [['a','b'],['b','c']]):
            self.assertFalse(can_repair_selection({'selection_review_attempts':2,
                'selection_repair_attempts':1,'selection_failure_history':history}))

    def test_diagnostic_disposition_is_source_and_decision_bound(self):
        state=fixture()
        def invoke(*args):
            return {'checks':{'M01':{'status':'supported','explanation':'Supported','source_quote':''},
                              'M02':state['selection_feedback']['failed_checks']['local']}},[]
        result=review_selection(state,invoke)
        self.assertFalse(result['selection_validated'])
        check=result['selection_feedback']['failed_checks']['local']
        self.assertTrue(check['evidence_bound'])
        self.assertEqual(check['correction_dispositions'],['reserve'])
        self.assertEqual(state['strategy']['matters'][1]['disposition'],'core')

    def test_transport_rejects_cosmetic_core_correction(self):
        state=fixture();before=copy.deepcopy(state)
        def invoke(state,role,schema,instruction,payload):
            self.assertIn('not merely its wording',instruction)
            bad={'core_corrections':[{**state['strategy']['matters'][1],
                 'rationale':'The source does not establish the represented side.'}],
                 'other_corrections':[],'unresolved':[]}
            with self.assertRaises(ValidationError):schema.model_validate(bad)
            return bad,[]
        with self.assertRaises(ValidationError):repair_selection(state,invoke)
        self.assertEqual(state,before)

    def test_reserve_correction_preserves_every_unaffected_decision_and_source(self):
        state=fixture();before=copy.deepcopy(state)
        def invoke(state,role,schema,instruction,payload):
            return {'core_corrections':[],'other_corrections':[
                {**state['strategy']['matters'][1],'disposition':'reserve',
                 'rationale':'Documented coordination retained as reserve; client side is not established.'}],
                'unresolved':[]},[]
        result=repair_selection(state,invoke)
        self.assertEqual(result['strategy']['matters'][1]['disposition'],'reserve')
        self.assertEqual(result['strategy']['matters'][0],before['strategy']['matters'][0])
        self.assertEqual(state,before)
        self.assertNotIn('selection_review_validated',result)

    def test_runtime_rejects_another_nonpermitted_disposition(self):
        state=fixture()
        result=repair_selection(state,lambda *args:({'core_corrections':[],
            'other_corrections':[{**state['strategy']['matters'][1],'disposition':'excluded'}],
            'unresolved':[]},[]))
        self.assertFalse(result['selection_validated'])
        self.assertEqual(result['strategy'],state['strategy'])
        self.assertEqual(result['selection_repair_attempts'],1)

    def test_legacy_prose_only_repair_still_retains_its_disposition(self):
        state=fixture();del state['selection_feedback']['failed_checks']['local']['correction_dispositions']
        result=repair_selection(state,lambda *args:({'core_corrections':[
            {**state['strategy']['matters'][1],'rationale':'Qualified description of original work.'}],
            'other_corrections':[],'unresolved':[]},[]))
        self.assertEqual(result['strategy']['matters'][1]['disposition'],'core')


if __name__=='__main__':
    unittest.main()
