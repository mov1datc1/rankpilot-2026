import copy
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from core.editorial_development import development_errors, DEVELOPMENT_VERSION, bind_development
from core.editorial_reasoning import reasoning_guidance
from core.review_graph import role_payload
from test_editorial_development import PACKAGE, STRATEGY, DEV


class EditorialReasoningTests(unittest.TestCase):
    def test_clause_classification_uses_only_its_supplied_evidence(self):
        from core.review_graph import invoke_role, Verdict
        raw=SimpleNamespace(usage_metadata=None,response_metadata={})
        with patch('core.review_graph.RAGRouter.get_rag_context') as rag,patch('core.review_graph.create_chat_model') as model:
            model.return_value.with_structured_output.return_value.invoke.return_value={'parsed':{'passed':True,'defects':[]},'raw':raw}
            result,trace=invoke_role({'package':{}},'portfolio_reviewer',Verdict,'Interpret the supplied clause only.',{'clauses':[]})
        rag.assert_not_called()
        self.assertTrue(result['passed'])
        self.assertEqual(trace[-1]['retrieved_rules'],[])

    def test_legal_issue_anchor_requires_the_same_original_source(self):
        package=copy.deepcopy(PACKAGE)
        package['matters'][0]['source_excerpt']+=' Conflicting creditor priorities prevented the acquisition financing from closing.'
        proposal=copy.deepcopy(DEV);proposal['version']=DEVELOPMENT_VERSION
        draft=proposal['matters'][0]
        draft['legal_issue_source_quote']='Conflicting creditor priorities prevented the acquisition financing from closing.'
        self.assertEqual(development_errors(package,STRATEGY,proposal),[])
        for value in ('','The team provided routine advice.','The court created binding precedent.'):
            draft['legal_issue_source_quote']=value
            self.assertTrue(development_errors(package,STRATEGY,proposal))
            from core.editorial_repair import repair_targets, apply_corrections
            targets=repair_targets(package,STRATEGY,proposal)
            path='matters/0/legal_issue_source_quote'
            self.assertIn(path,targets)
            fixed=apply_corrections(proposal,targets,{'corrections':[{'path':path,
                'value':'Conflicting creditor priorities prevented the acquisition financing from closing.',
                'reason':'Bind the issue to the original source.'}]})
            self.assertEqual(development_errors(package,STRATEGY,fixed),[])
        draft['legal_issue_source_quote']='“Conflicting creditor priorities prevented the acquisition financing from closing.”'
        bound=bind_development(package,proposal)
        self.assertFalse(bound['matters'][0]['legal_issue_source_quote'].startswith('“'))
        self.assertEqual(development_errors(package,STRATEGY,bound),[])

    def test_final_review_removes_only_identical_generated_copies(self):
        source='A legal identity change led to refusal to recognize the defence.'
        narrative='The team challenged the refusal to recognize legally valid identity changes.'
        payload={'package':{'rendered_artifact':'E2 '+narrative+' E8 Ongoing','rendered_audit':'Verdict\nProceed with this evidenced case.','matters':[{'id':'m1','source_excerpt':source}]},
                 'development':{'b10':'Overview differs from rendered file','matters':[{'matter_id':'m1','text':narrative,'completion_status':'Ongoing','legal_issue_source_quote':source,'decisive_source_quotes':[source]}],'candidates':[{'submission_bio':'A genuinely different draft','why_candidate':'Personally led litigation'}]},
                 'letter':{'executive_assessment':'Proceed with this evidenced case.','portfolio':'A divergent selected list'}}
        before=copy.deepcopy(payload);result=role_payload(payload,'editor')
        self.assertEqual(payload,before)
        draft=result['development']['matters'][0]
        self.assertNotIn('text',draft);self.assertNotIn('completion_status',draft)
        self.assertEqual(draft['legal_issue_source_quote'],source)
        self.assertEqual(result['package']['matters'][0]['source_excerpt'],source)
        self.assertEqual(result['development']['b10'],payload['development']['b10'])
        self.assertEqual(result['letter'],{'portfolio':'A divergent selected list'})
        self.assertIn('text',role_payload(payload,'development')['development']['matters'][0])
        del payload['package']['rendered_artifact']
        self.assertIn('text',role_payload(payload,'editor')['development']['matters'][0])

    def test_guidance_does_not_promote_reference_case_facts_or_fixed_order(self):
        for role in ('strategist','development','writer','editor','selection_reviewer'):
            guidance=reasoning_guidance(role)
            self.assertTrue(guidance)
            for name in ('DeForest','Schaeffler','Band 5','Eduardo'):
                self.assertNotIn(name,guidance)
        self.assertEqual(reasoning_guidance('unrelated'), '')
