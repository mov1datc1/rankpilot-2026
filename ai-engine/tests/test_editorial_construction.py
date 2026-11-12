"""Offline contracts: real orchestrator, simulated provider, no quality claims."""
import copy
import json
import unittest
from unittest.mock import patch
from openai.lib._pydantic import to_strict_json_schema
from utils.schema_limits import bounded_reference_schema
from core.editorial_construction import advance, VERSION, decision_snapshot, contracts
from core.editorial_case import prepare_case, obligations
from core.editorial_role_policy import role_base
from core.audit_preservation import preserve_sections
from construction_fixture import answer
from test_biography_depth import depth_case


class ConstructionTests(unittest.TestCase):
    def fixture(self):
        p,s,v=depth_case()
        state={'package':p,'strategy':s,'selection_validated':True,'selection_review_validated':True}
        state.update(prepare_case(state))
        return state,v

    def provider(self, proposal, calls):
        def invoke(state,role,schema,instruction,payload):
            bounded_reference_schema(to_strict_json_schema(schema))
            calls.append((schema.__name__,copy.deepcopy(payload)))
            return answer(schema,payload,proposal),state.get('trace',[])+[
                {'role':role,'provider_request_id':'offline-'+str(len(calls)),
                 'usage':{'input_tokens':0,'output_tokens':0,'total_tokens':0}}]
        return invoke

    def test_construction_completes_without_repair_and_keeps_source_and_selection(self):
        state,v=self.fixture();before=copy.deepcopy(state);calls=[]
        result=advance(state,self.provider(v,calls))
        self.assertTrue(result['development_validated'],result['errors'])
        self.assertEqual([x[0] for x in calls],['SharedEditorialPlan','MatterNarratives','OwnedBiography','InstitutionalProse'])
        self.assertEqual(state,before)
        self.assertEqual(result['development']['case_plan'],v['case_plan'])
        self.assertEqual(result['development']['candidates'][0]['suggested_ranking'],v['candidates'][0]['suggested_ranking'])
        self.assertNotIn('repair',str([x['role'] for x in result['trace']]))
        self.assertEqual(result['development']['construction_contract'],VERSION)

    def test_serialized_resume_never_repeats_completed_units_or_usage(self):
        state,v=self.fixture();state['durable_repair_steps']=True;calls=[]
        invoke=self.provider(v,calls)
        for i in range(4):
            result=advance(state,invoke)
            self.assertEqual(len(calls),i+1)
            state=json.loads(json.dumps({**state,**result}))
            if i<3:
                self.assertFalse(result['development_validated'])
                self.assertEqual(result['repair_continuation']['version'],VERSION)
        self.assertTrue(result['development_validated'],result['errors'])
        self.assertEqual(len({x['provider_request_id'] for x in result['trace']}),4)
        self.assertIsNone(result['repair_continuation'])

    def test_changed_source_or_tampered_saved_unit_never_buys_another_call(self):
        state,v=self.fixture();state['durable_repair_steps']=True
        saved={**state,**advance(state,self.provider(v,[]))}
        for mutation in ('source','work'):
            altered=copy.deepcopy(saved)
            if mutation=='source':altered['package']['matters'][0]['source_excerpt']+=' Changed source.'
            else:altered['repair_continuation']['work']['target']='Invented band'
            with patch('core.review_graph.invoke_role') as invoke:
                with self.assertRaises(ValueError):advance(altered,invoke)
                invoke.assert_not_called()

    def test_wrong_owned_id_retains_paid_response_without_replay(self):
        state,v=self.fixture();state['durable_repair_steps']=True;calls=[]
        state.update(advance(state,self.provider(v,calls)))
        def wrong(state,role,schema,instruction,payload):
            return {'matters':[{'matter_id':'other','text':'Wrong source','completion_status':''}]},state['trace']+[{'role':role,'provider_request_id':'bad-paid-response'}]
        result=advance(state,wrong)
        self.assertTrue(result['errors']);self.assertEqual(result['trace'][-1]['provider_request_id'],'bad-paid-response')
        self.assertEqual(result['repair_continuation']['rejected_response']['matters'][0]['matter_id'],'other')
        with patch('core.review_graph.invoke_role') as invoke:
            repeat=advance({**state,**result},invoke)
            invoke.assert_not_called();self.assertTrue(repeat['errors'])

    def test_bio_schema_cannot_change_category_or_another_person(self):
        state,v=self.fixture();calls=[]
        real=self.provider(v,calls)
        def invoke(state,role,schema,instruction,payload):
            if schema.__name__=='OwnedBiography':
                self.assertNotIn('suggested_ranking',schema.model_fields)
                self.assertNotIn('name',schema.model_fields)
                self.assertEqual(payload['shared_decision']['name'],v['candidates'][0]['name'])
            return real(state,role,schema,instruction,payload)
        result=advance(state,invoke)
        self.assertEqual(decision_snapshot(result['development'])['candidates'][0]['suggested_ranking'],v['candidates'][0]['suggested_ranking'])

    def test_confidential_destination_is_explicit_and_not_inferred_from_public_bios(self):
        state,_=self.fixture();p=state['package'];p['matters'][0]['publication_route']='E'
        self.assertEqual(contracts(p,state['strategy'])[p['matters'][0]['id']]['destination'],'E')
        p['matters'][0]['publication_route']='D'
        self.assertEqual(contracts(p,state['strategy'])[p['matters'][0]['id']]['destination'],'D')

    def test_maturity_label_becomes_one_shared_pending_decision(self):
        state,v=self.fixture();v['candidates'][0]['suggested_ranking']='Established Individual';calls=[]
        result=advance(state,self.provider(v,calls))
        c=result['development']['candidates'][0]
        self.assertEqual(c['suggested_ranking'],'Category pending')
        self.assertEqual(c['category_assessment']['decision'],'pending')
        self.assertTrue(c['category_missing_criterion']);self.assertTrue(c['recommended_action'])
        self.assertEqual(calls[-1][1]['shared_decisions']['candidates'][0]['suggested_ranking'],'Category pending')

    def test_shortening_cannot_drop_geographic_qualifier_or_change_pending_result(self):
        original={'portfolio':'Integración en seis entidades federativas con 35 procedimientos.',
                  'leadership':'El litigio sigue pendiente; no hay sentencia definitiva.',
                  'next_actions':[{'kind':'period','message':'Confirmar periodo.'}]}
        bad={'portfolio':'Integración en seis entidades con 35 procedimientos.',
             'leadership':'El litigio concluyó favorablemente.', 'next_actions':[]}
        self.assertEqual(preserve_sections(original,bad),original)
        good={**original,'portfolio':'En seis entidades federativas, integración y 35 procedimientos.'}
        self.assertEqual(preserve_sections(original,good),good)

    def test_writer_does_not_receive_judge_job_or_delivery_block_policy(self):
        review='You are reviewing. An unresolved critical defect blocks delivery.'
        for role in ('development','writer'):
            system=role_base(role,review)
            self.assertNotIn('blocks delivery',system);self.assertNotIn('You are reviewing',system)
            self.assertIn('source',system.lower())
        self.assertEqual(role_base('editor',review),review)

    def test_market_category_and_c2_each_have_a_review_obligation(self):
        state,v=self.fixture();v['construction_contract']=VERSION
        ids={o['id'] for o in obligations(state['package'],state['strategy'],v)}
        self.assertTrue({'editorial:c2_distinct_argument','editorial:market_comparison',
                         'editorial:shared_category:0'}<=ids)

    def test_own_profile_excludes_other_people_and_excluded_mandate_narratives(self):
        state,v=self.fixture();state['package']['matters'].append({'id':'excluded',
            'source_excerpt':'Sofia Vega handled unrelated work.','leadPartner':'Sofia Vega','client':'Private Client','publication_route':'E'})
        state['strategy']['matters'].append({'matter_id':'excluded','disposition':'excluded'})
        calls=[];advance(state,self.provider(v,calls))
        bio=next(payload for name,payload in calls if name=='OwnedBiography')
        self.assertNotIn('excluded',[m['id'] for m in bio['package']['matters']])
        self.assertIn('excluded',[m['id'] for m in bio['privacy_register']])
        self.assertEqual(len(bio['source_obligations']['profile_requirements']),1)
        institution=calls[-1][1]
        self.assertNotIn('excluded',[m['id'] for m in institution['package']['matters']])

    def test_repeated_coverage_requests_are_located_without_deleting_distinct_facts(self):
        from core.editorial_repetition import repetition_fields
        text=('The firm should receive first-time recognition for its integrated employer-side capability. '
              'The practice warrants first-time recognition for its integrated employer-side capability in collective litigation.')
        self.assertEqual(len(repetition_fields({'c2':text})['c2']),2)
        self.assertEqual(repetition_fields({'c2':'The firm requests coverage for its tax disputes practice. Its team won a documented appeal.'}),{})

    def test_audit_category_is_rendered_from_shared_decision_not_chosen_again(self):
        from core.audit_decisions import letter_contract,project_letter,preserve_decisions,decision_heading
        from core.review_graph import Letter
        state,v=self.fixture();v['construction_contract']=VERSION;state['development']=v
        schema=letter_contract(state,Letter)
        bounded_reference_schema(to_strict_json_schema(schema))
        fields=schema.model_fields['leadership'].annotation.model_fields
        self.assertEqual(list(fields),['L01'])
        projected=project_letter(state,{'leadership':{'L01':'Su trabajo documentado acredita liderazgo en los mandatos indicados.'}})
        heading=decision_heading(v['candidates'][0])
        self.assertIn(heading,projected['leadership'])
        self.assertEqual(preserve_decisions(state,projected,{'leadership':'Otra categoría genérica.'}),projected)

    def test_final_writer_integration_preserves_structured_decisions(self):
        from core.review_graph import writer
        from core.audit_decisions import decision_heading
        state,v=self.fixture();v['construction_contract']=VERSION;state['development']=v
        response={k:'Análisis sintético para la prueba local.' for k in (
            'executive_assessment','portfolio','evidence_gaps','next_steps')}
        response['leadership']={'L01':'Lidera actuaciones documentadas con contribuciones distintas.'}
        with patch('core.review_graph.invoke_role',return_value=(response,[])) as invoke,patch(
            'core.portfolio_consistency.verify_portfolio_consistency',return_value=([],[])):
            result=writer(state)
        self.assertEqual(invoke.call_args.args[2].__name__,'SharedDecisionAudit')
        self.assertIn(decision_heading(v['candidates'][0]),result['letter']['leadership'])
        self.assertEqual(invoke.call_args.args[4]['shared_decisions']['candidates'][0]['suggested_ranking'],v['candidates'][0]['suggested_ranking'])

    def test_institutional_task_covers_sectors_growth_and_bench_depth_without_binding_cap(self):
        state,v=self.fixture();instructions=[]
        real=self.provider(v,[])
        def invoke(s,role,schema,instruction,payload):
            if schema.__name__=='InstitutionalProse':instructions.append(instruction)
            return real(s,role,schema,instruction,payload)
        result=advance(state,invoke)
        self.assertTrue(result['development_validated'],result['errors'])
        self.assertEqual(len(instructions),1)
        prompt=instructions[0]
        for expected in ('industry sector expertise','areas of recent growth','department leadership and bench depth','not a cap on B10 structure','no rigid minimum'):
            self.assertIn(expected,prompt)

    def test_first_pass_prompts_prevent_b9_completion_status_and_audit_leadership_regressions(self):
        from core.editorial_construction import MATTER_TASK, bio_task
        from core.audit_decisions import WRITING_TASK
        self.assertIn('never audit voice', MATTER_TASK)
        self.assertIn('pending confirmation', MATTER_TASK)
        bio_prompt = bio_task()
        self.assertIn('department-head', bio_prompt)
        self.assertIn("THAT unit's source_quote", bio_prompt)
        self.assertIn('verbatim from the actual resulting submission_bio', bio_prompt)
        self.assertIn('líder del asunto', WRITING_TASK)
        self.assertIn('never omit a core/reserve mandate cited in that lawyer\'s B9', WRITING_TASK)


if __name__=='__main__':unittest.main()
