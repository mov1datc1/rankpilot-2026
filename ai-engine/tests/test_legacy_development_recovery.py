import copy
import unittest
from unittest.mock import patch
from test_field_review import state
from core.legacy_development_recovery import resume_legacy_development

class LegacyDevelopmentRecoveryTests(unittest.TestCase):
    def fixture(self):
        s=state();s.update(selection_validated=True,selection_review_validated=True,
            trace=[{'role':'repair','usage':{'total_tokens':25}}],
            repair_report={'surgical_retries':1,'failed_paths':['candidates/0','candidates/0/submission_bio'],
                'retry_paths':['candidates/0'],'corrected_paths':['b10'],'unresolved':[]})
        return s

    def test_old_targeted_and_residual_are_preserved_as_one_method_before_source_reconstruction(self):
        s=self.fixture();before=copy.deepcopy(s);targets={'candidates/0':{'current_value':s['development']['candidates'][0]},'candidates/0/submission_bio':{'current_value':'Old wording'}}
        def recover(current,proposal,fields):
            self.assertEqual(current['repair_strategy'],'source_reconstruction')
            self.assertEqual(current['field_review_attempts'],{'candidates/0':2})
            self.assertEqual(current['trace'],before['trace'])
            return {'development':proposal,'development_validated':False,'repair_continuation':{'version':'bounded-residual-v1','pending_groups':[{'candidates/0':{}}]},'trace':current['trace']+[{'usage':{'total_tokens':12}}]}
        with patch('core.editorial_repair.repair_targets',return_value=targets),patch('core.editorial_repair.repair_development',side_effect=recover):
            result=resume_legacy_development(s)
        self.assertEqual(result['field_review_attempts'],{'candidates/0':2})
        self.assertEqual(result['legacy_field_recovery_report']['prior_trace_count'],1)
        self.assertEqual(sum(c['usage']['total_tokens'] for c in result['trace']),37)
        self.assertEqual(s,before)
        s.update(result)
        with patch('core.editorial_repair.repair_development',side_effect=AssertionError('No third method')):
            self.assertTrue(resume_legacy_development(s)['development_repair_unlocatable'])

    def test_unknown_or_already_migrated_methods_never_start_a_request(self):
        for change in [lambda s:s.update(trace=[{'usage':{'unknown_calls':1}}]),lambda s:s.update(field_review_attempts={'candidates/0':1}),lambda s:s['repair_report'].update(unresolved=['Need source evidence'])]:
            s=self.fixture();change(s)
            with patch('core.editorial_repair.repair_development',side_effect=AssertionError('No provider call')):
                self.assertTrue(resume_legacy_development(s)['development_repair_unlocatable'])
