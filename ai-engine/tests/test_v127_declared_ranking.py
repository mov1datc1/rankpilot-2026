"""v1.0.127 (Ángela, Public Law): the firm's declared ranking is a fact of the case,
the Audit states the real status of the official query, and a B9 that names the
department headship in plural or with punctuation is not missing it. Synthetic names."""
import inspect
import unittest

from core import review_graph
from core.audit_decisions import _current_position, decision_heading, verification_status
from core.editorial_execution import missing_head_bios, EXECUTION_CONTRACT


def state(status):
    return {'package': {'ranking_verification': {'individuals': [
        {'lawyer_name': 'Ana Ruiz', 'status': status, 'declared_band': 'Ranked'},
        {'lawyer_name': 'Bruno Soto', 'status': status, 'declared_band': 'Not ranked'}]}}}


class StatusOfTheQuery(unittest.TestCase):
    def test_unavailable_is_never_written_as_no_match(self):
        for value in ('Not ranked (declarado por la firma; no verificado)', 'Not ranked'):
            text = _current_position(value, 'unavailable')
            self.assertTrue(text.startswith('la firma lo declara sin ranking'), text)
            self.assertIn('no estuvo disponible', text)
            self.assertNotIn('coincidencia exacta', text)

    def test_not_found_keeps_the_no_match_sentence(self):
        self.assertIn('no encontró una coincidencia exacta', _current_position('Not ranked', 'not_found'))

    def test_declared_ranked_is_the_firms_declaration(self):
        text = _current_position('Ranked (declarado por la firma; no verificado para esta tabla)', 'unavailable')
        self.assertTrue(text.startswith('la firma lo declara rankeado'), text)
        self.assertIn('la firma lo declara en Band 2', _current_position('Band 2', 'unavailable'))

    def test_a_verified_position_is_kept(self):
        self.assertEqual(_current_position('Band 2 (verified)', 'verified_match'), 'Band 2 (verified)')

    def test_heading_reads_the_lawyers_own_status(self):
        self.assertEqual(verification_status(state('unavailable'), 'Bruno Soto'), 'unavailable')
        heading = decision_heading({'name': 'Bruno Soto', 'recommendation': 'develop', 'current_ranking': 'Not ranked',
                                    'suggested_ranking': 'Category pending'}, state('unavailable'))
        self.assertIn('la firma lo declara sin ranking; la verificación oficial no estuvo disponible', heading)


class HeadshipInTheB9(unittest.TestCase):
    PACKAGE = {'filing_details': {'heads': [{'name': 'Ana Ruiz'}, {'name': 'Bruno Soto'}]}}

    def bio(self, text):
        proposal = {'execution_contract': EXECUTION_CONTRACT, 'candidates': [{'name': 'Ana Ruiz', 'submission_bio': text}]}
        return missing_head_bios(self.PACKAGE, proposal)

    def test_plural_and_punctuation_count(self):
        for text in ('Ana Ruiz is a Senior Partner and one of two department heads of the Public Law (Administrative, Economic and Regulatory Law) department.',
                     'Ana Ruiz, head of the Regulatory / Public Law practice, is a Partner.',
                     'Ana Ruiz co-heads the department with Bruno Soto.',
                     "Ana Ruiz is one of the department's two heads."):
            self.assertEqual(self.bio(text), [], text)

    def test_a_bio_without_the_function_is_still_caught(self):
        self.assertEqual(self.bio('Ana Ruiz is a Senior Partner who advises on regulatory disputes.'), [0])


class FormColumnsAreTheFirmsDeclaration(unittest.TestCase):
    def test_judge_reads_the_columns_as_the_firms_answers(self):
        self.assertIn("Ranked Y/N columns are the firm's own answers", inspect.getsource(review_graph))


if __name__ == '__main__':
    unittest.main()
