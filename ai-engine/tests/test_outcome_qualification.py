"""Offline permissions to repair generated prose, never source adjudication."""
import copy
import unittest
from unittest.mock import patch
from pydantic import ValidationError
from core.outcome_qualification import grounded_outcome_qualification
from core.review_graph import Defect, calibrate_verdict, editor, EditorialResponseError

WIN='The case was won in 2020.'
ADVERSE='The court ruled against the claim.'
INTERIM='The court lifted four interim suspensions within three weeks.'
CLAIM='The firm won the case in 2020.'
PACKAGE={'matters':[{'id':'m','rawNotes':' '.join([WIN,ADVERSE,INTERIM])}], 'rendered_artifact':CLAIM}
DEFECT={'code':'SOURCE_CONFLICT','severity':'critical','scope':'submission','matter_id':'m','field_path':'outcome','message':'Qualify the final result.', 'conflict_basis':'source_vs_source','conflict_resolution':'qualify_disputed_outcome','artifact_quote':CLAIM,'source_quote':WIN+' '+ADVERSE,
 'outcome_qualification':{'disputed_alternatives':[WIN,ADVERSE],'undisputed_result_quote':INTERIM,'result_kind':'interim_relief','preserves_material_work':True,'preserves_selection_basis':True}}

class OutcomeQualificationTests(unittest.TestCase):
    def test_grounded_qualification_routes_repair_but_remains_rejected(self):
        before=copy.deepcopy(PACKAGE)
        self.assertTrue(grounded_outcome_qualification(DEFECT,PACKAGE))
        result=calibrate_verdict({'passed':True,'defects':[DEFECT]},PACKAGE)
        self.assertFalse(result['passed'])
        finding=result['defects'][0]
        self.assertEqual(finding['owner'],'rankpilot')
        self.assertEqual(finding['severity'],'critical')
        self.assertTrue(finding['qualification_validated'])
        self.assertEqual(PACKAGE,before)
        self.assertNotIn('approved_artifact',result)
        self.assertNotIn('qualification_validated',DEFECT)

    def test_permission_requires_same_record_distinct_procedural_evidence_and_exact_document(self):
        changes=[{'field_path':field} for field in ['value','client','leadPartner','publication_permission']]
        changes += [{'scope':'facts'},{'scope':'strategy'},{'matter_id':'other'},{'artifact_quote':'Not in Word'}, {'conflict_basis':'source_vs_artifact'},{'outcome_qualification':None}]
        for delta in changes:
            with self.subTest(delta=delta):self.assertFalse(grounded_outcome_qualification({**DEFECT,**delta},PACKAGE))
        for delta in [{'preserves_selection_basis':False},{'preserves_material_work':False}, {'disputed_alternatives':[WIN,WIN]}, {'disputed_alternatives':[WIN,'Invented passage']}, {'undisputed_result_quote':WIN},{'undisputed_result_quote':'Invented relief'}, {'result_kind':'procedural_step'}]:
            with self.subTest(delta=delta):
                self.assertFalse(grounded_outcome_qualification({**DEFECT,'outcome_qualification':{**DEFECT['outcome_qualification'],**delta}},PACKAGE))
        self.assertFalse(grounded_outcome_qualification(DEFECT,{**PACKAGE,'rendered_artifact':''}))
        self.assertFalse(grounded_outcome_qualification(DEFECT,{'matters':[{'id':'m','rawNotes':WIN},{'id':'other','rawNotes':ADVERSE+' '+INTERIM}],'rendered_artifact':CLAIM}))

    def test_legacy_ambiguous_outcome_is_not_reclassified_or_approved(self):
        defect={**DEFECT,'scope':'facts','outcome_qualification':None,'conflict_resolution':'confirm_source'}
        result=calibrate_verdict({'passed':False,'defects':[defect]},PACKAGE)
        self.assertFalse(result['passed'])
        self.assertEqual(result['defects'][0]['owner'],'user')
        self.assertNotIn('qualification_validated',result['defects'][0])

    def test_schema_requires_complete_assessment(self):
        self.assertEqual(Defect(**DEFECT).outcome_qualification.result_kind,'interim_relief')
        with self.assertRaises(ValidationError):Defect(**{**DEFECT,'outcome_qualification':None})
        with self.assertRaises(ValidationError):Defect(**{**DEFECT,'outcome_qualification':{**DEFECT['outcome_qualification'],'preserves_selection_basis':False}})

    def test_invalid_fresh_diagnostic_preserves_provider_receipt(self):
        receipt={'role':'editor','provider_request_id':'synthetic-request','usage':{'total_tokens':123}}
        bad={**DEFECT,'artifact_quote':'Not in the exact Word'}
        with patch('core.review_graph.invoke_role',return_value=({'passed':False,'defects':[bad]},[receipt])) as invoke:
            with self.assertRaises(EditorialResponseError) as error:
                editor({'package':PACKAGE,'strategy':{},'letter':{}})
        self.assertEqual(invoke.call_count,1)
        self.assertEqual(error.exception.trace,receipt)

    def test_bound_outcome_repair_uses_one_call_without_editing_sources_or_approval(self):
        from test_editorial_development import PACKAGE as BASE, STRATEGY, DEV
        from core.editorial_development import develop
        package=copy.deepcopy(BASE)
        package['matters'][0]['source_excerpt']+=' '+PACKAGE['matters'][0]['rawNotes']
        proposal=copy.deepcopy(DEV)
        proposal['matters'][0]['text']+=' '+CLAIM
        package['rendered_artifact']=proposal['matters'][0]['text']
        defect={**DEFECT,'matter_id':'m1'}
        defect=calibrate_verdict({'passed':False,'defects':[defect]},package)['defects'][0]
        defect.update(source_field_path='outcome',field_path='matters/0/text')
        before=copy.deepcopy(package)
        fixed=DEV['matters'][0]['text']+' '+INTERIM
        response={'corrections':[{'path':'matters/0/text','value':fixed,'reason':'Keep the attested interim result.'}],'unresolved':[]}
        with patch('core.review_graph.invoke_role',return_value=(response,[])) as model:
            result=develop({'package':package,'strategy':STRATEGY,'development':proposal,'development_reusable':True,'repair_feedback':[defect]})
        self.assertEqual(model.call_count,1)
        self.assertTrue(result['development_validated'],result['errors'])
        self.assertEqual(result['development']['matters'][0]['text'],fixed)
        self.assertEqual(result['development']['candidates'],proposal['candidates'])
        self.assertEqual(package,before)
        self.assertNotIn('approved_artifact',result)
        self.assertNotIn('judge',result)
