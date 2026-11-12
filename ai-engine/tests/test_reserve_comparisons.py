import copy
import unittest
from pydantic import ValidationError
from openai.lib._pydantic import to_strict_json_schema
from utils.schema_limits import bounded_reference_schema
from core import reserve_comparisons as rc
from core.editorial_construction import advance, schemas, source_key, digest, validate_plan, VERSION
from core.editorial_case import prepare_case
from construction_fixture import answer, project
from test_biography_depth import depth_case


def fixture(count=11):
    p, s, v = depth_case()
    original = next(m for m in p['matters'] if m['id'] == 'm2')
    s['matters'] = [d for d in s['matters'] if d['disposition'] != 'reserve']
    p['matters'] = [m for m in p['matters'] if m['id'] != 'm2']
    v['comparisons'] = []
    for i in range(count):
        mid = 'm2' if i == 0 else 'reserve-'+str(i)
        m = {**copy.deepcopy(original), 'id': mid}
        if i:
            m.update(leadPartner='', lead_partner='', teamMembers='', team_members='',
                     rawNotes='The firm reviewed employment agreements. Advice remains ongoing.',
                     summary='Employment agreement review.', source_excerpt='The firm reviewed employment agreements.')
        p['matters'].append(m)
        s['matters'].append({'matter_id': mid, 'disposition': 'reserve'})
        v['comparisons'].append({'selected_id': 'm1', 'alternative_id': mid, 'audit_required': i == 0,
            'incremental_contribution': 'The selected mandate has a documented negotiation outcome.',
            'tradeoff': 'The reserve documents ongoing employment agreement advice.'})
    state={'package': p, 'strategy': s, 'selection_validated': True, 'selection_review_validated': True,
           'durable_repair_steps': True, 'trace': [{'provider_request_id':'paid-plan', 'usage':{'total_tokens':55}}]}
    state.update(prepare_case(state))
    return state, v


def partial_checkpoint(state, proposal):
    legacy=schemas(state['package'], state['strategy'])[3]
    partial=project(legacy, proposal)
    partial['comparisons']=partial['comparisons'][:3]
    state['repair_continuation']={'version':VERSION, 'source_key':source_key(state),
        'binding_contract':'source-owned-construction-bindings-v1', 'work':{}, 'content_hash':digest({}),
        'completed_units':[], 'pending_groups':[], 'failed_unit':{'kind':'plan'},
        'rejected_response':partial, 'validation_error':rc.MISSING_ERROR}
    state['development_repair_unlocatable']=True
    return partial


