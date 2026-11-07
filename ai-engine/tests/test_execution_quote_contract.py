import copy,json,unittest
from pydantic import ValidationError
from openai.lib._pydantic import to_strict_json_schema
from core.editorial_case import execution_verdict_contract,project_execution_checks,execution_defects,obligations
from core.review_graph import Verdict,editor,EditorialResponseError
from test_editorial_case import fixture
from unittest.mock import patch

class ExecutionQuoteContractTests(unittest.TestCase):
    def setup_case(self):
        p,s,v=fixture();v['version']='editorial-development-v3'
        letter={'leadership':'**Sofia led the negotiations.**','evidence_gaps':'Routine advice adds no distinct capability.'}
        p['rendered_artifact']=v['b10']+'\n'+v['c2']+'\n'+v['candidates'][0]['submission_bio']
        p['rendered_audit']='Sofia led the negotiations.\nRoutine advice adds no distinct capability.'
        return p,s,v,letter
    def response(self,p,s,v,letter):
        result={'passed':True,'defects':[],'acceptance':[],'register_checks':[],'case_checks':{}}
        for o in obligations(p,s,v):
            field=o['field'];value=letter[field].replace('**','') if field in letter else v['b10'] if field=='b10' else v['c2'] if field=='c2' else v['candidates'][0]['submission_bio']
            result['case_checks'][o['id']]={'status':'met','artifact_quote':value,'source_quote':'prevented a strike','reason':'Source and execution agree.'}
        return result
    def test_schema_requires_all_proofs_and_binds_each_quote_before_generation(self):
        p,s,v,l=self.setup_case();schema=execution_verdict_contract(p,s,v,l,Verdict);response=self.response(p,s,v,l)
        parsed=schema.model_validate(response).model_dump(mode='json');projected=project_execution_checks(parsed)
        self.assertEqual(execution_defects(p,s,v,l,projected['case_checks']),[])
        strict=to_strict_json_schema(schema);defs=strict['$defs'];quotes=[d['enum'] for d in defs.values() if d.get('type')=='string' and 'enum'in d]
        self.assertTrue(any('Sofia led the negotiations.' in q for q in quotes))
        self.assertFalse(any('**Sofia led the negotiations.**' in q for q in quotes))
        key=next(iter(response['case_checks']));del response['case_checks'][key]
        with self.assertRaises(ValidationError):schema.model_validate(response)
    def test_quote_from_another_output_field_is_not_a_valid_response(self):
        p,s,v,l=self.setup_case();schema=execution_verdict_contract(p,s,v,l,Verdict);r=self.response(p,s,v,l)
        r['case_checks']['argument:0:b10']['artifact_quote']=v['c2']
        with self.assertRaises(ValidationError):schema.model_validate(r)
    def test_python_mode_dump_keeps_literal_quotes_in_saved_proofs(self):
        p,s,v,l=self.setup_case();schema=execution_verdict_contract(p,s,v,l,Verdict)
        response=self.response(p,s,v,l)
        parsed=schema.model_validate(response).model_dump()
        projected=project_execution_checks(parsed)
        for check in projected['case_checks']:
            expected=response['case_checks'][check['obligation_id']]['artifact_quote']
            self.assertEqual(check['artifact_quote'],expected)
            self.assertEqual(type(check['artifact_quote']),str)
        self.assertEqual(execution_defects(p,s,v,l,projected['case_checks']),[])
    def test_formatting_is_not_factual_normalisation(self):
        p,s,v,l=self.setup_case();r=project_execution_checks(self.response(p,s,v,l));r['case_checks'][0]['artifact_quote']='Different factual words'
        with self.assertRaisesRegex(ValueError,'expected field'):execution_defects(p,s,v,l,r['case_checks'])
    def test_missing_exact_output_fails_before_another_paid_review(self):
        p,s,v,l=self.setup_case();p['rendered_artifact']='A stale file.'
        with patch('core.review_graph.invoke_role') as model:
            with self.assertRaisesRegex(EditorialResponseError,'expected output field absent'):editor({'package':p,'strategy':s,'development':v,'letter':l})
        model.assert_not_called()
    def test_internal_comparison_quote_cannot_be_replaced_with_audit_summary(self):
        p,s,v,l=self.setup_case();v['comparisons'].append({**v['comparisons'][0],'audit_required':False,'tradeoff':'Specific internal source-based comparison.'})
        schema=execution_verdict_contract(p,s,v,l,Verdict)
        field=next(o for o in obligations(p,s,v) if o['id']=='comparison:1')
        self.assertEqual(field['output_scope'],'internal')
        check=schema.model_fields['case_checks'].annotation.model_fields['comparison:1'].annotation
        with self.assertRaises(ValidationError):check.model_validate({'status':'met','artifact_quote':l['evidence_gaps'],'source_quote':'prevented a strike','reason':'Unrelated field'})
        check.model_validate({'status':'met','artifact_quote':'Specific internal source-based comparison.','source_quote':'prevented a strike','reason':'Own internal comparison'})
    def test_unknown_obligation_cannot_be_substituted_for_required_proof(self):
        p,s,v,l=self.setup_case();schema=execution_verdict_contract(p,s,v,l,Verdict);r=self.response(p,s,v,l)
        r['case_checks']['invented']=copy.deepcopy(next(iter(r['case_checks'].values())))
        with self.assertRaises(ValidationError):schema.model_validate(r)

    def test_legacy_contract_is_unchanged(self):
        self.assertIs(execution_verdict_contract({}, {}, {'version':'editorial-development-v2'}, {}, Verdict),Verdict)

    def test_confirmed_head_proof_uses_the_actual_input_entry_not_invented_form_labels(self):
        p,s,v,l=self.setup_case();p['filing_details']={'heads':[{'name':'Sofia Vega'}]}
        schema=execution_verdict_contract(p,s,v,l,Verdict);r=self.response(p,s,v,l)
        proof=r['case_checks']['head:0:b9']
        proof.update(status='failed',source_quote='B7 Head or Heads of department\nName\nSofia Vega',
            reason='The bio omits the separately confirmed department-head function.')
        with self.assertRaises(ValidationError):schema.model_validate(r)
        proof['source_quote']='Luis Prado'
        with self.assertRaises(ValidationError):schema.model_validate(r)
        proof['source_quote']='Sofia Vega'
        parsed=project_execution_checks(schema.model_validate(r).model_dump())
        defects=execution_defects(p,s,v,l,parsed['case_checks'])
        self.assertEqual(len(defects),1)
        self.assertEqual(defects[0]['field_path'],'candidates/0/submission_bio')
        self.assertEqual(defects[0]['severity'],'critical')
        self.assertEqual(defects[0]['source_quote'],'Sofia Vega')
        self.assertNotIn('Head',v['candidates'][0]['submission_bio'])

    def test_head_constraint_does_not_expand_other_obligations_source_scope(self):
        p,s,v,l=self.setup_case();p['filing_details']={'heads':[{'name':'Sofia Vega'}]}
        schema=execution_verdict_contract(p,s,v,l,Verdict);r=self.response(p,s,v,l)
        r['case_checks']['head:0:b9']['source_quote']='Sofia Vega'
        r['case_checks']['argument:0:b10']['source_quote']='A claim from another matter'
        parsed=project_execution_checks(schema.model_validate(r).model_dump(mode='json'))
        with self.assertRaisesRegex(ValueError,'source evidence.*argument:b10'):
            execution_defects(p,s,v,l,parsed['case_checks'])
