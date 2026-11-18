"""First-pass telemetry judges the construction's own text, not another field's repair."""
import unittest

from core.construction_quality import output_digest, record_first_review


def report(hash_, text):
    return {'first_pass_quality': {'units': {'candidates/0/submission_bio': {
        'hash': hash_, 'output_hash': output_digest(text), 'obligation_ids': ['a', 'b'], 'checks': {}}}}}


class FirstPassMeasureTests(unittest.TestCase):
    checks = {'checks': {'a': {'status': 'met'}, 'b': {'status': 'failed'}}}

    def test_unchanged_text_with_changed_evidence_counts_as_first_pass(self):
        unit = {'field': 'candidates/0/submission_bio', 'hash': 'new-evidence', 'output': 'Same  text.',
                'obligations': [{'id': 'a'}, {'id': 'b'}]}
        saved = record_first_review(report('old', 'Same text.'), [unit], self.checks)['first_pass_quality']
        entry = saved['units']['candidates/0/submission_bio']
        self.assertEqual(entry['first_review'], 'original')
        self.assertTrue(entry['evidence_changed_before_review'])
        self.assertEqual(saved['met'], 1)
        self.assertEqual(saved['failed'], 1)

    def test_changed_text_is_still_corrected_before_review(self):
        unit = {'field': 'candidates/0/submission_bio', 'hash': 'new', 'output': 'Rewritten text.',
                'obligations': [{'id': 'a'}, {'id': 'b'}]}
        saved = record_first_review(report('old', 'Original text.'), [unit], self.checks)['first_pass_quality']
        self.assertEqual(saved['units']['candidates/0/submission_bio']['first_review'], 'corrected_before_review')
        self.assertEqual(saved['corrected_before_review'], 2)


if __name__ == '__main__':
    unittest.main()
