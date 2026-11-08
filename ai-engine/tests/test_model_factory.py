import os,unittest
from unittest.mock import patch
from utils.model_factory import get_model_settings

class ModelFactoryCompatibilityTests(unittest.TestCase):
    def test_current_models_keep_existing_transport_and_reasoning(self):
        with patch.dict(os.environ,{},clear=True):
            self.assertEqual(get_model_settings('development')['model'],'gpt-5.6-terra')
            self.assertEqual(get_model_settings('development')['reasoning_effort'],'high')
            self.assertEqual(get_model_settings('judge')['model'],'gpt-5.6-sol')
            self.assertTrue(get_model_settings('judge')['use_responses_api'])

    def test_explicit_gpt6_override_preserves_responses_reasoning_and_omits_temperature(self):
        with patch.dict(os.environ,{},clear=True):
            for name in ('gpt-6-astra','gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna'):
                settings=get_model_settings('development',name)
                self.assertTrue(settings['use_responses_api']);self.assertEqual(settings['reasoning_effort'],'high')
                self.assertEqual(settings['max_retries'],0);self.assertNotIn('temperature',settings)
        with patch.dict(os.environ,{'REASONING_EFFORT_JUDGE':'none'},clear=True):
            for name in ('gpt-6-astra','gpt-6.1-sol'):
                with self.assertRaises(ValueError):get_model_settings('judge',name)
