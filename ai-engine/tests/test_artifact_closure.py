import asyncio
import copy
import json
import unittest
from unittest.mock import patch

from core.editorial_development import sanitize_narrative_voice, sanitize_completion_status, submission_voice_paths
from core.review_graph import review_rendered_package, register_gate


class ArtifactClosureTest(unittest.TestCase):
    def test_rejected_pair_does_not_buy_auxiliary_clause_review(self):
        from core.review_graph import editor
        finding={'code':'UNSUPPORTED_CLAIM','severity':'critical','scope':'submission',
                 'matter_id':None,'message':'Unsupported outcome.','artifact_quote':'Won.'}
        with patch('core.review_graph.invoke_role',return_value=({'passed':False,'defects':[finding]},[])), \
             patch('core.portfolio_consistency.verify_portfolio_consistency') as auxiliary:
            result=editor({'package':{},'strategy':{},'letter':{}})
        auxiliary.assert_not_called()
        self.assertFalse(result['judge']['passed'])

    def test_provider_schema_requires_each_original_register_row(self):
        from core.register_review import register_verdict_contract
        from core.review_graph import Verdict
        from openai.lib._pydantic import to_strict_json_schema
        from pydantic import ValidationError
        package={'rendered_artifact':'Exact document','matters':[
            {'id':key,'confidentialityEvidence':{'client_register':[{'quote':'Original industry'}]}}
            for key in ('original-one','original-two')]}
        model=register_verdict_contract(package,Verdict)
        schema=to_strict_json_schema(model)
        checks=schema['$defs']['RequiredRegisterComparisons']
        self.assertEqual(set(checks['required']),{'original-one','original-two'})
        self.assertEqual(checks['properties']['original-one'], checks['properties']['original-two'])
        comparison={'relationship':'consistent','rationale':'Same sector.'}
        verdict={'passed':True,'defects':[],'acceptance':[],
                 'register_checks':{'original-one':comparison,'original-two':comparison}}
        self.assertEqual(len(model.model_validate(verdict).register_checks.model_dump()),2)
        del verdict['register_checks']['original-two']
        with self.assertRaises(ValidationError):model.model_validate(verdict)
        self.assertIs(register_verdict_contract({},Verdict),Verdict)

    def test_formatting_never_changes_legal_meaning(self):
        for value in ('The firm revoked the four suspensions.',
                      'José Alberto Díaz Méndez is identified as lead partner.',
                      'The supplied status is ongoing and does not establish a final merits result.',
                      'ACME, S.A. DE C.V. In 2025, proceedings resumed.'):
            self.assertEqual(sanitize_narrative_voice(value), value)
            self.assertEqual(sanitize_completion_status(value), value)

    def test_detector_preserves_legal_audits_and_catches_editorial_faults(self):
        for text in ('The record separately lists a header amount.',
                     'The mandate is ongoing and no final outcome is stated.',
                     'CONSERVATION, A.C. Is the client.',
                     'Awaiting determination.José Pablo leads.'):
            self.assertEqual(submission_voice_paths({'matters':[{'text':text}]}), ['matters/0/text'])
        self.assertEqual(submission_voice_paths({'b10':'The team audited payroll and presented evidence.'}), [])
        self.assertEqual(submission_voice_paths({'b10':'ACME, S.A. de C.V. is a developer.'}), [])

    def test_restricted_destination_does_not_confirm_permission(self):
        matter={'id':'m','rawNotes':'Legal work','confidentialityConfirmed':False,
                'publish_status':'confirmation_required','publication_route':'E',
                'resolved_publication_status':'confirmation_required'}
        source=copy.deepcopy(matter)
        package={'matters':[matter],'delivery_policy':'restricted-unconfirmed-v1'}
        self.assertEqual(register_gate({'package':package})['errors'], [])
        self.assertEqual(matter,source)
        package['matters'][0]['publication_route']='D'
        self.assertTrue(register_gate({'package':package})['errors'])

    def test_endpoint_cannot_discard_critical_letter_or_acceptance_findings(self):
        from main import verify_rendered_package_endpoint
        defects=[{'scope':'letter','severity':'critical','message':'A concrete unresolved error.'},
                 {'scope':'submission','severity':'critical','message':'La aceptación editorial no está completa: executive_audit'}]
        class Request:
            async def json(self):
                return {'package':{'rendered_artifact':'Actual bytes text'},'letter':{'portfolio':'Still wrong'}}
        result={'judge':{'passed':False,'defects':defects},'letter':{'portfolio':'Still wrong'}}
        with patch('core.review_graph.review_rendered_package',return_value=result):
            response=asyncio.run(verify_rendered_package_endpoint(Request()))
        body=json.loads(response.body)
        self.assertFalse(body['judge']['passed'])
        self.assertEqual(body['judge']['defects'],defects)

    def test_exact_byte_review_never_approves_a_repaired_letter_without_rendering(self):
        state={'package':{'rendered_artifact':'Submission','rendered_audit':'Old Audit'},'letter':{'portfolio':'Old Audit'}}
        judged={**state,'judge':{'passed':False,'defects':[{'scope':'letter','severity':'critical'}]}}
        with patch('core.review_graph.run_editorial_stage',return_value=judged), patch('core.review_graph.writer') as writer:
            result=review_rendered_package(state,allow_repair=True)
        writer.assert_not_called()
        self.assertFalse(result['judge']['passed'])


if __name__ == '__main__':
    unittest.main()
