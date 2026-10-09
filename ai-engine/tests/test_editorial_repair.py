import copy
import unittest
from unittest.mock import patch
from test_editorial_development import PACKAGE, STRATEGY, DEV
from core.editorial_development import develop
from core.editorial_repair import repair_targets, apply_corrections

class TargetedRepairTests(unittest.TestCase):
    def broken(self):
        proposal=copy.deepcopy(DEV)
        proposal['matters'][0]['decisive_source_quotes']=['The team prevented a walkout.']
        proposal['candidates'][0]['suggested_ranking']='Associate to Watch'
        return proposal
    def test_repair_can_only_touch_validator_identified_fields(self):
        proposal=self.broken();targets=repair_targets(PACKAGE,STRATEGY,proposal)
        self.assertEqual(set(targets),{'matters/0/decisive_source_quotes/0','candidates/0/suggested_ranking'})
        for path in ['matters/0/text','matters/0/matter_id','candidates/0/name','b10','approved']:
            with self.assertRaises(ValueError):apply_corrections(proposal,targets,{'corrections':[{'path':path,'value':'Overwrite','reason':'change'}]})
    def test_different_errors_repaired_in_one_call_without_full_regeneration(self):
        proposal=self.broken()
        repair={'corrections':[{'path':'matters/0/decisive_source_quotes/0','value':'prevented a strike','reason':'Exact source clause'},{'path':'candidates/0/suggested_ranking','value':'Partner candidacy','reason':'Confirmed partner'}],'unresolved':[]}
        with patch('core.review_graph.invoke_role',return_value=(repair,[{'role':'repair'}])) as model:
            result=develop({'package':PACKAGE,'strategy':STRATEGY,'development':proposal,'development_reusable':True})
        self.assertTrue(result['development_validated']);model.assert_called_once();self.assertEqual(model.call_args.args[1],'repair')
        fixed=result['development'];self.assertEqual(fixed['matters'][0]['text'],proposal['matters'][0]['text']);self.assertEqual(fixed['b10'],proposal['b10']);self.assertEqual(fixed['candidates'][0]['submission_bio'],proposal['candidates'][0]['submission_bio'])
    def test_ai_cannot_claim_success_with_invented_replacement(self):
        repair={'corrections':[{'path':'matters/0/decisive_source_quotes/0','value':'won a billion dollars','reason':'unsupported'}],'unresolved':[]}
        with patch('core.review_graph.invoke_role',return_value=(repair,[{'role':'repair'}])):
            result=develop({'package':PACKAGE,'strategy':STRATEGY,'development':self.broken(),'development_reusable':True})
        self.assertFalse(result['development_validated']);self.assertTrue(result['errors'])
    def test_missing_evidence_remains_unresolved_and_does_not_loop(self):
        with patch('core.review_graph.invoke_role',return_value=({'corrections':[],'unresolved':['No support for the proposed claim']},[])) as model:
            result=develop({'package':PACKAGE,'strategy':STRATEGY,'development':self.broken(),'development_reusable':True})
        model.assert_called_once();self.assertFalse(result['development_validated'])
    def test_length_and_missing_public_sections_are_repair_targets(self):
        proposal=copy.deepcopy(DEV);proposal['b10']='word '*501;proposal['c2']=''
        targets=repair_targets(PACKAGE,STRATEGY,proposal)
        self.assertEqual(set(targets),{'b10','c2'})

    def test_unsupported_attribution_repairs_the_candidate_without_rewriting_matters(self):
        proposal=copy.deepcopy(DEV)
        proposal['candidates'][0]['supporting_matters'].append({'matter_id':proposal['matters'][0]['matter_id'],'personal_role':'Invented leadership','source_quote':'This person won an unrelated case.'})
        proposal['candidates'][0]['submission_bio']='Includes an unsupported attribution.'
        targets=repair_targets(PACKAGE,STRATEGY,proposal)
        self.assertEqual(set(targets),{'candidates/0'})
        repair={'corrections':[{'path':'candidates/0','value':DEV['candidates'][0],'reason':'Withdraw unsupported attribution and reconcile bio.'}],'unresolved':[]}
        with patch('core.review_graph.invoke_role',return_value=(repair,[{'role':'repair'}])) as model:
            result=develop({'package':PACKAGE,'strategy':STRATEGY,'development':proposal,'development_reusable':True})
        self.assertTrue(result['development_validated']);model.assert_called_once()
        self.assertEqual(result['development']['matters'],proposal['matters'])
        self.assertEqual(result['development']['b10'],proposal['b10'])
        self.assertEqual(result['development']['candidates'],DEV['candidates'])

    def test_candidate_repair_cannot_rename_person(self):
        proposal=copy.deepcopy(DEV);proposal['candidates'][0]['supporting_matters'][0]['source_quote']='Invented attribution'
        targets=repair_targets(PACKAGE,STRATEGY,proposal)
        other={**DEV['candidates'][0],'name':'Another Person'}
        with self.assertRaisesRegex(ValueError,'identity'):
            apply_corrections(proposal,targets,{'corrections':[{'path':'candidates/0','value':other,'reason':'rename'}]})

    def test_repeating_the_same_support_cannot_inflate_a_candidacy(self):
        from core.editorial_development import development_errors
        proposal=copy.deepcopy(DEV)
        proposal['candidates'][0]['supporting_matters']*=2
        self.assertTrue(any('duplicados' in e for e in development_errors(PACKAGE,STRATEGY,proposal)))
        self.assertEqual(set(repair_targets(PACKAGE,STRATEGY,proposal)),{'candidates/0'})

    def test_prior_generated_prose_is_not_passed_as_repair_source_evidence(self):
        package=copy.deepcopy(PACKAGE)
        package['matters'][0]['optimizedText']='Generated false claim'
        proposal=copy.deepcopy(DEV);proposal['candidates'][0]['supporting_matters'][0]['source_quote']='Wrong generated quote'
        target=repair_targets(package,STRATEGY,proposal)['candidates/0']
        self.assertNotIn('optimizedText',target['source_evidence']['selected_matters'][0])
        self.assertEqual(package['matters'][0]['optimizedText'],'Generated false claim')

    def test_audit_voice_is_detected_and_repaired_locally(self):
        from core.editorial_development import development_errors
        for path in ('b10','c2','matters/0/text','candidates/0/submission_bio'):
            with self.subTest(path=path):
                proposal=copy.deepcopy(DEV)
                parts=path.split('/');parent=proposal
                for part in parts[:-1]:parent=parent[int(part)] if isinstance(parent,list) else parent[part]
                original=parent[parts[-1]]
                parent[parts[-1]]='The source does not state a completed outcome. '+original
                self.assertIn('Voz auditora en Submission: '+path,development_errors(PACKAGE,STRATEGY,proposal))
                self.assertEqual(set(repair_targets(PACKAGE,STRATEGY,proposal)),{path})
                repair={'corrections':[{'path':path,'value':original,'reason':'Remove commentary; retain supported work.'}],'unresolved':[]}
                with patch('core.review_graph.invoke_role',return_value=(repair,[])) as model:
                    result=develop({'package':PACKAGE,'strategy':STRATEGY,'development':proposal,'development_reusable':True})
                self.assertTrue(result['development_validated']);self.assertEqual(result['development'],DEV)
                self.assertEqual(model.call_args.args[1],'repair');model.assert_called_once()

    def test_actual_legal_evidence_and_audit_work_are_not_source_commentary(self):
        from core.editorial_development import submission_voice_paths
        for text in ('The team challenged the evidence submitted by the tax authority.',
                     'We advised on a tax audit and the defensibility of the assessment.',
                     'Proceedings remain pending; the team secured interim relief.'):
            self.assertEqual(submission_voice_paths({'b10':text,'matters':[{'text':text}]}),[])

    def test_voice_repair_retaining_commentary_does_not_pass(self):
        proposal=copy.deepcopy(DEV);proposal['matters'][0]['text']='The verified evidentiary record demonstrates success.'
        repair={'corrections':[{'path':'matters/0/text','value':'Our analysis indicates success.','reason':'Changed wording'}],'unresolved':[]}
        with patch('core.review_graph.invoke_role',return_value=(repair,[])):
            result=develop({'package':PACKAGE,'strategy':STRATEGY,'development':proposal,'development_reusable':True})
        self.assertFalse(result['development_validated'])

    def test_semantic_repair_locates_one_field_and_preserves_rest(self):
        proposal=copy.deepcopy(DEV)
        proposal['matters'][0]['text']='The team negotiated.'
        defects=[{'severity':'critical','owner':'rankpilot','code':'EDITORIAL_OMISSION','matter_id':'m1','message':'Omitted strike prevention and exposure reduction.'}]
        plan={'locations':[{'path':'matters/0/text','defect_index':0,'reason':'Restore documented results in this matter.'}],'unresolved':[]}
        fix={'corrections':[{'path':'matters/0/text','value':DEV['matters'][0]['text'],'reason':'Restore source-backed outcomes.'}],'unresolved':[]}
        with patch('core.review_graph.invoke_role',side_effect=[(plan,[]),(fix,[])]) as model:
            result=develop({'package':PACKAGE,'strategy':STRATEGY,'development':proposal,'development_reusable':True,'repair_feedback':defects})
        self.assertEqual(result['development'],DEV);self.assertTrue(result['development_validated'])
        self.assertEqual([call.args[1] for call in model.call_args_list],['repair','repair'])
        self.assertEqual(result['repair_report']['corrected_paths'],['matters/0/text'])

    def test_unlocatable_semantic_defect_does_not_trigger_full_regeneration(self):
        defects=[{'severity':'critical','owner':'rankpilot','code':'EDITORIAL_OMISSION','message':'Acceptance check missing.'}]
        with patch('core.review_graph.invoke_role',return_value=({'locations':[],'unresolved':['No concrete omitted fact identified.']},[])) as model:
            result=develop({'package':PACKAGE,'strategy':STRATEGY,'development':DEV,'development_reusable':True,'repair_feedback':defects})
        self.assertFalse(result['development_validated']);self.assertEqual(result['development'],DEV)
        model.assert_called_once();self.assertEqual(model.call_args.args[1],'repair')

    def test_audit_delta_preserves_other_sections_and_submission(self):
        from core.editorial_repair import repair_letter
        letter={'executive_assessment':'Incorrect diagnostic.','portfolio':'Ordered source-backed portfolio.','leadership':'Source-backed candidates.','evidence_gaps':'Meaningful reserves.','next_steps':'No se identifican acciones adicionales con la información disponible.','next_actions':[]}
        state={'package':PACKAGE,'strategy':STRATEGY,'development':DEV,'letter':letter,'repair_feedback':[{'scope':'letter','message':'Withdraw incorrect diagnostic.'}]}
        response={'corrections':[{'path':'executive_assessment','value':'Qualified strategic recommendation.','reason':'The original source supports the B10 figures.'}],'unresolved':[]}
        with patch('core.review_graph.invoke_role',return_value=(response,[])):
            result=repair_letter(state)
        self.assertTrue(result['writer_validated'])
        for field in ('portfolio','leadership','evidence_gaps','next_steps','next_actions'):self.assertEqual(result['letter'][field],letter[field])
        self.assertEqual(state['development'],DEV);self.assertEqual(state['letter'],letter)
        self.assertEqual(result['letter_repair_report']['corrected_fields'],['executive_assessment'])

    def test_mixed_scope_defects_do_not_send_audit_issue_to_submission_locator(self):
        proposal=copy.deepcopy(DEV)
        proposal['matters'][0]['text']='The team negotiated.'
        submission={'severity':'critical','owner':'rankpilot','scope':'submission','code':'EDITORIAL_OMISSION','message':'Restore supported outcome.'}
        letter={'severity':'critical','owner':'rankpilot','scope':'letter','code':'UNSUPPORTED_CLAIM','message':'Core matter incorrectly described as reserve.'}
        plan={'locations':[{'path':'matters/0/text','defect_index':0,'reason':'Restore the omitted outcome.'}],'unresolved':[]}
        fix={'corrections':[{'path':'matters/0/text','value':DEV['matters'][0]['text'],'reason':'Restore source-backed result.'}],'unresolved':[]}
        state={'package':PACKAGE,'strategy':STRATEGY,'development':proposal,'development_reusable':True,'repair_feedback':[submission,letter]}
        with patch('core.review_graph.invoke_role',side_effect=[(plan,[]),(fix,[])]) as model:
            result=develop(state)
        self.assertTrue(result['development_validated'])
        self.assertEqual(model.call_args_list[0].args[4]['defects'],[submission])
        self.assertEqual(state['repair_feedback'],[submission,letter])

