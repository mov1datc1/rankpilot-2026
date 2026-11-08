import copy,json,unittest
from unittest.mock import patch
from pydantic import ValidationError
from core.personal_quality import PERSONAL_QUALITY_CONTRACT,required_personal_matters,personal_quality_errors
from core.editorial_development import development_contract
from core.editorial_case import obligations,execution_output,prepare_case
from core.editorial_repair import coherent_repair_targets,apply_corrections,apply_valid_corrections,repair_targets
from test_editorial_execution import linked_case


def complete_case():
    p,s,v=linked_case();v['personal_quality_contract']=PERSONAL_QUALITY_CONTRACT;c=v['candidates'][0]
    growth='Sofia Vega leads the newly established employment practice and its expansion.'
    p['lawyers'][0]['bio']+=' '+growth
    c['submission_bio']+=' '+growth
    from core.candidate_evidence import profile_units
    unit=profile_units(p['lawyers'][0])[-1]
    c['profile_coverage'].append({'reference':unit['reference'],'decision':'retain','source_quote':growth,'public_quote':growth,'reason':'Retain sourced practice-growth responsibility.'})
    c['category_assessment']={'decision':'supported','criterion':'up_and_coming_growth',
        'career_stage_evidence':[growth],'growth_evidence':[growth],
        'career_stage_assessment':'Developing practice leadership documented in the supplied profile.',
        'alternative_category':'Category pending','alternative_comparison':'The supplied profile explicitly establishes new practice expansion; partnership alone would not support this category.',
        'counterevidence':'The confirmed partner title alone does not decide this category.'}
    c['suggested_ranking']='Up and Coming';c['recommendation']='present'
    for index,work in [(3,'constitutional proceedings restored the right to defend'),(4,'collective representation proceedings prevented a stoppage')]:
        mid=f'm{index}';source=f'Sofia Vega led {work}.'
        p['matters'].append({'id':mid,'source_excerpt':source,'leadPartner':'Sofia Vega'})
        s['matters'].append({'matter_id':mid,'disposition':'core','rationale':'Distinct documented legal contribution','source_quote':source})
        v['matters'].append({'matter_id':mid,'text':source,'legal_issue_source_quote':source,'completion_status':'','decisive_source_quotes':[source]})
        c['supporting_matters'].append({'matter_id':mid,'personal_role':'Led the mandate','source_quote':source})
        c['submission_case_coverage'].append({'matter_id':mid,'source_quote':source,'public_quote':source})
        c['submission_bio']+=' '+source
    return p,s,v