class ReserveComparisonTests(unittest.TestCase):
    def test_new_schema_requires_every_reserve_and_separate_audit_visibility(self):
        state,v=fixture();legacy=schemas(state['package'],state['strategy'])[3]
        schema=rc.plan_schema(legacy,state['strategy'])
        bounded_reference_schema(to_strict_json_schema(schema))
        payload={'reserve_comparison_bindings':rc.bindings(state['strategy'])}
        value=answer(schema,payload,v);schema.model_validate(value)
        self.assertEqual(len(value['comparisons']),11)
        del value['comparisons']['R04']
        with self.assertRaises(ValidationError):schema.model_validate(value)
        self.assertIn('R04',schema.model_fields['comparisons'].annotation.model_json_schema()['required'])

    def test_canonical_identity_and_visibility_cannot_be_reassigned_or_omitted(self):
        state,v=fixture();schema=rc.plan_schema(schemas(state['package'],state['strategy'])[3],state['strategy'])
        value=answer(schema,{'reserve_comparison_bindings':rc.bindings(state['strategy'])},v)
        for change in ('foreign','reserve_selected','empty_visible','unknown_visible'):
            bad=copy.deepcopy(value)
            if change=='foreign':bad['comparisons']['R01']['alternative_id']='different'
            if change=='reserve_selected':bad['comparisons']['R01']['selected_id']='m2'
            if change=='empty_visible':bad['audit_comparison_references']=[]
            if change=='unknown_visible':bad['audit_comparison_references']=['R99']
            with self.assertRaises(ValidationError):schema.model_validate(bad)
        expanded=rc.expand_plan(value,state['strategy'])
        self.assertEqual([c['alternative_id'] for c in expanded['comparisons']],list(rc.bindings(state['strategy']).values()))
        self.assertEqual(sum(c['audit_required'] for c in expanded['comparisons']),1)

    def test_zero_one_and_many_reserves_have_exact_contracts(self):
        for n in (0,1,11):
            state,v=fixture(n);legacy=schemas(state['package'],state['strategy'])[3]
            schema=rc.plan_schema(legacy,state['strategy'])
            value=answer(schema,{'reserve_comparison_bindings':rc.bindings(state['strategy'])},v)
            expanded=rc.expand_plan(schema.model_validate(value).model_dump(),state['strategy'])
            self.assertEqual(len(expanded['comparisons']),n)
            self.assertEqual(rc.coverage_errors(state['strategy'],expanded['comparisons']),[])

    def test_recover_eight_of_eleven_without_regenerating_plan_or_losing_usage(self):
        state,v=fixture();partial=partial_checkpoint(state,v);before=copy.deepcopy(state);calls=[]
        def invoke(s,role,schema,instruction,payload):
            calls.append(schema.__name__)
            self.assertEqual(schema.__name__,'MissingReserveComparisons')
            self.assertEqual(len(payload['reserve_comparison_bindings']),8)
            self.assertEqual(payload['preserved_comparisons'],partial['comparisons'])
            bounded_reference_schema(to_strict_json_schema(schema))
            return answer(schema,payload,v),s['trace']+[{'usage':{'total_tokens':11}}]
        result=advance(state,invoke);pending=result['repair_continuation']
        self.assertEqual(calls,['MissingReserveComparisons']);self.assertEqual(state,before)
        self.assertEqual(result['errors'],[]);self.assertFalse(result['development_repair_unlocatable'])
        self.assertEqual(pending['pending_groups'][0]['kind'],'matters')
        self.assertEqual(pending['work']['comparisons'][:3],partial['comparisons'])
        self.assertEqual(len(pending['work']['comparisons']),11)
        for key in partial:
            if key!='comparisons':self.assertEqual(pending['work'][key],partial[key])
        self.assertEqual(sum(t['usage']['total_tokens'] for t in result['trace']),66)
        self.assertEqual(pending['rejected_response'],partial)
        self.assertTrue(pending['plan_comparison_recovery']['completed'])
        self.assertNotIn('failed_unit',pending)

    def test_wrong_sources_or_tampered_checkpoint_never_purchase_completion(self):
        state,v=fixture();partial_checkpoint(state,v)
        for mutate in ('source','checkpoint'):
            bad=copy.deepcopy(state)
            if mutate=='source':bad['package']['firm_name']='Another source'
            else:bad['repair_continuation']['work']={'altered':True}
            with self.assertRaises(ValueError):advance(bad,lambda *args:self.fail('No call allowed'))

    def test_missing_comparisons_do_not_hide_another_plan_defect(self):
        state,v=fixture();partial=partial_checkpoint(state,v)
        partial['matters'][0]['legal_issue_source_quote']='Invented source passage.'
        result=advance(state,lambda *args:self.fail('Invalid source must not buy completion'))
        self.assertTrue(result['development_repair_unlocatable'])
        self.assertEqual(result['repair_continuation']['rejected_response'],partial)

    def test_invalid_completion_is_retained_and_cannot_buy_same_call_again(self):
        state,v=fixture();partial_checkpoint(state,v);calls=[]
        def invoke(s,role,schema,instruction,payload):
            calls.append(1);value=answer(schema,payload,v);del value['comparisons']['R04']
            return value,s['trace']+[{'usage':{'total_tokens':7}}]
        first=advance(state,invoke)
        self.assertEqual(first['repair_continuation']['failed_unit']['kind'],'plan_comparisons')
        second=advance({**state,**first},lambda *args:self.fail('No repeated paid response'))
        self.assertEqual(len(calls),1);self.assertEqual(second['trace'],first['trace'])

    def test_legacy_incomplete_plan_queues_completion_without_a_terminal_error(self):
        state,v=fixture();legacy=schemas(state['package'],state['strategy'])[3]
        state['repair_continuation']={'version':VERSION,'source_key':source_key(state),'work':{},
            'content_hash':digest({}),'completed_units':[],'pending_groups':[{'kind':'plan'}]}
        partial=project(legacy,v);partial['comparisons']=partial['comparisons'][:3]
        result=advance(state,lambda *args:(partial,state['trace']+[{'usage':{'total_tokens':9}}]))
        self.assertEqual(result['errors'],[])
        self.assertEqual(result['repair_continuation']['pending_groups'][0]['kind'],'plan_comparisons')
        self.assertFalse(result['development_repair_unlocatable'])

    def test_duplicate_reserve_or_foreign_selected_source_is_not_coverage(self):
        state,v=fixture(1)
        self.assertTrue(rc.coverage_errors(state['strategy'],v['comparisons']*2))
        v['comparisons'][0]['selected_id']='m2'
        self.assertTrue(rc.coverage_errors(state['strategy'],v['comparisons']))


if __name__=='__main__':unittest.main()
