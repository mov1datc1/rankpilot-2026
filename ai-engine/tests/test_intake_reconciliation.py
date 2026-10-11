import unittest
from unittest.mock import Mock, patch
from utils.source_scope import source_scope, validate_draft_directory
from utils.document_preflight import SourceError
from utils.filing_extraction import extract_filing_fields
from utils.filing_reconciliation import FilingRead, reconcile_filing

class IntakeReconciliationTests(unittest.TestCase):
    def test_template_ownership_not_ranking_mentions(self):
        text='Please contact researchreports@legal500.com for further information.\nOur partners are ranked in Chambers.'
        self.assertEqual(source_scope(text)['directory']['value'],'Legal 500')
        with self.assertRaises(SourceError) as caught:validate_draft_directory(text,'Chambers & Partners')
        self.assertEqual(caught.exception.code,'SOURCE_DIRECTORY_MISMATCH')
        validate_draft_directory(text,'The Legal 500')
        with self.assertRaises(SourceError):validate_draft_directory('Our partners are ranked in Chambers.','Chambers')

    def test_semantic_read_rejects_invented_counts_and_quotes(self):
        text='B2 Number of partners in the department\nAna River\nJuan Sol\nB3 Number of other qualified lawyers\n9\n'
        findings=[{'field':'numPartners','number_value':2,'counted_names':['Ana River','Juan Sol'],'source_quote':text.split('B3')[0]}, {'field':'numLawyers','number_value':700,'source_quote':text}, {'field':'departmentName','text_value':'Invented','source_quote':'Invented'}]
        model=Mock();model.with_structured_output.return_value.invoke.return_value={'parsed':FilingRead(findings=findings),'raw':Mock(usage_metadata={'total_tokens':100})}
        with patch('utils.model_factory.create_chat_model',return_value=model):
            result=reconcile_filing(text,extract_filing_fields(text))
        self.assertEqual(result['filing_details']['numPartners'],2)
        self.assertEqual(result['filing_details']['numLawyers'],9)
        self.assertEqual(result['filing_reconciliation']['rejected_fields'],['departmentName','numLawyers'])
        self.assertIn(text,model.with_structured_output.return_value.invoke.call_args.args[0][1][1])

    def test_incomplete_semantic_response_is_not_success(self):
        model=Mock();model.with_structured_output.return_value.invoke.return_value={'parsed':None,'parsing_error':ValueError()}
        with patch('utils.model_factory.create_chat_model',return_value=model),self.assertRaises(ValueError):reconcile_filing('Source',extract_filing_fields('Source'))

    def test_endpoint_rejects_other_directory_before_extraction(self):
        import asyncio,json
        from unittest.mock import AsyncMock
        from main import extract_document_endpoint
        payload={'text':'Please contact researchreports@legal500.com for further information.','context':{'modality':'draft','directory':'Chambers & Partners','reconcile_filing':True}}
        request=Mock();request.json=AsyncMock(return_value=payload)
        with patch('main._extract_readable_source',new_callable=AsyncMock) as extraction:
            response=asyncio.run(extract_document_endpoint(request))
        self.assertEqual(response.status_code,422)
        self.assertEqual(json.loads(response.body)['source_errors'][0]['code'],'SOURCE_DIRECTORY_MISMATCH')
        extraction.assert_not_called()

    def test_numbered_form_calls_reconciler_and_preserves_literal_matters(self):
        import asyncio,json
        from main import _extract_readable_source
        text='B1 Department name\nTax\nPublishable Matter 1\nD1 Name of client\nExample Client\nD2 Summary of matter\nAdvised on a tax appeal.\nD3 Matter value\n100 USD\n'
        baseline=json.loads(asyncio.run(_extract_readable_source(text,{})).body)
        def review(source,filing):
            self.assertIn('Example Client',source)
            return {**filing,'filing_reconciliation':{'status':'reviewed'}}
        with patch('utils.filing_reconciliation.reconcile_filing',side_effect=review) as reconciler:
            response=asyncio.run(_extract_readable_source(text,{'reconcile_filing':True}))
        result=json.loads(response.body)
        self.assertEqual(response.status_code,200)
        self.assertEqual(result['matters'],baseline['matters'])
        self.assertEqual(result['filing_reconciliation']['status'],'reviewed')
        reconciler.assert_called_once()
        with patch('utils.filing_reconciliation.reconcile_filing',side_effect=RuntimeError('test')):
            failed=asyncio.run(_extract_readable_source(text,{'reconcile_filing':True}))
        self.assertEqual(failed.status_code,502)
        self.assertEqual(json.loads(failed.body)['code'],'FILING_RECONCILIATION_UNAVAILABLE')
