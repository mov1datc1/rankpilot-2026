import copy,json,unittest
from unittest.mock import patch
from pydantic import ValidationError
from openai.lib._pydantic import to_strict_json_schema
from core.editorial_case import execution_verdict_contract,execution_quote_catalog,project_execution_checks,execution_defects
from core.review_graph import Verdict,editor
import test_execution_quote_contract as legacy

class CompactExecutionProofTests(unittest.TestCase):
    def fixture(self):
        helper=legacy.ExecutionQuoteContractTests();p,s,v,l=helper.setup_case()
        literal=helper.response(p,s,v,l);catalog=execution_quote_catalog(p,s,v,l)
        compact=copy.deepcopy(literal)
        for key,check in compact['case_checks'].items():
            quote=check.pop('artifact_quote');check['artifact_ref']=next(ref for ref,text in catalog[key].items() if text==quote)
        return p,s,v,l,literal,compact,catalog

    def test_transport_roundtrip_keeps_identical_literal_proofs_and_validation(self):
        p,s,v,l,literal,compact,catalog=self.fixture()
        schema=execution_verdict_contract(p,s,v,l,Verdict,compact=True)
        for mode in ('python','json'):
            projected=project_execution_checks(schema.model_validate(compact).model_dump(mode=mode),catalog)
            self.assertEqual(projected,project_execution_checks(literal))
            self.assertEqual(execution_defects(p,s,v,l,projected['case_checks']),[])
        strict=to_strict_json_schema(schema)
        self.assertIn('Sofia led the negotiations.',json.dumps(strict))
        self.assertNotIn('Sofia led the negotiations.',json.dumps(compact))

    def test_reference_is_bound_to_own_field_and_exact_current_bytes(self):
        p,s,v,l,_,compact,catalog=self.fixture();schema=execution_verdict_contract(p,s,v,l,Verdict,compact=True)
        bad=copy.deepcopy(compact);key='argument:0:b10'
        foreign=next(ref for k,refs in catalog.items() if k!=key for ref in refs if ref not in catalog[key])
        bad['case_checks'][key]['artifact_ref']=foreign
        with self.assertRaises(ValidationError):schema.model_validate(bad)
        with self.assertRaisesRegex(ValueError,'foreign output'):project_execution_checks(bad,catalog)
        with self.assertRaisesRegex(ValueError,'foreign output'):project_execution_checks(compact)
        stale=copy.deepcopy(catalog);stale[key]={}
        with self.assertRaisesRegex(ValueError,'foreign output'):project_execution_checks(compact,stale)

    def test_failed_status_and_source_validation_are_not_relaxed(self):
        p,s,v,l,_,compact,catalog=self.fixture();schema=execution_verdict_contract(p,s,v,l,Verdict,compact=True)
        compact['case_checks']['argument:0:b10']['status']='failed'
        projected=project_execution_checks(schema.model_validate(compact).model_dump(),catalog)
        self.assertTrue(any(d['severity']=='critical' for d in execution_defects(p,s,v,l,projected['case_checks'])))
        compact['case_checks']['argument:0:b10']['source_quote']='Wrong original source'
        projected=project_execution_checks(schema.model_validate(compact).model_dump(),catalog)
        with self.assertRaisesRegex(ValueError,'source evidence'):execution_defects(p,s,v,l,projected['case_checks'])

    def test_all_obligations_remain_mandatory_and_diagnostics_are_bounded(self):
        p,s,v,l,_,compact,_=self.fixture();schema=execution_verdict_contract(p,s,v,l,Verdict,compact=True)
        bad=copy.deepcopy(compact);bad['case_checks'].pop(next(iter(bad['case_checks'])))
        with self.assertRaises(ValidationError):schema.model_validate(bad)
        for field in ('source_quote','reason'):
            bad=copy.deepcopy(compact);next(iter(bad['case_checks'].values()))[field]='a'*401
            with self.assertRaises(ValidationError):schema.model_validate(bad)

    def test_editor_uses_compact_schema_then_validates_restored_full_proofs(self):
        p,s,v,l,_,compact,_=self.fixture()
        def invoke(state,role,schema,instruction,payload):
            self.assertEqual(role,'editor');self.assertIn('artifact_ref',instruction)
            return schema.model_validate(compact).model_dump(),[]
        with patch('core.review_graph.invoke_role',side_effect=invoke):
            result=editor({'package':p,'strategy':s,'development':v,'letter':l})
        self.assertEqual(result['judge']['case_checks'][0]['artifact_quote'],v['b10'])
        self.assertEqual(execution_defects(p,s,v,l,result['judge']['case_checks']),[])
        self.assertFalse(result['judge']['passed'])  # Missing independent acceptance still blocks release.
