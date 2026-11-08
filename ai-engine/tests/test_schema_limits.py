import unittest
from unittest.mock import patch
from pydantic import BaseModel,create_model,Field
from typing import Literal
from openai.lib._pydantic import to_strict_json_schema
from core.editorial_case import execution_verdict_contract
from core.review_graph import Verdict,invoke_role,EditorialResponseError
from utils.schema_limits import schema_metrics,validate_schema_limits
from utils.provider_errors import provider_failure
from test_personal_quality_contract import complete_case

class SerializedSchemaLimitsTests(unittest.TestCase):
    def test_all_serialized_enums_are_counted_not_just_top_level_definitions(self):
        schema={'$defs':{'Proof':{'properties':{'status':{'enum':['met','failed']},'ref':{'enum':['A','B','C']}}},'Other':{'enum':['A','B','C']}}}
        self.assertEqual(schema_metrics(schema)['enum_values'],8)
        with self.assertRaises(ValueError):validate_schema_limits({'properties':{'big':{'enum':list(range(1001))}}})
        with self.assertRaises(ValueError):validate_schema_limits({'properties':{'big':{'enum':[str(n)+'x'*60 for n in range(251)]}}})

    def test_compact_reference_properties_reuse_enum_defs_after_sdk_serialization(self):
        p,s,v=complete_case();letter={'leadership':'Sofia led these three documented contributions.','evidence_gaps':'The reserve adds preventive work.'}
        schema=execution_verdict_contract(p,s,v,letter,Verdict,compact=True,source_refs=True)
        strict=to_strict_json_schema(schema);validate_schema_limits(strict)
        proofs=[value for key,value in strict['$defs'].items() if key.startswith('Proof_')]
        self.assertTrue(proofs)
        for proof in proofs:
            for field in ('status','artifact_ref','source_ref'):
                self.assertEqual(set(proof['properties'][field]),{'$ref'})

    def test_oversized_schema_stops_before_model_creation_and_cannot_buy_a_whole_retry(self):
        schema=create_model('Oversized',choice=(Literal[tuple(str(i) for i in range(1001))],...))
        with patch('core.review_graph.create_chat_model') as factory:
            with self.assertRaises(EditorialResponseError) as caught:invoke_role({'trace':[{'usage':{'total_tokens':7}}]},'editor',schema,'Review',{})
        factory.assert_not_called();self.assertFalse(provider_failure(caught.exception)['retryable'])
        self.assertEqual(caught.exception.trace_history,[{'usage':{'total_tokens':7}}])