class PersonalQualityContractTests(unittest.TestCase):
    def test_two_correct_links_do_not_excuse_omitting_the_third_material_contribution(self):
        p,s,v=complete_case();self.assertEqual(personal_quality_errors(p,s,v),[])
        v['candidates'][0]['submission_case_coverage'].pop()
        self.assertTrue(any('m4' in e for e in personal_quality_errors(p,s,v)))
        self.assertIn('candidates/0',repair_targets(p,s,v))
        required=prepare_case({'package':p,'strategy':s})['case_requirements']['personal_work_requirements']['Sofia Vega']
        self.assertEqual(required,['m1','m3','m4'])

    def test_team_listing_and_foreign_lead_do_not_create_personal_work_obligations(self):
        p,s,v=complete_case();p['matters'].append({'id':'team','source_excerpt':'The team completed a documented investigation.','leadPartner':'Luis Prado','teamMembers':'Sofia Vega'})
        s['matters'].append({'matter_id':'team','disposition':'core'})
        self.assertNotIn('team',required_personal_matters(p,s,v['candidates'][0]))
        self.assertEqual(personal_quality_errors(p,s,v),[])

    def test_b9_can_expand_to_1000_words_without_an_artificial_minimum(self):
        p,s,v=complete_case();c=v['candidates'][0];short=c['submission_bio']
        c['submission_bio']=short+' '+' '.join(['supported']*(1000-len(short.split())))
        self.assertEqual(personal_quality_errors(p,s,v),[])
        c['submission_bio']+=' excess'
        self.assertTrue(any('1.000' in e for e in personal_quality_errors(p,s,v)))
        c['submission_bio']=short;self.assertEqual(personal_quality_errors(p,s,v),[])

    def test_category_needs_positive_own_evidence_and_coherent_pending_action(self):
        p,s,v=complete_case();c=v['candidates'][0]
        c['category_assessment']['growth_evidence']=[]
        self.assertTrue(any('Up and Coming' in e for e in personal_quality_errors(p,s,v)))
        c['category_assessment']['growth_evidence']=['Another lawyer developed the practice.']
        self.assertTrue(any('evidencia propia' in e for e in personal_quality_errors(p,s,v)))
        c['category_assessment']['decision']='pending'
        self.assertTrue(any('pendiente' in e for e in personal_quality_errors(p,s,v)))
        c.update(recommendation='develop',suggested_ranking='Category pending',category_missing_criterion='Practice-growth evidence missing',recommended_action='Supply attributable practice-growth evidence.')
        c['category_assessment'].update(criterion='pending',growth_evidence=[])
        self.assertEqual(personal_quality_errors(p,s,v),[])

    def test_native_generation_schema_requires_quality_and_category_assessment_but_legacy_remains_readable(self):
        p,s,v=complete_case();schema=development_contract(p,s,personal_quality=True)
        # Validate individual new fields without fabricating unrelated matter drafts.
        self.assertIn('personal_quality_contract',schema.model_fields)
        typ=schema.model_fields['candidates'].annotation.__args__[0]
        typ.model_validate(v['candidates'][0]);bad=copy.deepcopy(v['candidates'][0]);bad.pop('category_assessment')
        with self.assertRaises(ValidationError):typ.model_validate(bad)
        old=copy.deepcopy(v);old.pop('personal_quality_contract')
        self.assertEqual(personal_quality_errors(p,s,old),[])

    def test_audit_and_b9_have_own_checks_for_each_shared_case_and_internal_category(self):
        p,s,v=complete_case();items=obligations(p,s,v)
        bio=[o for o in items if o['id'].startswith('personal_case:')]
        audit=[o for o in items if o['id'].startswith('personal_audit:')]
        self.assertEqual(len(bio),3);self.assertEqual(len(audit),3)
        self.assertEqual([o['sources'] for o in bio],[o['sources'] for o in audit])
        category=next(o for o in items if o['id']=='category:0:fit');self.assertEqual(category['output_scope'],'internal')
        p['rendered_artifact']='Public exact Word only'
        text,rendered=execution_output(p,v,{},category['field'])
        self.assertEqual(text,v['candidates'][0]['category_rationale']);self.assertIsNone(rendered)

    def test_repair_cannot_drop_unaffected_case_while_fixing_another_sentence(self):
        p,s,v=complete_case();c=v['candidates'][0]
        bad='An unsupported promotional sentence.';c['submission_bio']+=' '+bad
        t=coherent_repair_targets(v,{'candidates/0/submission_bio':{'current_value':c['submission_bio'],'problem':'Remove unsupported assertion','rejected_quotes':[bad]}})
        fixed=copy.deepcopy(c);fixed['submission_bio']=fixed['submission_bio'].replace(bad,'').strip()
        fix={'path':'candidates/0','value':fixed,'reason':'Remove the rejected sentence only.'}
        apply_corrections(v,t,{'corrections':[fix],'unresolved':[]})
        fixed['submission_bio']=fixed['submission_bio'].replace(fixed['submission_case_coverage'][-1]['public_quote'],'')
        with self.assertRaisesRegex(ValueError,'unaffected evidenced'):
            apply_corrections(v,t,{'corrections':[fix],'unresolved':[]})

    def test_one_rejected_delta_does_not_discard_other_valid_repairs(self):
        p,s,v=complete_case();c=v['candidates'][0]
        t=coherent_repair_targets(v,{'candidates/0/submission_bio':{'current_value':c['submission_bio'],'problem':'Expand biography'},'b10':{'current_value':v['b10'],'problem':'Expand overview'}})
        broken=copy.deepcopy(c);broken['submission_bio']='A shortened generic profile.'
        fixed,failed=apply_valid_corrections(v,t,{'corrections':[{'path':'b10','value':'A corrected overview.','reason':'Correct the overview.'},{'path':'candidates/0','value':broken,'reason':'Incorrect contraction.'},{'path':'institutional_execution','value':[{'argument_index':0,'b10_quote':'A corrected overview.','c2_quote':v['c2']}],'reason':'Refresh the affected proof.'}],'unresolved':[]})
        self.assertEqual(fixed['b10'],'A corrected overview.');self.assertEqual(fixed['candidates'][0],c)
        self.assertEqual(set(failed),{'candidates/0'})

    def test_regressive_bio_is_retried_alone_without_rebuying_valid_overview(self):
        from core.editorial_repair import repair_development
        from test_surgical_repair_postconditions import native_answer
        p,s,v=complete_case();c=v['candidates'][0]
        targets={'candidates/0/submission_bio':{'current_value':c['submission_bio'],'problem':'Improve the biography without losing evidence.'},'b10':{'current_value':v['b10'],'problem':'Develop the overview.'}}
        new_bio=c['submission_bio']+' Her practice combines those attributed contributions.'
        broken=copy.deepcopy(c);broken['submission_bio']='A generic short biography.'
        calls=[]
        def invoke(state,role,schema,instruction,payload):
            calls.append(payload)
            if len(calls)==1:
                answer={'corrections':[{'path':'b10','value':v['b10']+' The practice integrates collective and constitutional work.','reason':'Develop the overview.'},
                    {'path':'institutional_execution','value':[{'argument_index':0,'b10_quote':v['b10'],'c2_quote':v['c2']}],'reason':'Retain valid proof.'},
                    {'path':'candidates/0','value':broken,'reason':'An invalid shortening.'}],'unresolved':[]}
                # Native delta cannot emit unrelated candidate properties.
                answer['corrections'][-1]['value']={'submission_bio':broken['submission_bio'],'profile_coverage':None,'submission_case_coverage':None}
            else:
                self.assertEqual(set(payload['repair_targets']),{'candidates/0'})
                answer={'corrections':[{'path':'candidates/0','value':{'submission_bio':new_bio,'profile_coverage':None,'submission_case_coverage':None},'reason':'Keep every validated contribution and credential.'}],'unresolved':[]}
            reply=native_answer(answer,payload['target_references']);schema.model_validate(reply)
            return reply,list(state.get('trace',[]))+[{'role':'repair','usage':{'total_tokens':10}}]
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            result=repair_development({'package':p,'strategy':s},v,targets)
        self.assertEqual(len(calls),2);self.assertTrue(result['development_validated'],result.get('errors'))
        self.assertIn('constitutional work',result['development']['b10'])
        self.assertEqual(result['development']['candidates'][0]['submission_bio'],new_bio)
        self.assertEqual(sum(t['usage']['total_tokens'] for t in result['trace']),20)

    def test_new_development_review_cannot_revalidate_an_old_two_case_checkpoint_as_complete(self):
        from core.editorial_development import develop
        p,s,v=complete_case();v.pop('personal_quality_contract');v['candidates'][0].pop('category_assessment')
        with patch('core.review_graph.invoke_role') as model:
            result=develop({'package':p,'strategy':s,'development':v,'development_reusable':True,
                'development_revalidation_only':True,'case_requirements':prepare_case({'package':p,'strategy':s})['case_requirements']})
        model.assert_not_called();self.assertFalse(result['development_validated'])
        self.assertTrue(any('evaluación explícita' in e for e in result['errors']))

    def test_privacy_repair_can_generalize_affected_case_while_preserving_other_evidence(self):
        p,s,v=complete_case();c=v['candidates'][0]
        old=c['submission_case_coverage'][0]['public_quote'];private=old+' The mandate covered 200 employees and reduced exposure by 80%.'
        c['submission_bio']=c['submission_bio'].replace(old,private);c['submission_case_coverage'][0]['public_quote']=private
        t=coherent_repair_targets(v,{'candidates/0/submission_bio':{'current_value':c['submission_bio'],'problem':'Generalize only the identifying metrics.','privacy_matter_ids':['m1']}},package=p)
        fixed=copy.deepcopy(c);fixed['submission_bio']=fixed['submission_bio'].replace(private,old);fixed['submission_case_coverage'][0]['public_quote']=old
        result=apply_corrections(v,t,{'corrections':[{'path':'candidates/0','value':fixed,'reason':'Retain the achieved result without the identifying metric combination.'}],'unresolved':[]})
        self.assertEqual(result['candidates'][0]['submission_bio'],fixed['submission_bio'])
        self.assertIn(c['submission_case_coverage'][-1]['public_quote'],result['candidates'][0]['submission_bio'])

    def test_candidate_and_bio_targets_merge_instead_of_overwriting_expanded_work(self):
        p,s,v=complete_case();c=v['candidates'][0]
        t=coherent_repair_targets(v,{'candidates/0':{'current_value':c,'problem':'Complete category evidence.'},
            'candidates/0/submission_bio':{'current_value':c['submission_bio'],'problem':'Correct a private footprint.','privacy_matter_ids':['m1'],'rejected_quotes':['An actual rejected claim.']}},package=p)
        self.assertEqual(set(t),{'candidates/0'});self.assertEqual(t['candidates/0']['privacy_matter_ids'],['m1'])
        self.assertEqual(t['candidates/0']['rejected_quote_path'],'candidates/0/submission_bio')
