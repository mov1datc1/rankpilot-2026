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
