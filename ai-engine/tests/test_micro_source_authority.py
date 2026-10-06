import unittest
from unittest.mock import patch
from agents.micro_optimizer import optimize_b10_micro,optimize_matter_micro
class MicroSourceAuthorityTests(unittest.TestCase):
    def test_short_matter_does_not_split_company_abbreviations(self):
        from types import SimpleNamespace
        text = 'Synthetic Client S.A. de C.V. retained the team. The appeal remains pending.'
        with patch('agents.micro_optimizer.get_micro_model') as model:
            model.return_value.invoke.return_value=SimpleNamespace(content=text)
            result=optimize_matter_micro({'client':'Synthetic Client','rawNotes':text})
        self.assertTrue(result['success'])
        self.assertEqual(result['optimized_text'],text)
    def test_directive_cannot_replace_missing_department_source(self):
        with patch('agents.micro_optimizer.get_micro_model') as model:
            self.assertFalse(optimize_b10_micro('',directive='Invent a department')['success']);model.assert_not_called()
    def test_existing_generated_draft_cannot_replace_missing_matter_source(self):
        with patch('agents.micro_optimizer.get_micro_model') as model:
            self.assertFalse(optimize_matter_micro({'client':'Test','optimizedText':'A prior invented win'})['success']);model.assert_not_called()

    def test_overlong_b10_is_not_silently_truncated(self):
        from types import SimpleNamespace
        with patch('agents.micro_optimizer.get_micro_model') as model:
            model.return_value.invoke.return_value=SimpleNamespace(content=' '.join(['word']*510)+'.')
            result=optimize_b10_micro('Source practice narrative.')
        self.assertFalse(result['success'])
        self.assertNotIn('enhanced_b10',result)
