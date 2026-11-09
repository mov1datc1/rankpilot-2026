import copy
import json
import unittest
from unittest.mock import patch
from core.field_review import VERSION, units_for, contract, project_checks, schedule, advance, verified_obligations
from core.editorial_development import develop
from test_editorial_execution import linked_case


def state():
    p,s,v=linked_case()
    return {'package':p,'strategy':s,'development':v,'development_reusable':True,
            'field_review_enabled':True,'trace':[]}


def verdict(units,failed_field=None):
    return {'checks':{o['id']:{'status':'failed' if u['field']==failed_field else 'met',
        'artifact_ref':next(iter(u['output_passages'])),
        'source_ref':next(iter(o.get('source_passages') or o['source_refs'])),
        'reason':'Preserve the supplied achieved result.' if u['field']==failed_field else 'The supplied contribution and outcome are preserved.'}
        for u in units for o in u['obligations']}}


class FieldReviewTests(unittest.TestCase):
    def test_parent_method_is_inherited_without_mixing_unrelated_sibling_fields(self):
        from core.field_review import method_count
        self.assertEqual(method_count({'candidates/0':2},'candidates/0/submission_bio'),2)
        self.assertEqual(method_count({'candidates/0/submission_bio':2},'candidates/0'),2)
        self.assertEqual(method_count({'candidates/0/submission_bio':2},'candidates/0/category_rationale'),0)
        self.assertEqual(method_count({'candidates/0':2},'candidates/01/submission_bio'),0)

    def test_institutional_context_preserves_all_original_firm_inputs_not_generated_drafts(self):
        from core.field_review import review_payload
        current=state();p=current['package']
        p.update(filing_details={'heads':[{'name':'Sofia Vega'}],'num_partners':2},
            b10_source='Original department governance.',c2_source='Original coverage objective.',
            b10_draft='Generated department claim.',c2_draft='Generated coverage claim.',
            editorial_development={'b10':'Generated old proposal'},
            internal_referee_notes='Private referee logistics')
        units=units_for(current);group=[u for u in units if u['field'] in ('b10','c2')]
        context=review_payload(group)['institutional_context']
        self.assertEqual(context['filing_details'],p['filing_details'])
        self.assertEqual(context['b10_source'],p['b10_source'])
        self.assertEqual(context['c2_source'],p['c2_source'])
        self.assertEqual(context['lawyers'],p['lawyers'])
        for key in ('editorial_development','b10_draft','c2_draft','internal_referee_notes','matters'):
            self.assertNotIn(key,context)
        before={u['field']:u['hash'] for u in group}
        p['filing_details']['heads'][0]['name']='Another confirmed head'
        after={u['field']:u['hash'] for u in units_for(current)}
        self.assertNotEqual(before['b10'],after['b10'])
        self.assertNotEqual(before['c2'],after['c2'])

    def test_context_recheck_keeps_methods_and_requires_a_real_new_verdict(self):
        from core.field_review import recheck_context, INSTITUTIONAL_CONTEXT
        current=state();current.update(field_context_recheck=True,
            field_review_attempts={'b10':2},field_review_failures=[{
                'field_path':'b10','obligation_id':'argument:0:b10','owner':'rankpilot'}])
        before=copy.deepcopy(current['development'])
        with patch('core.review_graph.invoke_role',side_effect=AssertionError('Schedule first, do not regenerate')):
            current.update(develop(current))
        self.assertFalse(current['development_validated'])
        self.assertEqual(current['field_review_attempts'],{'b10':2})
        self.assertEqual(current['development'],before)
        self.assertEqual(current['repair_continuation']['phase'],'review')
        def failed(s,role,schema,instruction,payload):
            return verdict(payload['units'],'b10'),[{'role':role,'usage':{'total_tokens':10}}]
        with patch('core.review_graph.invoke_role',side_effect=failed):current.update(advance(current))
        self.assertEqual(current['field_review_context_version'],INSTITUTIONAL_CONTEXT)
        with patch('core.review_graph.invoke_role',side_effect=AssertionError('No third repair')):
            current.update(advance(current))
        self.assertFalse(current['development_validated'])
        self.assertIsNone(current['repair_continuation'])
        self.assertTrue(recheck_context(current)['development_repair_unlocatable'])

    def test_institutional_review_sees_other_selected_sources_without_cross_person_leakage(self):
        current=state();p=current['package'];s=current['strategy']
        p['matters'].append({'id':'other-core','source_excerpt':'A separate selected mandate established the specialised-services structure.'})
        p['matters'].append({'id':'excluded','source_excerpt':'Unrelated excluded mandate.'})
        s['matters'].extend([{'matter_id':'other-core','disposition':'core'}, {'matter_id':'excluded','disposition':'exclude'}])
        units=units_for(current)
        institutional=[u for u in units if u['field'] in ('b10','c2')]
        for u in institutional:
            self.assertTrue(any(r.get('id')=='other-core' for r in u['sources'].values()))
            self.assertFalse(any(r.get('id')=='excluded' for r in u['sources'].values()))
            # The proposition still has its own required evidence; context
            # cannot stand in for executing that proposition.
            self.assertFalse(any(p['matters'][-2]['source_excerpt'] in o['source_passages'].values() for o in u['obligations']))
        person=next(u for u in units if u['field']=='candidates/0/submission_bio')
        self.assertFalse(any(r.get('id')=='other-core' for r in person['sources'].values()))
        old={u['field']:u['hash'] for u in units}
        p['matters'][-2]['source_excerpt']+=' A corrected original result.'
        changed={u['field']:u['hash'] for u in units_for(current)}
        self.assertNotEqual(old['b10'],changed['b10'])
        self.assertNotEqual(old['c2'],changed['c2'])
        self.assertEqual(old['candidates/0/submission_bio'],changed['candidates/0/submission_bio'])

    def test_shared_wording_does_not_expand_a_located_fields_repair_scope(self):
        from core.editorial_repair import repair_rejected_development
        current=state();v=current['development'];v['c2']=v['b10']
        defect={'code':'EDITORIAL_OMISSION','severity':'critical','owner':'rankpilot','scope':'submission',
            'field_path':'c2','artifact_quote':v['c2'],'source_quote':'Original supporting evidence.',
            'message':'Develop the C2 coverage argument.'}
        with patch('core.editorial_repair.repair_development',return_value={}) as repair:
            repair_rejected_development(current,v,[defect])
        self.assertEqual(set(repair.call_args.args[2]),{'c2'})

    def test_semantic_failure_is_repaired_and_only_changed_field_is_rechecked(self):
        from test_surgical_repair_postconditions import native_answer
        current=state();original=copy.deepcopy(current['development'])
        target='matters/0/text';original_text=original['matters'][0]['text']
        current['development']['matters'][0]['text']='The team advised on this matter.'
        units=units_for(current)
        receipts,_=project_checks([u for u in units if u['field']!=target],verdict([u for u in units if u['field']!=target]))
        current['field_review_receipts']=receipts;current.update(schedule(current))
        calls=[]
        def invoke(s,role,schema,instruction,payload):
            calls.append(role)
            if role=='field_reviewer':
                self.assertEqual([u['field'] for u in payload['units']],[target])
                answer=verdict(payload['units'],target if len(calls)==1 else None)
            else:
                self.assertEqual(role,'repair')
                self.assertEqual(set(payload['repair_targets']),{target})
                answer=native_answer({'corrections':[{'path':target,'value':original_text,'reason':'Restore the original supported work.'}],'unresolved':[]},payload['target_references'])
            schema.model_validate(answer)
            return answer,s.get('trace',[])+[{'role':role,'usage':{'total_tokens':11},'provider_request_id':f'fixture-{len(calls)}'}]
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            for _ in range(4):
                current=json.loads(json.dumps(current));current.update(advance(current))
                if current.get('development_validated'):break
        self.assertTrue(current['development_validated'],current.get('errors'))
        self.assertEqual(calls,['field_reviewer','repair','field_reviewer'])
        self.assertEqual(current['field_review_attempts'],{target:1})
        self.assertEqual(current['development'],original)
        self.assertEqual(sum(t['usage']['total_tokens'] for t in current['trace']),33)
        self.assertEqual(len(current['field_review_receipts']),len(units))
        self.assertNotIn('approved_artifact',current)

    def test_failed_correction_changes_method_once_and_never_certifies_unchanged_error(self):
        current=state();current.update(schedule(current));units=units_for(current)
        target='matters/0/text';unit=next(u for u in units if u['field']==target)
        _,defects=project_checks([unit],verdict([unit],target))
        current['field_review_failures']=defects
        current['repair_continuation'].update(phase='repair',pending_groups=[[target]])
        methods=[]
        def failed(s,proposal,issues):
            methods.append(s['repair_strategy'])
            return {'development':proposal,'development_validated':False,'errors':['Correction ineffective'],
                    'trace':s['trace']+[{'usage':{'total_tokens':9}}]}
        with patch('core.editorial_repair.repair_rejected_development',side_effect=failed):
            current.update(advance(current))
            self.assertEqual(current['repair_continuation']['phase'],'repair')
            current.update(advance(current))
            # Stop repairing this field, retain its diagnosis, review other units.
            self.assertEqual(current['repair_continuation']['phase'],'review')
            self.assertTrue(current['field_review_observations'])
        self.assertEqual(methods,['targeted_correction','source_reconstruction'])
        self.assertFalse(current['development_validated'])
        self.assertEqual(current['field_review_attempts'][target],2)

    def test_local_pass_schedules_source_review_and_does_not_certify_documents(self):
        current=state();before=copy.deepcopy(current)
        with patch('core.review_graph.invoke_role',side_effect=AssertionError('No call before persisted boundary')):
            result=develop(current)
        self.assertFalse(result['development_validated'])
        self.assertEqual(result['repair_continuation']['version'],VERSION)
        self.assertEqual(current,before)
        self.assertNotIn('approved_artifact',result)

    def test_shared_rules_are_checked_once_per_unchanged_unit_across_serialized_steps(self):
        current=state();current.update(schedule(current));calls=[]
        def invoke(s,role,schema,instruction,payload):
            self.assertEqual(role,'field_reviewer')
            self.assertNotIn('package',payload)
            calls.extend(u['field'] for u in payload['units'])
            response=verdict(payload['units']);schema.model_validate(response)
            return response,s.get('trace',[])+[{'role':role,'usage':{'total_tokens':7}}]
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            for _ in range(20):
                if current.get('development_validated'):break
                current=json.loads(json.dumps(current));current.update(advance(current))
        self.assertTrue(current['development_validated'])
        self.assertEqual(len(calls),len(set(calls)))
        self.assertEqual(set(calls),{u['field'] for u in units_for(current)})
        self.assertTrue(current['trace']);self.assertIsNone(current['repair_continuation'])
        self.assertFalse(any(k in current for k in ('approved_artifact','judge')))
        with patch('core.review_graph.invoke_role',side_effect=AssertionError('No repurchase')):
            self.assertTrue(schedule(current)['development_validated'])

    def test_edited_unit_invalidates_its_receipt_and_keeps_other_proofs(self):
        current=state();units=units_for(current)
        receipts,defects=project_checks(units,verdict(units));self.assertFalse(defects)
        current['field_review_receipts']=receipts
        current['development']['matters'][0]['text']+=' Additional sourced explanation.'
        result=schedule(current)
        self.assertEqual(result['repair_continuation']['pending_groups'],[['matters/0/text']])
        current['package']['matters'][0]['source_excerpt']+=' Source correction.'
        self.assertFalse(schedule(current)['development_validated'])

    def test_failed_proof_routes_to_repair_before_audit_with_original_evidence(self):
        current=state();current.update(schedule(current))
        def invoke(s,role,schema,instruction,payload):
            return verdict(payload['units'],payload['units'][0]['field']),[{'role':role,'usage':{'total_tokens':9}}]
        with patch('core.review_graph.invoke_role',side_effect=invoke):result=advance(current)
        self.assertEqual(result['repair_continuation']['phase'],'repair')
        self.assertTrue(result['field_review_failures'])
        self.assertFalse(result['development_validated'])
        self.assertTrue(all(d['source_quote'] and d['artifact_quote'] and d['field_path'] for d in result['field_review_failures']))
        current.update(result)
        field=current['field_review_failures'][0]['field_path']
        current['field_review_attempts']={d['field_path']:2 for d in current['field_review_failures']}
        with patch('core.review_graph.invoke_role',side_effect=AssertionError('Exhausted')):
            stopped=advance(current)
        self.assertFalse(stopped['development_repair_unlocatable'])
        self.assertTrue(stopped['field_review_observations'])
        self.assertFalse(stopped['development_validated'])

    def test_foreign_or_missing_proofs_cannot_produce_receipts(self):
        units=units_for(state());response=verdict(units)
        first=next(iter(response['checks']));response['checks'][first]['source_ref']='invented'
        with self.assertRaises(ValueError):project_checks(units,response)
        response=verdict(units);response['checks'].pop(first)
        with self.assertRaises(ValueError):project_checks(units,response)

    def test_stale_or_unknown_continuation_never_buys_a_review(self):
        for change in ('source_output','unknown'):
            current=state();current.update(schedule(current))
            if change=='source_output':current['development']['b10']+=' Changed.'
            else:current['trace']=[{'usage':{'unknown_calls':1}}]
            with patch('core.review_graph.invoke_role',side_effect=AssertionError('No provider call')):
                result=advance(current)
            self.assertTrue(result['development_repair_unlocatable'])

    def test_final_reuse_requires_signature_current_sources_and_actual_word_bio(self):
        import os
        current=state();p=current['package'];v=current['development'];s=current['strategy']
        with patch.dict(os.environ,{'AI_ENGINE_SERVICE_TOKEN':'offline-signing-fixture'}):
            receipts,_=project_checks(units_for(current),verdict(units_for(current)))
            p.update(field_review_receipts=receipts,rendered_artifact='Exact document text',
                rendered_candidate_bios={v['candidates'][0]['name']:v['candidates'][0]['submission_bio']})
            verified=verified_obligations(p,s,v)
            self.assertIn('personal_case:0:0',verified)
            self.assertFalse(any(key.startswith('matter:') or key.startswith('argument:') for key in verified))
            p['rendered_candidate_bios'][v['candidates'][0]['name']]='The exporter omitted the biography.'
            self.assertNotIn('personal_case:0:0',verified_obligations(p,s,v))
            p['rendered_candidate_bios'][v['candidates'][0]['name']]=v['candidates'][0]['submission_bio']
            p['matters'][0]['source_excerpt']+=' A changed original fact.'
            self.assertNotIn('personal_case:0:0',verified_obligations(p,s,v))
        current=state();p=current['package'];v=current['development'];s=current['strategy']
        receipts,_=project_checks(units_for(current),verdict(units_for(current)))
        p.update(field_review_receipts=receipts,rendered_artifact='Document',
            rendered_candidate_bios={v['candidates'][0]['name']:v['candidates'][0]['submission_bio']})
        with patch.dict(os.environ,{'AI_ENGINE_SERVICE_TOKEN':'different-server-secret'}):
            self.assertEqual(verified_obligations(p,s,v),[])