class NoOpRepairTests(unittest.TestCase):
    def test_unchanged_development_cannot_claim_correction(self):
        proposal={'b10':'Same generated text'}
        targets={'b10':{'current_value':proposal['b10']}}
        with self.assertRaisesRegex(ValueError,'unchanged'):
            apply_corrections(proposal,targets,{'corrections':[{'path':'b10','value':proposal['b10'],'reason':'Claimed fix'}]})
        with self.assertRaisesRegex(ValueError,'unchanged'):
            apply_corrections(proposal,targets,{'corrections':[]})
    def test_unchanged_audit_with_critical_letter_feedback_is_rejected(self):
        from core.editorial_repair import repair_letter
        letter={k:'Unchanged text.' for k in ['executive_assessment','portfolio','leadership','evidence_gaps','next_steps']}
        state={'package':{'matters':[]},'strategy':{'matters':[]},'letter':letter,'repair_feedback':[{'scope':'letter','severity':'critical','message':'Incorrect classification.'}]}
        with patch('core.review_graph.invoke_role',return_value=({'corrections':[],'unresolved':[]},[])):
            result=repair_letter(state)
        self.assertFalse(result['writer_validated'])

class AuditResponsibilityTests(unittest.TestCase):
    def state(self):
        return {'package':{'matters':[]},'strategy':{'matters':[]},'letter':{**{k:'Source-backed text.' for k in ('executive_assessment','portfolio','leadership','evidence_gaps')},'next_steps':'No se identifican acciones adicionales con la información disponible.','next_actions':[]}}

    def test_unanswered_source_question_is_context_not_a_required_generated_change(self):
        from core.editorial_repair import repair_letter
        state=self.state()
        question={'scope':'letter','severity':'critical','owner':'user','code':'SOURCE_CONFLICT','message':'Two original records state different amounts.'}
        state['repair_feedback']=[question]
        with patch('core.review_graph.invoke_role',return_value=({'corrections':[],'unresolved':[]},[])) as model:
            result=repair_letter(state)
        self.assertTrue(result['writer_validated'])
        self.assertEqual(model.call_args.args[4]['defects'],[])
        self.assertEqual(model.call_args.args[4]['source_questions'],[question])
        self.assertEqual(result['repair_feedback'],[question])
        self.assertEqual(result['letter']['evidence_gaps'],state['letter']['evidence_gaps'])

    def test_audit_schema_binds_each_field_to_its_actual_value_type(self):
        from core.editorial_repair import repair_letter
        from pydantic import ValidationError
        state=self.state();state['repair_feedback']=[]
        with patch('core.review_graph.invoke_role',return_value=({'corrections':[],'unresolved':[]},[])) as model:
            repair_letter(state)
        schema=model.call_args.args[2]
        for field,value in [('portfolio',[]),('next_actions','Not an action list')]:
            with self.subTest(field=field),self.assertRaises(ValidationError):
                schema.model_validate({'corrections':[{'path':field,'value':value,'reason':'Invalid shape'}],'unresolved':[]})
        schema.model_validate({'corrections':[{'path':'portfolio','value':'Supported comparison.','reason':'Correction'},{'path':'next_actions','value':[],'reason':'Resolved actions'}],'unresolved':[]})

    def test_shared_repair_evidence_is_sent_once_without_changing_distinct_sources(self):
        from core.editorial_repair import repair_development
        shared={'package':PACKAGE,'strategy':STRATEGY}
        targets={key:{'current_value':DEV[key],'source_evidence':copy.deepcopy(shared)} for key in ('b10','c2')}
        targets['matters/0/text']={'current_value':DEV['matters'][0]['text'],'source_evidence':{'package':{'other':'Different source'},'strategy':STRATEGY}}
        before=copy.deepcopy(targets)
        with patch('core.review_graph.invoke_role',return_value=({'corrections':[],'unresolved':['Fixture has no repair']},[])) as model:
            repair_development({'package':PACKAGE,'strategy':STRATEGY},DEV,targets)
        payload=model.call_args.args[4]
        self.assertEqual(payload['shared_source_evidence'],shared)
        for key in ('b10','c2'):self.assertEqual(payload['repair_targets'][key]['source_evidence'],{'reference':'shared_source_evidence'})
        self.assertEqual(payload['repair_targets']['matters/0/text'],before['matters/0/text'])
        self.assertEqual(targets,before)

    def test_warning_sector_containment_still_runs_the_automatic_repair(self):
        state={'package':PACKAGE,'strategy':STRATEGY,'development':DEV,'development_reusable':True,'repair_feedback':[{'severity':'warning','owner':'rankpilot','scope':'submission','code':'SOURCE_CONFLICT','field_path':'client_sector','artifact_quote':'Disputed optional sector','conflicting_artifact_term':'sector','conflict_resolution':'omit_nonessential_descriptor'}]}
        with patch('core.editorial_repair.repair_rejected_development',return_value={'development_validated':False}) as locator:
            result=develop(state)
        locator.assert_called_once()
        self.assertFalse(result['development_validated'])

    def test_submission_repairs_are_context_not_audit_field_tasks(self):
        from core.editorial_repair import repair_letter
        state=self.state()
        defect={'scope':'submission','severity':'critical','owner':'rankpilot','code':'UNSUPPORTED_CLAIM','field_path':'filing_details.heads','message':'Withdraw unsupported head title from Submission.'}
        state['repair_feedback']=[defect]
        with patch('core.review_graph.invoke_role',return_value=({'corrections':[],'unresolved':[]},[])) as model:
            result=repair_letter(state)
        self.assertTrue(result['writer_validated'])
        self.assertEqual(model.call_args.args[4]['defects'],[])
        self.assertEqual(model.call_args.args[4]['submission_review_context'],[defect])
        self.assertEqual(result['repair_feedback'],[defect])
