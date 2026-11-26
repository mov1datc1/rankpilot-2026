"""v1.0.120: a figure the source itself contradicts is not written, and not narrated.

Evidence: two real runs of one case whose source says both that three and that
four proceedings remain. In the first the writer chose three and the judge asked
the client while suggesting "a wording that records the discrepancy"; in the
second the writer wrote the discrepancy into B10, C2 and the matter, and the
judge approved a public Submission that narrates its own source.
"""
import unittest

from core.editorial_development import submission_voice_paths
from core.editorial_role_policy import DISPUTED_FIGURES, DISPUTED_FIGURES_REVIEW, role_base


def flagged(text):
    return submission_voice_paths({'b10': text, 'c2': '', 'matters': [], 'candidates': []})


class DisputedFigures(unittest.TestCase):
    def test_writers_and_reviewers_receive_the_same_sentence(self):
        from core.review_graph import BASE
        for role in ('development', 'writer'):
            system = role_base(role, BASE)
            self.assertIn(DISPUTED_FIGURES, system)
            self.assertNotIn(DISPUTED_FIGURES_REVIEW, system)  # writers get no judging policy
        for role in ('strategist', 'selection_reviewer', 'field_reviewer', 'editor'):
            system = role_base(role, BASE)
            self.assertIn(DISPUTED_FIGURES, system)
            self.assertIn(DISPUTED_FIGURES_REVIEW, system)

    def test_the_sentence_keeps_uncontested_figures_and_sends_the_question_to_the_audit(self):
        text = ' '.join(DISPUTED_FIGURES.split())
        self.assertIn('states the underlying fact without the figure', text)
        self.assertIn('The internal Audit records both passages and asks the client', text)
        self.assertIn('Every uncontested figure of the same matter', text)
        self.assertIn('No reviewer requires a disputed figure', ' '.join(DISPUTED_FIGURES_REVIEW.split()))

    def test_a_submission_that_narrates_its_source_is_caught(self):
        for text in (
            'Three hearings are reported as pending; the source separately refers to four remaining hearings, so we do not state a definitive number.',
            'A separate passage refers to four remaining hearings expected to be dismissed.',
            'The record also states that two appeals were filed.',
            'Another passage gives a different total.',
        ):
            self.assertEqual(flagged(text), ['b10'], text)

    def test_direct_prose_is_untouched(self):
        for text in (
            'Hearings brought by unsuccessful bidders remain pending at the evidentiary stage.',
            'The firm prepared a separate filing for each stage of the tender.',
            'We obtained approximately 30 favourable decisions and a payment exceeding MXN100 million.',
        ):
            self.assertEqual(flagged(text), [], text)


if __name__ == '__main__':
    unittest.main()
