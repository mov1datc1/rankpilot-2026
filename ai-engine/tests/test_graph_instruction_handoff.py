import copy
import unittest
from contextlib import ExitStack
from unittest.mock import patch
from core.field_review import units_for, project_checks, schedule
from test_field_review import state, verdict
from test_review_graph import LETTER


class GraphInstructionHandoffTests(unittest.TestCase):
    def test_category_review_sees_action_and_missing_criterion_in_their_own_fields(self):
        from test_biography_depth import depth_case
        from core.field_review import review_payload
        p,s,v=depth_case();c=v['candidates'][0]
        c.update(suggested_ranking='Category pending',category_missing_criterion='Specific career-stage criterion.',
                 recommended_action='Confirm the documented career-stage evidence.')
        unit=next(u for u in units_for({'package':p,'strategy':s,'development':v})
                  if u['field']=='candidates/0/category_rationale')
        payload=review_payload([unit])
        import json
        serialized=json.dumps(payload)
        self.assertIn(c['category_missing_criterion'],serialized)
        self.assertIn(c['recommended_action'],serialized)

    def test_failed_diagnostic_releases_rejected_bio_wording_for_correction(self):
        from test_biography_depth import depth_case
        from core.editorial_repair import repair_rejected_development, coherent_repair_targets
        p,s,v=depth_case();current={'package':p,'strategy':s,'development':v}
        unit=next(u for u in units_for(current) if u['field']=='candidates/0/submission_bio')
        answer=verdict([unit],unit['field'])
        for check in answer['checks'].values():check['failure_kind']='unsupported_claim'
        _,defects=project_checks([unit],answer)
        with patch('core.review_graph.invoke_role',side_effect=AssertionError('No paid locator')), \
             patch('core.editorial_repair.repair_development',return_value={}) as repair:
            repair_rejected_development(current,v,defects)
        targets=coherent_repair_targets(v,repair.call_args.args[2],p)
        target=targets['candidates/0']
        self.assertTrue(target.get('rejected_quotes'))
        for protected in target.get('preserve_generated_quotes',[]):
            self.assertFalse(any(protected in rejected or rejected in protected for rejected in target['rejected_quotes']))

    def test_wrong_claim_is_not_projected_as_missing_information(self):
        units=units_for(state())[:1]
        answer=verdict(units,units[0]['field'])
        for check in answer['checks'].values():
            check['failure_kind']='unsupported_claim'
            check['reason']='The source attributes the action to the firm, not the person.'
        _,defects=project_checks(units,answer)
        self.assertTrue(defects)
        self.assertTrue(all(d['code']=='UNSUPPORTED_CLAIM' for d in defects))

    def test_resolved_history_is_not_sent_back_as_active_feedback(self):
        current=state();units=units_for(current)
        receipts,_=project_checks(units,verdict(units))
        stale={'field_path':units[0]['field'],'message':'Old defect already corrected.'}
        parent={'scope':'letter','message':'Reconcile the companion Audit.'}
        current.update(field_review_receipts=receipts,field_review_reconciled_feedback=[stale],
                       field_review_parent_feedback=[parent])
        result=schedule(current)
        self.assertEqual(result['repair_feedback'],[parent])
        self.assertEqual(current['field_review_reconciled_feedback'],[stale])

    def test_current_observations_remain_active_even_when_history_differs(self):
        current=state();units=units_for(current);target=units[0]
        receipts,_=project_checks(units[1:],verdict(units[1:]))
        pending={'field_path':target['field'],'message':'Still unresolved in this exact text.'}
        current.update(field_review_receipts=receipts,
            field_review_reconciled_feedback=[{'message':'Obsolete wording.'}],
            field_review_observations=[{'field':target['field'],'hash':target['hash'],'defects':[pending]}])
        result=schedule(current)
        self.assertEqual(result['repair_feedback'],[pending])
        self.assertTrue(result['development_delivery_ready'])
        self.assertFalse(result['development_validated'])

    def test_direct_graph_hands_judge_findings_to_targeted_audit_repair(self):
        import core.review_graph as graph
        current=state();defect={'code':'UNSUPPORTED_CLAIM','scope':'letter','owner':'rankpilot',
            'severity':'critical','field_path':'leadership','message':'Correct only this attribution.'}
        with ExitStack() as stack:
            for name,result in {
                'register_gate':{'errors':[]},
                'select_or_reuse':{'strategy':current['strategy'],'errors':[]},
                'selection_gate':{'selection_validated':True,'errors':[]},
                'selection_review':{'selection_review_validated':True,'errors':[]},
                'develop':{'development':current['development'],'development_validated':True,'errors':[]},
            }.items():stack.enter_context(patch('core.review_graph.'+name,return_value=result))
            stack.enter_context(patch('core.portfolio_consistency.verify_portfolio_consistency',return_value=([],[])))
            stack.enter_context(patch('core.portfolio_counts.enumeration_defects',return_value=[]))
            stack.enter_context(patch('core.editorial_case.comparison_style_defects',return_value=[]))
            stack.enter_context(patch('core.review_graph.invoke_role',return_value=(copy.deepcopy(LETTER),[])))
            stack.enter_context(patch('core.review_graph.editor',side_effect=[
                {'judge':{'passed':False,'defects':[defect]}}, {'judge':{'passed':True,'defects':[]}}]))
            repair=stack.enter_context(patch('core.editorial_repair.repair_letter',return_value={
                'letter':copy.deepcopy(LETTER),'writer_attempts':2,'writer_validated':True,'errors':[]}))
            graph.create_review_graph().invoke({'package':current['package']})
        repair.assert_called_once()
        self.assertEqual(repair.call_args.args[0]['repair_feedback'],[defect])
