import copy
import unittest
from unittest.mock import patch
from core.editorial_case import obligations, case_errors, comparison_style_defects
from core.editorial_execution import personal_case_errors, primary_lead_anchor
from core.editorial_repair import coherent_repair_targets, repair_development, repair_targets, apply_corrections
from test_editorial_execution import linked_case, WORK
from test_candidate_evidence import PUBLIC


class IncludedBiographyQualityTests(unittest.TestCase):
    def test_develop_and_non_nominated_chambers_bios_keep_personal_result_checks(self):
        for decision in ('develop', 'do_not_present'):
            p,s,v=linked_case();p['directory']='Chambers'
            c=v['candidates'][0];c['recommendation']=decision
            checks=[o for o in obligations(p,s,v) if o['id'].startswith('personal_case:')]
            self.assertEqual(len(checks),1)
            self.assertIn('achieved interim or final result',checks[0]['instruction'])
            self.assertEqual(c['recommendation'],decision)
            c['submission_case_coverage']=[]
            self.assertTrue(personal_case_errors(p,c,s))
            self.assertEqual(primary_lead_anchor(p,s,c),'m1')

    def test_legal500_omitted_profile_never_acquires_a_public_bio_requirement(self):
        p,s,v=linked_case();p['directory']='Legal 500'
        c=v['candidates'][0];c.update(recommendation='develop',submission_case_coverage=[])
        self.assertEqual(personal_case_errors(p,c,s),[])
        self.assertIsNone(primary_lead_anchor(p,s,c))
        self.assertFalse(any(o['id'].startswith('personal_case:') for o in obligations(p,s,v)))

    def test_team_only_pending_profile_without_mandates_is_not_forced_to_invent_a_result(self):
        p,s,v=linked_case();c=v['candidates'][0]
        c.update(recommendation='develop',supporting_matters=[],submission_case_coverage=[])
        for m in p['matters']:m['leadPartner']='Luis Prado';m['teamMembers']='Sofia Vega'
        self.assertEqual(personal_case_errors(p,c,s),[])
        self.assertFalse(any(o['id'].startswith('personal_case:') for o in obligations(p,s,v)))

    def test_plain_bio_edit_refreshes_its_proofs_in_the_same_paid_call(self):
        p,s,v=linked_case();before=copy.deepcopy(v);c=copy.deepcopy(v['candidates'][0])
        updated=PUBLIC.replace('Sofia previously served','Before joining the firm, Sofia served')
        c['submission_bio']=updated+' '+WORK
        for item in c['profile_coverage']:
            if item['decision']=='retain':item['public_quote']=updated
        target={'candidates/0/submission_bio':{'current_value':v['candidates'][0]['submission_bio'],
            'problem':'Correct only this generated biography wording.', 'source_evidence':{'person':p['lawyers'][0]}}}
        scoped=coherent_repair_targets(v,target)
        self.assertEqual(set(scoped),{'candidates/0'})
        self.assertEqual(scoped['candidates/0']['preserve_profile_quotes'],[])
        response={'corrections':[{'path':'candidates/0','value':c,'reason':'Update the authorized BIO and its output references together.'}],'unresolved':[]}
        with patch('core.review_graph.invoke_role',return_value=(response,[{'role':'repair','usage':{'total_tokens':9}}])) as model:
            result=repair_development({'package':p,'strategy':s},v,target)
        self.assertTrue(result['development_validated'],result.get('errors'))
        self.assertEqual(model.call_count,1)
        self.assertEqual(result['development']['matters'],before['matters'])
        self.assertEqual(result['development']['candidates'][0]['recommendation'],before['candidates'][0]['recommendation'])

    def test_bio_output_refresh_cannot_change_or_drop_original_profile_units(self):
        p,s,v=linked_case();target=coherent_repair_targets(v,{'candidates/0/submission_bio':{
            'current_value':v['candidates'][0]['submission_bio'],'source_evidence':{'person':p['lawyers'][0]}}})
        for change in ('source','reference','drop'):
            c=copy.deepcopy(v['candidates'][0]);c['submission_bio']+=' She advises employers.'
            if change=='drop':c['profile_coverage'].pop()
            elif change=='source':c['profile_coverage'][0]['source_quote']='A different original claim.'
            else:c['profile_coverage'][0]['reference']='P99'
            with self.assertRaisesRegex(ValueError,'original profile source units'):
                apply_corrections(v,target,{'corrections':[{'path':'candidates/0','value':c,'reason':'Attempted source change.'}]})

    def test_vague_relative_scale_is_repaired_against_only_its_own_two_sources(self):
        for phrase in ('menor escala','mayor escala','smaller scale','larger-scale'):
            p,s,v=linked_case();v['comparisons'][0]['tradeoff']='The reserve has '+phrase+'.'
            self.assertTrue(any('escala imprecisa' in e for e in case_errors(p,s,v)))
            target=repair_targets(p,s,v)['comparisons/0/tradeoff']
            self.assertEqual(set(target['source_evidence']),{'selected','reserve'})
            v['comparisons'][0]['tradeoff']='The selected matter documents strike prevention; the reserve describes an investigation.'
            self.assertEqual(case_errors(p,s,v),[])

    def test_audit_cannot_reintroduce_vague_scale_after_validated_comparison(self):
        defect=comparison_style_defects({'evidence_gaps':'La reserva aporta trabajo de menor escala.'})
        self.assertEqual(defect[0]['field_path'],'evidence_gaps')
        self.assertEqual(defect[0]['owner'],'rankpilot')
        self.assertEqual(comparison_style_defects({'evidence_gaps':'El núcleo acredita riesgo de paro y sindicatos competidores; la reserva describe negociación sin resultado declarado.'}),[])

    def test_bio_and_audit_consistency_cannot_be_excused_by_two_valid_links(self):
        p,s,v=linked_case();c=v['candidates'][0];c['recommendation']='develop'
        check=next(o for o in obligations(p,s,v) if o['id']=='candidate:0:b9_audit_consistency')
        self.assertEqual(check['field'],'candidates/0/submission_bio')
        self.assertIn('actual Audit leadership argument',check['instruction'])
        self.assertIn('every mandate the BIO itself describes',check['instruction'])
        self.assertIn(p['matters'][0],check['sources'])
        self.assertIn(p['lawyers'][0],check['sources'])
        self.assertIn('cannot excuse a material mismatch',check['instruction'])

    def test_only_immutable_bio_output_repairs_can_skip_external_ranking_context(self):
        from core.editorial_repair import biography_output_targets_only
        target={'candidates/0':{'mutable_fields':['submission_bio','profile_coverage','submission_case_coverage']}}
        self.assertTrue(biography_output_targets_only(target))
        for changed in ({'candidates/0':{}},{'candidates/0':{'mutable_fields':['submission_bio','suggested_ranking']}},
                        {**target,'b10':{}},{}):
            self.assertFalse(biography_output_targets_only(changed))