class AvailableWithObservationsTests(unittest.TestCase):
    def test_exhausted_field_keeps_documents_moving_without_approval_or_new_repair(self):
        from core.field_review import retain_observations
        current=state();units=units_for(current);target=units[0]['field']
        other=[u for u in units if u['field']!=target]
        current['field_review_receipts']=project_checks(other,verdict(other))[0]
        current['field_review_failures']=project_checks([units[0]],verdict([units[0]],target))[1]
        current['field_review_attempts']={target:2};before=copy.deepcopy(current)
        with patch('core.review_graph.invoke_role',side_effect=AssertionError('No paid retry')):
            result=retain_observations(current)
        self.assertFalse(result['development_validated'])
        self.assertTrue(result['development_delivery_ready'])
        self.assertFalse(result['errors']);self.assertIsNone(result['repair_continuation'])
        self.assertEqual(result['field_review_observations'][0]['defects'],before['field_review_failures'])
        self.assertEqual(current,before)
        updated={**current,**result};updated['development']['b10']+=' Changed output.'
        self.assertFalse(schedule(updated)['development_delivery_ready'])
        self.assertTrue(schedule(updated)['repair_continuation'])

    def test_missing_proposal_or_unknown_call_never_becomes_available(self):
        from core.field_review import retain_observations
        current=state();units=units_for(current)
        current['field_review_failures']=project_checks([units[0]],verdict([units[0]],units[0]['field']))[1]
        current['trace']=[{'usage':{'unknown_calls':1}}]
        result=retain_observations(current,{'errors':['Unknown provider outcome'],'development_validated':False})
        self.assertFalse(result.get('development_delivery_ready'));self.assertTrue(result['errors'])
