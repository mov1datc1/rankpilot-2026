import asyncio
import json
import unittest
from unittest.mock import Mock, patch
from agents.nodes import extraction_node

class IngestionContractTests(unittest.TestCase):
    def test_unknown_count_is_not_zero_or_arithmetic_error(self):
        chain = Mock()
        chain.invoke.return_value = {'metadata':{}, 'matters':[], 'lawyers':[], 'department':{}}
        with patch('agents.nodes.get_extraction_chain', return_value=chain):
            result = extraction_node({'doc_text':'Unstructured notes.', 'messages':[], 'pipeline_manifest':{'document':{'source_matters':{'total':None, 'count_status':'unknown'}}}})
        self.assertIn('count is unavailable', chain.invoke.call_args.args[0]['text'])
        self.assertIsNone(result['pipeline_manifest']['extraction']['source_matter_count'])
        self.assertIsNone(result['pipeline_manifest']['extraction']['over_extraction_count'])
        self.assertFalse(result['pipeline_manifest']['extraction']['match'])

    def test_provider_failure_has_explicit_error(self):
        with patch('agents.nodes.get_extraction_chain', side_effect=RuntimeError('Injected failure')):
            result = extraction_node({'doc_text':'Legal notes', 'messages':[]})
        self.assertEqual(result['extraction_error'], 'EXTRACTION_PROVIDER_ERROR')

    def test_schema_does_not_default_to_public(self):
        from core.schema import Matter
        m = Matter(title='Case',client='Synthetic',summary='Advice',significance='',lead_partner='',is_cross_border=False)
        self.assertEqual(m.publish_status, 'confirmation_required')

    def test_negative_editorial_verdict_exhausts_retry_budget(self):
        from agents.constitutional_validator import constitutional_validation_node
        verdict={'passed':False,'score':6,'retry_scopes':['matters'],'retry_matter_ids':['m1']}
        with patch('agents.constitutional_validator.run_layer1_checks',return_value=(True,[])), patch('utils.model_factory.create_chat_model',return_value=object()), patch('agents.constitutional_validator.run_layer2_checks',return_value=(False,['Unsubstantiated outcome'],'optimization',verdict)):
            first=constitutional_validation_node({'constitutional_retry_count':0})
            exhausted=constitutional_validation_node({'constitutional_retry_count':2})
        self.assertEqual(first['constitutional_route'],'optimization')
        self.assertFalse(first['constitutional_validation']['passed'])
        self.assertEqual(exhausted['constitutional_route'],'blocked')
        self.assertFalse(exhausted['release_verdict']['passed'])
