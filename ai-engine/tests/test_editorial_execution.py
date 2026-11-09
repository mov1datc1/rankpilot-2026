import copy,json,unittest
from unittest.mock import patch
from core.editorial_execution import EXECUTION_CONTRACT, execution_errors, personal_case_errors, missing_head_bios
from core.editorial_development import development_errors, development_contract
from core.editorial_case import obligations
from core.editorial_repair import coherent_repair_targets, repair_development, repair_rejected_development, apply_corrections, repair_targets
from test_candidate_evidence import candidate_case

WORK='Sofia led negotiations that prevented a strike.'
SECOND='Sofia led an investigation that prevented litigation.'

def linked_case():
    p,s,v=candidate_case();v['execution_contract']=EXECUTION_CONTRACT
    c=v['candidates'][0];c['submission_bio']+=' '+WORK
    c['submission_case_coverage']=[{'matter_id':'m1','source_quote':p['matters'][0]['source_excerpt'],'public_quote':WORK}]
    v['institutional_execution']=[{'argument_index':0,'b10_quote':v['b10'],'c2_quote':v['c2']}]
    return p,s,v

class LinkedExecutionTests(unittest.TestCase):
    def test_structured_residuals_receive_one_owned_recovery_with_current_evidence(self):
        p,s,v=linked_case();original=copy.deepcopy(v)
        v['case_plan']['institutional_arguments'][0]['evidence'][0]['source_quote']='Invented source quote'
        v['institutional_execution'][0]['c2_quote']='Invented public quote'
        targets=repair_targets(p,s,v);calls=[]
        def invoke(state,role,schema,instruction,payload):
            group=payload['repair_targets'];calls.append(copy.deepcopy(payload))
            corrections=[]
            for path,t in group.items():
                value=copy.deepcopy(t['current_value'])
                if len(calls)>1:value=copy.deepcopy(original[path])
                corrections.append({'path':path,'value':value,'reason':'Correct own binding'})
            return {'corrections':corrections,'unresolved':[]},state.get('trace',[])+[{'role':'repair','usage':{'total_tokens':7}}]
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            result=repair_development({'package':p,'strategy':s,'trace':[]},v,targets)
        self.assertTrue(result['development_validated'],result['errors'])
        self.assertEqual(len(calls),2)
        self.assertEqual(set(calls[1]['repair_targets']),{'case_plan','institutional_execution'})
        self.assertIn('Invented source quote',str(calls[1]['repair_targets']['case_plan']['validation_errors']))
        self.assertIn('c2_quote',str(calls[1]['repair_targets']['institutional_execution']['validation_errors']))
        self.assertEqual(calls[1]['repair_targets']['institutional_execution']['source_evidence']['b10'],v['b10'])
        self.assertEqual(result['development']['candidates'],original['candidates'])
        self.assertEqual(result['development']['matters'],original['matters'])

    def test_ineffective_structured_recovery_is_bounded_and_stays_rejected(self):
        p,s,v=linked_case();v['institutional_execution'][0]['c2_quote']='Invented public quote'
        targets=repair_targets(p,s,v)
        def invoke(state,role,schema,instruction,payload):
            return {'corrections':[{'path':path,'value':t['current_value'],'reason':'Still wrong'} for path,t in payload['repair_targets'].items()],'unresolved':[]},state.get('trace',[])+[{'usage':{'total_tokens':7}}]
        with patch('core.review_graph.invoke_role',side_effect=invoke) as model:
            result=repair_development({'package':p,'strategy':s,'trace':[]},v,targets)
        self.assertEqual(model.call_count,2)
        self.assertFalse(result['development_validated'])
        self.assertEqual(result['repair_report']['retry_paths'],['institutional_execution'])
        self.assertEqual(result['repair_report']['failed_paths'],['institutional_execution'])

    def test_institutional_recovery_reads_retained_c2_after_prose_correction(self):
        p,s,v=linked_case();v['institutional_execution'][0]['c2_quote']='Old missing quote'
        targets=repair_targets(p,s,v)
        targets['c2']={'current_value':v['c2'],'problem':'Clarify coverage','source_evidence':{'package':p,'strategy':s}}
        replacement='The firm requests recognition for its collective labour negotiations.'
        calls=[]
        def invoke(state,role,schema,instruction,payload):
            calls.append(copy.deepcopy(payload));corrections=[]
            for path,t in payload['repair_targets'].items():
                value=copy.deepcopy(t['current_value'])
                if path=='c2':value=replacement
                elif len(calls)>1:
                    self.assertEqual(t['source_evidence']['c2'],replacement)
                    value[0]['c2_quote']=replacement
                corrections.append({'path':path,'value':value,'reason':'Synchronize current output'})
            return {'corrections':corrections,'unresolved':[]},state.get('trace',[])+[{'usage':{'total_tokens':7}}]
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            result=repair_development({'package':p,'strategy':s,'trace':[]},v,targets)
        self.assertTrue(result['development_validated'],result['errors'])
        self.assertEqual(set(calls[1]['repair_targets']),{'institutional_execution'})
        self.assertEqual(result['development']['c2'],replacement)

    def test_new_contract_is_exposed_by_generation_schema_without_rejecting_legacy_proposals(self):
        p,s,v=linked_case();self.assertEqual(development_errors(p,s,v),[])
        model=development_contract(p,s);self.assertEqual(model.model_validate(v).execution_contract,EXECUTION_CONTRACT)
        old=copy.deepcopy(v);old.pop('execution_contract');old['candidates'][0].pop('submission_case_coverage')
        self.assertEqual(execution_errors(p,old),[])

    def test_generic_bio_cannot_substitute_for_bound_personal_work(self):
        p,s,v=linked_case();c=v['candidates'][0];c['submission_case_coverage']=[]
        self.assertTrue(personal_case_errors(p,c))
        self.assertIn('candidates/0',repair_targets(p,s,v))
        c['submission_case_coverage']=[{'matter_id':'m1','source_quote':p['matters'][0]['source_excerpt'],'public_quote':v['b10']}]
        self.assertTrue(personal_case_errors(p,c))

    def test_foreign_source_and_duplicate_output_cannot_prove_two_personal_contributions(self):
        p,s,v=linked_case();c=v['candidates'][0]
        c['supporting_matters'].append({'matter_id':'m2','personal_role':'Led investigation','source_quote':'Partner Sofia Vega led an investigation'})
        self.assertTrue(personal_case_errors(p,c))
        c['submission_bio']+=' '+SECOND
        c['submission_case_coverage'].append({'matter_id':'m2','source_quote':p['matters'][1]['source_excerpt'],'public_quote':SECOND})
        self.assertEqual(personal_case_errors(p,c),[])
        c['submission_case_coverage'][1]['public_quote']=WORK
        self.assertTrue(personal_case_errors(p,c))
        c['submission_case_coverage'][1].update(public_quote=SECOND,source_quote=p['matters'][0]['source_excerpt'])
        self.assertTrue(personal_case_errors(p,c))

    def test_c2_cannot_be_proved_with_b10_words_or_the_same_copied_paragraph(self):
        p,s,v=linked_case();v['institutional_execution'][0]['c2_quote']=v['b10']
        self.assertTrue(execution_errors(p,v))
        v['c2']=v['b10'];self.assertTrue(execution_errors(p,v))

    def test_partner_title_does_not_satisfy_separate_confirmed_head_function(self):
        p,s,v=linked_case();p['filing_details']={'heads':[{'name':'Sofia Vega'}]}
        v['candidates'][0]['submission_bio']+=' Sofia is a Partner and leads the negotiations.'
        self.assertEqual(missing_head_bios(p,v),[0])
        target=repair_targets(p,s,v)['candidates/0/submission_bio']
        self.assertIn('separately confirmed',target['problem'])
        v['candidates'][0]['submission_bio']+=' Sofia heads the Labour & Employment department.'
        self.assertEqual(missing_head_bios(p,v),[])
        self.assertEqual(execution_errors(p,v),[])

    def test_exact_word_review_checks_each_link_against_its_own_mandate(self):
        p,s,v=linked_case();checks=obligations(p,s,v)
        personal=[o for o in checks if o['id'].startswith('personal_case:')]
        self.assertEqual(len(personal),1);self.assertEqual(personal[0]['sources'],[p['matters'][0]])
        self.assertFalse(any(o['id']=='candidate:0:b9' for o in checks))

    def marketing_case(self):
        p,s,v=linked_case();c=v['candidates'][0]
        bad='Sofia served as Legal Director at Example Staffing and is the most respected specialist in the country.'
        good='Sofia previously served as Legal Director at Example Staffing.'
        p['lawyers'][0]['bio']=bad;c['submission_bio']=bad+' '+WORK
        c['profile_coverage']=[{'reference':'P01','decision':'retain','source_quote':bad,'public_quote':bad,'reason':'Preserves prior employment.'}]
        target={'candidates/0/submission_bio':{'current_value':c['submission_bio'],'problem':'Withdraw unsupported national comparison.',
            'source_evidence':{'source_person':p['lawyers'][0]},'rejected_quotes':['the most respected specialist in the country']}}
        fixed=copy.deepcopy(c);fixed['submission_bio']=good+' '+WORK
        fixed['profile_coverage'][0].update(decision='generalize',public_quote=good,reason='Preserve the original role and employer, withdraw the unsupported comparative assessment.')
        return p,s,v,target,fixed

    def test_bio_repair_updates_bindings_without_erasing_career_or_rejecting_immutable_source_quote(self):
        p,s,v,t,fixed=self.marketing_case();trace={'role':'repair','usage':{'total_tokens':7}}
        response={'corrections':[{'path':'candidates/0','value':fixed,'reason':'Remove only the unsupported assessment.'}],'unresolved':[]}
        with patch('core.review_graph.invoke_role',return_value=(response,[trace])) as model:
            result=repair_development({'package':p,'strategy':s,'trace':[]},v,t)
        self.assertTrue(result['development_validated'],result.get('errors'));self.assertEqual(model.call_count,1)
        c=result['development']['candidates'][0]
        self.assertIn('Legal Director',c['submission_bio']);self.assertNotIn('most respected',c['submission_bio'])
        self.assertIn('most respected',c['profile_coverage'][0]['source_quote'])
        self.assertEqual(result['development']['b10'],v['b10']);self.assertEqual(result['development']['matters'],v['matters'])

    def test_biography_delta_cannot_change_ranking_or_personal_source_bindings(self):
        p,s,v,t,fixed=self.marketing_case();targets=coherent_repair_targets(v,t)
        for field,value in [('suggested_ranking','Senior Statespeople'),('supporting_matters',[])]:
            changed={**fixed,field:value}
            with self.assertRaisesRegex(ValueError,'unrelated candidacy'):
                apply_corrections(v,targets,{'corrections':[{'path':'candidates/0','value':changed,'reason':'Alter other fields'}]})
        changed=copy.deepcopy(fixed);changed['submission_case_coverage'][0]['source_quote']='A different original passage'
        with self.assertRaisesRegex(ValueError,'source bindings'):
            apply_corrections(v,targets,{'corrections':[{'path':'candidates/0','value':changed,'reason':'Replace proof'}]})

    def test_bio_parent_delta_preserves_an_independently_authorized_sibling_change(self):
        p,s,v,t,fixed=self.marketing_case();targets=coherent_repair_targets(v,t)
        targets['candidates/0/category_rationale']={'current_value':v['candidates'][0]['category_rationale']}
        result=apply_corrections(v,targets,{'corrections':[{'path':'candidates/0/category_rationale','value':'Specific retained category rationale.','reason':'Separate authorized change'},
            {'path':'candidates/0','value':fixed,'reason':'Bio only'}]})
        self.assertEqual(result['candidates'][0]['category_rationale'],'Specific retained category rationale.')

    def test_candidate_repair_does_not_repeat_unrelated_matter_narratives(self):
        p,s,v,t,fixed=self.marketing_case()
        p['matters'].append({'id':'other','client':'Example Other Employer','source_excerpt':'UNRELATED_PRIVATE_NARRATIVE','leadPartner':'Luis Prado'})
        s['matters'].append({'matter_id':'other','disposition':'reserve'})
        defect={'owner':'rankpilot','code':'UNSUPPORTED_CLAIM','severity':'critical','scope':'submission','field_path':'candidates/0/submission_bio',
            'artifact_quote':'the most respected specialist in the country','message':'Remove unsupported assessment.'}
        with patch('core.editorial_repair.repair_development',return_value={}) as repair,patch('core.review_graph.invoke_role') as locator:
            repair_rejected_development({'package':p,'strategy':s},v,[defect])
        locator.assert_not_called();evidence=repair.call_args.args[2]['candidates/0/submission_bio']['source_evidence']
        self.assertNotIn('UNRELATED_PRIVATE_NARRATIVE',json.dumps(evidence));self.assertNotIn('package',evidence)
        self.assertEqual([m['id'] for m in evidence['personally_attributed_matters']],['m1','m2'])
        self.assertIn('Example Other Employer',json.dumps(evidence['public_entity_restrictions']))

    def test_initial_profile_repair_also_omits_unrelated_narratives(self):
        p,s,v=linked_case();v['candidates'][0]['submission_case_coverage']=[]
        p['matters'].append({'id':'other','client':'Example Other Employer','source_excerpt':'UNRELATED_PRIVATE_NARRATIVE','leadPartner':'Luis Prado'})
        s['matters'].append({'matter_id':'other','disposition':'reserve'})
        evidence=repair_targets(p,s,v)['candidates/0']['source_evidence']
        self.assertNotIn('UNRELATED_PRIVATE_NARRATIVE',json.dumps(evidence))
        self.assertEqual([m['id'] for m in evidence['eligible_source_matters']],['m1','m2'])

    def test_public_text_repair_preserves_unaffected_institutional_bindings_without_false_retry(self):
        p,s,v=linked_case();good=v['b10'];v['b10']+=' The firm is the biggest.'
        target={'b10':{'current_value':v['b10'],'problem':'Remove unsupported comparative assessment.',
            'source_evidence':{'package':p,'strategy':s},'rejected_quotes':['The firm is the biggest.']}}
        response={'corrections':[{'path':'b10','value':good,'reason':'Preserve demonstrated work.'},
            {'path':'institutional_execution','value':v['institutional_execution'],'reason':'Existing output quotations remain literal.'}],'unresolved':[]}
        with patch('core.review_graph.invoke_role',return_value=(response,[{'role':'repair','usage':{'total_tokens':7}}])) as model:
            result=repair_development({'package':p,'strategy':s},v,target)
        self.assertTrue(result['development_validated'],result.get('errors'));self.assertEqual(model.call_count,1)
        self.assertEqual(result['development']['institutional_execution'],v['institutional_execution'])
