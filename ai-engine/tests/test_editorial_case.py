import copy
import unittest
from core.editorial_case import CASE_VERSION, additional_leaders, case_errors, obligations, execution_defects
from core.editorial_development import development_errors, development_contract, DEVELOPMENT_VERSION
from core.editorial_repair import repair_targets, apply_corrections
from core.editorial_voice import voice_matches
from test_editorial_development import PACKAGE, STRATEGY, DEV


def fixture():
    p=copy.deepcopy(PACKAGE);s=copy.deepcopy(STRATEGY);v=copy.deepcopy(DEV)
    p['matters'][1].update(source_excerpt='Partner Sofia Vega led an investigation and prevented litigation.',leadPartner='Sofia Vega')
    v['version']=DEVELOPMENT_VERSION
    v['matters'][0]['legal_issue_source_quote']='prevented a strike'
    v['case_plan']={'version':CASE_VERSION,'institutional_arguments':[{'proposition':'Collective negotiation with a documented outcome','evidence':[{'matter_id':'m1','source_quote':'prevented a strike'}],'b10_contribution':'Explain negotiation and strike prevention','c2_contribution':'Ground coverage in actual collective outcomes'}],'additional_leaders':[],'target_decision':'First-time coverage, not a verified rank'}
    v['b10']='The team negotiated and prevented a strike.';v['c2']='Coverage is requested for collective negotiation and strike prevention.'
    return p,s,v

