import copy,json,unittest
from pydantic import ValidationError
from openai.lib._pydantic import to_strict_json_schema
from core.editorial_case import (execution_source_catalog,execution_quote_catalog,
    execution_verdict_contract,project_execution_checks,execution_defects)
from core.review_graph import Verdict,editor,EditorialResponseError
from unittest.mock import patch
import test_execution_quote_contract as legacy

class SourceReferenceProofTests(unittest.TestCase):
    def fixture(self):
        helper=legacy.ExecutionQuoteContractTests();p,s,v,l=helper.setup_case()
        literal=helper.response(p,s,v,l)
        output=execution_quote_catalog(p,s,v,l);sources=execution_source_catalog(p,s,v)
        reply=copy.deepcopy(literal)
        for key,check in reply['case_checks'].items():
            q=check.pop('artifact_quote');check['artifact_ref']=next(r for r,t in output[key].items() if t==q)
            check.pop('source_quote');check['source_ref']=next(iter(sources[key]))
        return p,s,v,l,reply,output,sources

    def test_native_contract_restores_both_literals_before_existing_validation(self):
        p,s,v,l,reply,out,src=self.fixture()
        schema=execution_verdict_contract(p,s,v,l,Verdict,compact=True,source_refs=True)
        for mode in ('python','json'):
            result=project_execution_checks(schema.model_validate(reply).model_dump(mode=mode),out,src)
            self.assertEqual(execution_defects(p,s,v,l,result['case_checks']),[])
            for c in result['case_checks']:
                self.assertNotIn('source_ref',c)
                self.assertIn(c['source_quote'],src[c['obligation_id']].values())
        strict=json.dumps(to_strict_json_schema(schema))
        self.assertIn('source_ref',strict);self.assertIn('prevented a strike',strict)

    def test_foreign_stale_and_dual_source_references_fail_closed(self):
        p,s,v,l,reply,out,src=self.fixture();key=next(iter(src))
        for catalog in (None,{**src,key:{}}):
            with self.assertRaisesRegex(ValueError,'foreign source'):project_execution_checks(reply,out,catalog)
        bad=copy.deepcopy(reply);bad['case_checks'][key]['source_quote']='invented'
        with self.assertRaisesRegex(ValueError,'foreign source'):project_execution_checks(bad,out,src)
        p['matters'].append({'id':'foreign','source_excerpt':'Foreign lawyer achieved a different result.'})
        v['comparisons'].append({'selected_id':'foreign','alternative_id':'foreign','audit_required':False,'tradeoff':'Internal comparison'})
        foreign=execution_source_catalog(p,s,v)['comparison:1']
        bad=copy.deepcopy(reply);bad['case_checks'][key]['source_ref']=next(iter(foreign))
        schema=execution_verdict_contract(p,s,v,l,Verdict,compact=True,source_refs=True)
        with self.assertRaises(ValidationError):schema.model_validate(bad)
        with self.assertRaisesRegex(ValueError,'foreign source'):project_execution_checks(bad,out,src)

    def test_original_article_cannot_be_rewritten_by_citation_transport(self):
        p,s,v,l,reply,out,src=self.fixture()
        original="The Collegiate Court granted constitutional relief and restored the client's defence."
        p['matters'][0]={'id':'m1','source_excerpt':original}
        src=execution_source_catalog(p,s,v);key='argument:0:b10'
        self.assertIn(original,src[key].values())
        self.assertFalse(any(q.startswith('A Collegiate') for q in src[key].values()))
        reply['case_checks'][key]['source_ref']=next(ref for ref,q in src[key].items() if q==original)
        projected=project_execution_checks(reply,out,{**execution_source_catalog(*self.fixture()[:3]),key:src[key]})
        self.assertEqual(projected['case_checks'][0]['source_quote'],original)

    def test_selected_passage_does_not_turn_failed_semantic_judgment_into_pass(self):
        p,s,v,l,reply,out,src=self.fixture();key=next(iter(src))
        reply['case_checks'][key]['status']='failed'
        result=project_execution_checks(reply,out,src)
        defects=execution_defects(p,s,v,l,result['case_checks'])
        self.assertEqual(len(defects),1);self.assertEqual(defects[0]['severity'],'critical')

    def test_missing_source_fails_preflight_before_provider(self):
        p,s,v,l,*_=self.fixture();p['matters'][0]={'id':'m1'}
        with patch('core.review_graph.invoke_role') as invoke:
            with self.assertRaisesRegex(EditorialResponseError,'own source passage absent'):
                editor({'package':p,'strategy':s,'development':v,'letter':l})
        invoke.assert_not_called()

    def test_long_and_confirmed_head_sources_remain_own_literal_spans(self):
        p,s,v,l,*_=self.fixture();original=('word '*160).strip()
        p['matters'][0]={'id':'m1','source_excerpt':original}
        p['filing_details']={'heads':[{'name':'Sofia Vega'}]}
        catalog=execution_source_catalog(p,s,v)
        self.assertEqual(list(catalog['head:0:b9'].values()),['Sofia Vega'])
        for q in catalog['argument:0:b10'].values():
            self.assertLessEqual(len(q),360);self.assertIn(q,original)
