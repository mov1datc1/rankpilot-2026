import copy
import unittest
from unittest.mock import patch
from test_editorial_development import PACKAGE, STRATEGY, DEV
from core.editorial_development import develop

class CurrentRepairHandoffTests(unittest.TestCase):
    def test_current_judge_claim_survives_local_residual_priority(self):
        proposal=copy.deepcopy(DEV)
        proposal['matters'][0]['completion_status']='The source does not state a final outcome.'
        quote=proposal['candidates'][0]['submission_bio']
        defect={'code':'UNSUPPORTED_CLAIM','owner':'rankpilot','severity':'critical','scope':'submission',
                'field_path':'candidates/0/submission_bio','artifact_quote':quote,
                'source_quote':'The firm performed the work.','message':'Separate the person mandate leadership from firm execution.'}
        state={'package':PACKAGE,'strategy':STRATEGY,'development':proposal,'development_reusable':True,
               'repair_feedback':[defect],'repair_report':{'corrected_paths':['c2']}}
        original=copy.deepcopy(state)
        with patch('core.editorial_repair.repair_development',return_value={}) as repair:
            develop(state)
        targets=repair.call_args.args[2]
        self.assertIn('candidates/0/submission_bio',targets)
        self.assertIn('matters/0/completion_status',targets)
        self.assertIn(quote,targets['candidates/0/submission_bio']['rejected_quotes'])
        self.assertEqual(state,original)

    def test_invalid_or_source_only_addresses_do_not_interrupt_local_repair(self):
        proposal=copy.deepcopy(DEV);proposal['matters'][0]['completion_status']='The source does not state a final outcome.'
        feedback=[{'owner':'rankpilot','severity':'critical','scope':'facts','field_path':path,'artifact_quote':'Source text'} for path in (None,'research_period','candidates/999/submission_bio')]
        state={'package':PACKAGE,'strategy':STRATEGY,'development':proposal,'development_reusable':True,
               'repair_feedback':feedback,'repair_report':{'corrected_paths':['c2']}}
        with patch('core.editorial_repair.repair_development',return_value={}) as repair:
            develop(state)
        self.assertEqual(set(repair.call_args.args[2]),{'matters/0/completion_status'})