class EditorialCaseTests(unittest.TestCase):
    def test_reserve_is_valid_personal_evidence_but_excluded_is_not(self):
        p,s,v=fixture();v['candidates'][0]['supporting_matters'].append({'matter_id':'m2','personal_role':'Led the investigation','source_quote':'Partner Sofia Vega led an investigation'})
        self.assertEqual(development_errors(p,s,v),[])
        development_contract(p,s).model_validate(v)
        self.assertNotIn('candidates/0',repair_targets(p,s,v))
        s['matters'][1]['disposition']='excluded';v['comparisons']=[]
        self.assertTrue(any('Atribución' in e for e in development_errors(p,s,v)))
        self.assertIn('candidates/0',repair_targets(p,s,v))
    def test_source_mentions_cannot_promote_other_person_or_create_public_roster(self):
        p,s,v=fixture();p['matters'][0]['leadPartner']='Sofia Vega and Luis Prado.'
        expected=additional_leaders(p,s)
        self.assertEqual(expected,[{'name':'Luis Prado','matter_ids':['m1']}])
        self.assertTrue(case_errors(p,s,v))
        v['case_plan']['additional_leaders']=[{**expected[0],'decision':'Evaluate documented leadership; seniority unknown','remaining_action':'Confirm position before any category'}]
        self.assertEqual(case_errors(p,s,v),[])
        self.assertEqual([c['name'] for c in v['candidates']],['Sofia Vega'])
    def test_each_reserve_requires_a_comparison_not_a_single_easy_pair(self):
        p,s,v=fixture();p['matters'].append({'id':'m3','source_excerpt':'Other preventive advice.'});s['matters'].append({'matter_id':'m3','disposition':'reserve'})
        self.assertTrue(any('comparaciones' in e for e in case_errors(p,s,v)))
        targets=repair_targets(p,s,v);self.assertIn('comparisons',targets)
        pair={'selected_id':'m1','alternative_id':'m3','incremental_contribution':'Adds preventive coverage','tradeoff':'The selected outcome is documented'}
        fixed=apply_corrections(v,{'comparisons':targets['comparisons']},{'corrections':[{'path':'comparisons','value':v['comparisons']+[pair],'reason':'Cover missing reserve'}],'unresolved':[]})
        self.assertEqual(case_errors(p,s,fixed),[])
        with self.assertRaisesRegex(ValueError,'rewrite existing'):
            apply_corrections(v,{'comparisons':targets['comparisons']},{'corrections':[{'path':'comparisons','value':[pair],'reason':'Replace old pair'}]})
    def test_plan_cannot_borrow_another_matters_quote(self):
        p,s,v=fixture();v['case_plan']['institutional_arguments'][0]['evidence'][0]['source_quote']='prevented litigation'
        self.assertTrue(any('evidencia propia' in e for e in case_errors(p,s,v)))
    def test_source_bound_execution_checks_are_mandatory_and_field_specific(self):
        p,s,v=fixture();letter={'leadership':'Sofia led the negotiations.','evidence_gaps':'Routine advice adds no distinct capability.'}
        with self.assertRaisesRegex(ValueError,'omitted'):
            execution_defects(p,s,v,letter,[])
        checks=[]
        for o in obligations(p,s,v):
            text=letter[o['field']] if o['field'] in letter else v['b10'] if o['field']=='b10' else v['c2'] if o['field']=='c2' else v['candidates'][0]['submission_bio']
            checks.append({'obligation_id':o['id'],'status':'met','artifact_quote':text,'source_quote':'prevented a strike','reason':'Executes the attributed source work'})
        self.assertEqual(execution_defects(p,s,v,letter,checks),[])
        wrong=copy.deepcopy(checks);wrong[0]['artifact_quote']=v['c2']
        with self.assertRaisesRegex(ValueError,'expected field'):
            execution_defects(p,s,v,letter,wrong)
        wrong=copy.deepcopy(checks);wrong[0]['source_quote']='Source for another client'
        with self.assertRaisesRegex(ValueError,'own source'):
            execution_defects(p,s,v,letter,wrong)
        checks[0]['status']='failed';defects=execution_defects(p,s,v,letter,checks)
        self.assertEqual(defects[0]['field_path'],'b10');self.assertEqual(defects[0]['owner'],'rankpilot')
    def test_exact_word_cannot_be_replaced_by_old_proposal(self):
        p,s,v=fixture();p['rendered_artifact']='Different final text'
        o=obligations(p,s,v)[0]
        checks=[{'obligation_id':item['id'],'status':'met','artifact_quote':v['b10'],'source_quote':'prevented a strike','reason':'claim'} for item in obligations(p,s,v)]
        with self.assertRaisesRegex(ValueError,'artifact'):
            execution_defects(p,s,v,{},checks)
    def test_auditor_voice_examples_do_not_reject_actual_pending_ruling(self):
        self.assertTrue(voice_matches('No final procedural outcome is stated.'))
        self.assertTrue(voice_matches('No final ruling is reported.'))
        self.assertTrue(voice_matches('The available matter records do not specify his individual responsibilities.'))
        self.assertFalse(voice_matches('No final ruling has been issued; the appeal remains pending.'))

    def test_positive_judge_without_case_evidence_is_a_diagnostic_failure(self):
        from unittest.mock import patch
        from core.review_graph import editor, EditorialResponseError, ACCEPTANCE_CRITERIA
        p,s,v=fixture()
        verdict={'passed':True,'defects':[],'acceptance':[{'criterion':key,'status':'met','evidence':'General approval'} for key in ACCEPTANCE_CRITERIA]}
        with patch('core.review_graph.invoke_role',return_value=(verdict,[{'usage':{'total_tokens':17}}])) as model:
            with self.assertRaisesRegex(EditorialResponseError,'omitted') as error:
                editor({'package':p,'strategy':s,'development':v,'letter':{'leadership':'A candidate','evidence_gaps':'Routine advice adds no distinct capability.'}})
        self.assertEqual(model.call_count,1);self.assertEqual(error.exception.trace['usage']['total_tokens'],17)

    def test_obligations_reference_sources_once_and_do_not_mutate_state(self):
        from core.review_graph import role_payload
        p,s,v=fixture();payload={'package':p,'case_obligations':obligations(p,s,v)};before=copy.deepcopy(payload)
        compact=role_payload(payload,'writer')
        self.assertEqual(payload,before)
        for item in compact['case_obligations']:
            self.assertNotIn('sources',item);self.assertTrue(item['source_references'])
            self.assertNotIn('source_excerpt',str(item['source_references']))

    def test_private_reserve_metrics_remain_protected_in_public_candidate(self):
        from core.public_privacy import public_privacy_findings
        p,s,v=fixture();p['matters'][1].update(source_excerpt='Sofia Vega led an internal investigation avoiding litigation for MXN 750,000.',publication_route='E')
        v['candidates'][0]['supporting_matters'].append({'matter_id':'m2','personal_role':'Led the investigation','source_quote':'Sofia Vega led an internal investigation'})
        v['candidates'][0]['submission_bio']='Sofia Vega led an internal investigation avoiding litigation for MXN 750,000.'
        findings=public_privacy_findings(p,s,v)
        self.assertTrue(any(f['matter_id']=='m2' and f['path']=='candidates/0/submission_bio' for f in findings))

    def test_internal_comparisons_need_not_bloat_client_audit(self):
        p,s,v=fixture();v['comparisons'][0]['audit_required']=False
        self.assertTrue(any('visible' in e for e in case_errors(p,s,v)))
        v['comparisons'][0]['audit_required']=True
        p['matters'].append({'id':'m3','source_excerpt':'The team handled routine documentation.'});s['matters'].append({'matter_id':'m3','disposition':'reserve'})
        v['comparisons'].append({'selected_id':'m1','alternative_id':'m3','audit_required':False,'incremental_contribution':'Outcome compared with routine documentation','tradeoff':'The documented collective result is more distinctive'})
        self.assertEqual(case_errors(p,s,v),[])
        self.assertEqual(obligations(p,s,v)[-1]['field'],'comparisons/1/tradeoff')

    def test_case_node_runs_before_drafting_without_an_extra_model_role(self):
        from test_review_graph import ReviewGraphTests
        state,calls=ReviewGraphTests().run_graph()
        nodes=[event['node'] for event in state['node_events']]
        self.assertLess(nodes.index('case'),nodes.index('development'))
        self.assertEqual(calls,['strategist','selection_reviewer','development','writer','editor'])
        self.assertEqual(state['case_requirements']['strategy_thesis'],'Tax disputes')
