import copy
import unittest
from unittest.mock import patch
from pydantic import ValidationError
from openai.lib._pydantic import to_strict_json_schema
from utils.schema_limits import bounded_reference_schema
from core import construction_bindings as bindings
from core.editorial_construction import advance, schemas, digest
from core.editorial_case import prepare_case
from core.personal_quality import required_personal_matters
from core.candidate_evidence import profile_units
from construction_fixture import answer
from test_biography_depth import depth_case


class SourceOwnedConstructionTests(unittest.TestCase):
    def fixture(self):
        p,s,v=depth_case()
        state={'package':p,'strategy':s,'selection_validated':True,'selection_review_validated':True}
        state.update(prepare_case(state))
        return state,v

    def provider(self,proposal,calls):
        def invoke(state,role,schema,instruction,payload):
            bounded_reference_schema(to_strict_json_schema(schema))
            calls.append((schema,payload))
            return answer(schema,payload,proposal),state.get('trace',[])+[{'role':role,'provider_request_id':'fixture-'+str(len(calls)),'usage':{'total_tokens':11}}]
        return invoke

    def test_missing_mandatory_lead_support_is_completed_before_freezing_plan(self):
        state,v=self.fixture();c=v['candidates'][0];p=state['package'];s=state['strategy']
        required=required_personal_matters(p,s,c);self.assertTrue(required)
        removed=required[0];c['supporting_matters']=[x for x in c['supporting_matters'] if x['matter_id']!=removed]
        original=copy.deepcopy((state,v));calls=[]
        result=advance(state,self.provider(v,calls))
        self.assertTrue(result['development_validated'],result['errors'])
        bio=next(payload for schema,payload in calls if schema.__name__=='OwnedBiography')
        support=next(x for x in bio['shared_decision']['supporting_matters'] if x['matter_id']==removed)
        self.assertIn('Recorded lead responsibility',support['personal_role'])
        self.assertEqual((state,v),original)
        self.assertEqual(result['development']['candidates'][0]['suggested_ranking'],c['suggested_ranking'])

    def test_no_extra_personal_action_or_support_for_excluded_matter_is_inferred(self):
        state,v=self.fixture();p=state['package'];s=state['strategy'];c=v['candidates'][0]
        p['matters'].append({'id':'excluded','client':'Example','leadPartner':c['name'],'rawNotes':'Unrelated work.'})
        s['matters'].append({'matter_id':'excluded','disposition':'excluded'})
        plan=bindings.complete_plan_support(p,s,v)
        self.assertNotIn('excluded',[x['matter_id'] for x in plan['candidates'][0]['supporting_matters']])
        self.assertEqual(plan['candidates'][0]['supporting_matters'],c['supporting_matters'])

    def test_original_profile_units_and_required_mandates_are_schema_owned(self):
        state,v=self.fixture();p=state['package'];s=state['strategy'];c=v['candidates'][0]
        b=bindings.biography_bindings(p,s,c);model=bindings.biography_schema(schemas(p,s)[1],b)
        value=answer(model,{'shared_decision':c,'source_bindings':b},v)
        model.model_validate(value);bounded_reference_schema(to_strict_json_schema(model))
        mandatory=next(key for key,source in b['case_sources'].items() if source['required'])
        for field,key in [('profile_coverage',b['profile_units'][0]['reference']),('submission_case_coverage',mandatory)]:
            altered=copy.deepcopy(value);del altered[field][key]
            with self.assertRaises(ValidationError):model.model_validate(altered)
        altered=copy.deepcopy(value);altered['submission_case_coverage'][mandatory]=None
        with self.assertRaises(ValidationError):model.model_validate(altered)
        altered=copy.deepcopy(value);altered['profile_coverage'][b['profile_units'][0]['reference']][0]['source_quote']='Invented original'
        with self.assertRaises(ValidationError):model.model_validate(altered)
        expanded=bindings.expand_biography(value,b)
        self.assertEqual({(x['reference'],x['source_quote']) for x in expanded['profile_coverage']},
                         {(x['reference'],x['source_quote']) for x in profile_units(p['lawyers'][0])})
        self.assertEqual(expanded['submission_bio'],c['submission_bio'])

    def test_profile_entities_share_source_without_losing_separate_decisions(self):
        state,v=self.fixture();c=v['candidates'][0];b=bindings.biography_bindings(state['package'],state['strategy'],c)
        model=bindings.biography_schema(schemas(state['package'],state['strategy'])[1],b)
        value=answer(model,{'shared_decision':c,'source_bindings':b},v);ref=b['profile_units'][0]['reference']
        second={**value['profile_coverage'][ref][0],'entity_name':'Second entity'}
        value['profile_coverage'][ref].append(second)
        expanded=bindings.expand_biography(value,b)
        same=[x for x in expanded['profile_coverage'] if x['reference']==ref]
        self.assertEqual(len(same),2);self.assertEqual(same[0]['source_quote'],same[1]['source_quote'])
        # Expansion doesn't certify invented identities; the normal validator still rejects them.
        from core.candidate_evidence import profile_errors
        self.assertTrue(profile_errors(state['package']['lawyers'][0],{**c,**expanded},state['package']))

    def test_missing_institutional_argument_cannot_be_silently_dropped_or_reindexed(self):
        state,v=self.fixture();plan=v['case_plan'];model=bindings.institutional_schema(schemas(state['package'],state['strategy'])[0],plan)
        payload={'argument_bindings':{'A01':plan['institutional_arguments'][0]}}
        value=answer(model,payload,v);model.model_validate(value)
        key=next(iter(value['institutional_execution']));bad=copy.deepcopy(value);del bad['institutional_execution'][key]
        with self.assertRaises(ValidationError):model.model_validate(bad)
        bad=copy.deepcopy(value);bad['institutional_execution'][key]['argument_index']=99
        with self.assertRaises(ValidationError):model.model_validate(bad)
        projected=bindings.expand_institutional(value,plan)
        self.assertEqual(projected['institutional_execution'],v['institutional_execution'])
        self.assertEqual(projected['b10'],v['b10']);self.assertEqual(projected['c2'],v['c2'])

    def test_matter_slots_cannot_switch_ids_or_omit_a_planned_anchor(self):
        state,v=self.fixture();b=bindings.matter_bindings(v['matters']);model=bindings.matter_schema(schemas(state['package'],state['strategy'])[2],b)
        value=answer(model,{'field_contracts':{m['matter_id']:{} for m in v['matters']},'source_bindings':b},v)
        model.model_validate(value);key=next(iter(b));ref=next(iter(b[key]['anchors']))
        bad=copy.deepcopy(value);del bad['matters'][key]['anchor_execution'][ref]
        with self.assertRaises(ValidationError):model.model_validate(bad)
        bad=copy.deepcopy(value);bad['matters'][key]['matter_id']='another-matter'
        with self.assertRaises(ValidationError):model.model_validate(bad)
        projected,receipts=bindings.expand_matters(value,b)
        self.assertEqual([m['matter_id'] for m in projected['matters']],[m['matter_id'] for m in v['matters']])
        self.assertTrue(all(r['binding_verified'] for r in receipts))
        self.assertTrue(all(r['semantic_review']=='pending' for r in receipts))

    def test_bad_output_anchor_is_observed_without_freezing_the_document_or_buying_retry(self):
        state,v=self.fixture();b=bindings.matter_bindings(v['matters']);model=bindings.matter_schema(schemas(state['package'],state['strategy'])[2],b)
        value=answer(model,{'field_contracts':{m['matter_id']:{} for m in v['matters']},'source_bindings':b},v)
        key=next(iter(b));ref=next(iter(b[key]['anchors']));value['matters'][key]['anchor_execution'][ref]='Not in narrative'
        projected,receipts=bindings.expand_matters(value,b)
        self.assertFalse(receipts[0]['binding_verified']);self.assertEqual(projected['matters'][0]['text'],v['matters'][0]['text'])

    def test_old_durable_construction_keeps_its_original_output_contract(self):
        state,v=self.fixture();state['durable_repair_steps']=True;calls=[]
        state.update(advance(state,self.provider(v,calls)))
        del state['repair_continuation']['binding_contract']
        state['repair_continuation']['content_hash']=digest(state['repair_continuation']['work'])
        result=advance(state,self.provider(v,calls))
        self.assertNotIn('source_bindings',calls[-1][1])
        self.assertEqual(len(result['trace']),2);self.assertEqual(sum(c['usage']['total_tokens'] for c in result['trace']),22)

    def test_privacy_brief_retains_original_routes_and_registered_name_variants(self):
        p={'matters':[{'id':'m','name':'Exact Name','title':'Exact Title','resolved_publication_status':'confidential','rawNotes':'Private narrative','confidentialityEvidence':{'source':'Original restriction'}}]}
        original=copy.deepcopy(p);brief=bindings.privacy_register(p)
        self.assertEqual(brief[0]['resolved_publication_status'],'confidential')
        self.assertEqual(brief[0]['name'],'Exact Name');self.assertNotIn('rawNotes',brief[0]);self.assertEqual(p,original)

    def test_first_construction_report_never_calls_literal_bindings_ninety_percent_quality(self):
        state,v=self.fixture();result=advance(state,self.provider(v,[]));report=result['development_build_report']
        self.assertEqual(report['initial_validation']['semantic_quality'],'not_yet_measured')
        self.assertEqual(report['binding_contract'],bindings.VERSION)
        self.assertTrue(report['anchor_bindings']);self.assertTrue(report['initial_validation']['passed'])

    def test_first_pass_counts_failed_checks_and_cannot_improve_with_repaired_text(self):
        from core.construction_quality import record_first_review
        report={'first_pass_quality':{'scope':'development_source_field_obligations_only',
            'units':{'b10':{'hash':'original','obligation_ids':['one','two'],'checks':{}},
                     'c2':{'hash':'original-c2','obligation_ids':['three'],'checks':{}}}}}
        result={'checks':{'one':{'status':'met'},'two':{'status':'failed'}}}
        partial=record_first_review(report,[{'field':'b10','hash':'original'}],result)
        self.assertEqual(partial['first_pass_quality']['failed'],1)
        self.assertIsNone(partial['first_pass_quality']['percent_met'])
        repaired=record_first_review(partial,[{'field':'b10','hash':'repaired'}],{'checks':{'one':{'status':'met'},'two':{'status':'met'}}})
        self.assertEqual(repaired,partial)
        complete=record_first_review(repaired,[{'field':'c2','hash':'original-c2'}],{'checks':{'three':{'status':'met'}}})
        self.assertEqual(complete['first_pass_quality']['percent_met'],66.67)
        self.assertEqual(complete['first_pass_quality']['failed'],1)
        self.assertEqual(report['first_pass_quality']['units']['b10']['checks'],{})

    def test_changed_before_review_stays_unassessed_and_old_cases_are_not_relabelled(self):
        from core.construction_quality import record_first_review
        report={'first_pass_quality':{'units':{'b10':{'hash':'original','obligation_ids':['one'],'checks':{}}}}}
        changed=record_first_review(report,[{'field':'b10','hash':'changed'}],{'checks':{'one':{'status':'met'}}})
        self.assertEqual(changed['first_pass_quality']['unassessed'],1)
        self.assertIsNone(changed['first_pass_quality']['percent_met'])
        self.assertEqual(record_first_review({'version':'old'},[],{}),{'version':'old'})

    def test_actual_field_review_records_first_result_before_scheduling_repair(self):
        from core.field_review import units_for, schedule, advance as review_advance
        from test_field_review import verdict
        state,v=self.fixture();built=advance(state,self.provider(v,[]));state.update(built)
        state.update(schedule(state));paths=state['repair_continuation']['pending_groups'][0]
        units=[u for u in units_for(state) if u['field'] in paths]
        response=verdict(units,paths[0]);before=copy.deepcopy(state['development_build_report'])
        with patch('core.review_graph.invoke_role',return_value=(response,[])) as model:
            result=review_advance(state)
        self.assertEqual(model.call_count,1)
        self.assertEqual(result['repair_continuation']['phase'],'repair')
        self.assertGreater(result['development_build_report']['first_pass_quality']['failed'],0)
        self.assertEqual(state['development_build_report'],before)

if __name__=='__main__':unittest.main()
