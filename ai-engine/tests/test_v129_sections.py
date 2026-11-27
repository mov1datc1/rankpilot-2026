"""v1.0.129: every section proves with mandates in a clause and none re-tells a work
highlight; the original C2 argument is kept (editorial owner's Public Law review).
Synthetic names."""
import inspect
import unittest

from core import editorial_strategy as es
from core import editorial_construction as ec, editorial_case, biography_shape
from core.editorial_development import Development

MATTERS = [{'matter_id': 'm1', 'text': (
    'We advised Delta Bank in a regulatory dispute with the banking supervisor concerning the legality of commissions '
    'charged for non-financial services. The supervisor ordered the bank to suspend those charges immediately because '
    'they were not included in the official tariff schedule. Ana Ruiz led a challenge based on constitutional principles '
    'and the microfinance statute, preserving the bank\'s ability to offer training and technical assistance.')}]
LAWYERS = [{'name': 'Ana Ruiz Soto'}, {'name': 'Bruno Lima'}, {'name': 'Carla Vega'}]

RETOLD = ('Ana Ruiz Soto heads the Public Law practice. She led Delta Bank in its regulatory dispute with the banking '
          'supervisor concerning the legality of commissions charged for non-financial services. The supervisor ordered the '
          'bank to suspend those charges immediately because they were not included in the official tariff schedule.')
PROOF = ('Ana Ruiz Soto heads the Public Law practice and is the counsel regulated lenders call when a supervisor '
         'reinterprets the rules they operate under. Her judgement shows in the constitutional challenge she led for a '
         'microfinance bank, which preserved its non-financial services.')


class NoSectionRetellsAMatter(unittest.TestCase):
    def test_a_b9_that_narrates_the_matter_again_is_corrected(self):
        self.assertTrue(es.retold_faults('B9 of Ana Ruiz Soto', RETOLD, MATTERS))

    def test_a_proof_clause_passes(self):
        self.assertEqual(es.retold_faults('B9 of Ana Ruiz Soto', PROOF, MATTERS), [])

    def test_b10_and_c2_are_checked_against_the_work_highlights(self):
        value = {'b10': RETOLD, 'c2': 'The current coverage does not reflect our constitutional litigation. ' + RETOLD}
        faults = es.section_faults({}, value, MATTERS)
        self.assertTrue(any(f.startswith('B10 re-tells') for f in faults), faults)
        self.assertTrue(any(f.startswith('C2 re-tells') for f in faults), faults)

    def test_without_narratives_nothing_is_flagged(self):
        self.assertEqual(es.retold_faults('B9', RETOLD, []), [])

    def test_the_units_apply_it(self):
        source = inspect.getsource(ec)
        self.assertEqual(source.count("editorial_strategy.retold_faults('B9 of '"), 2)
        self.assertIn("editorial_strategy.section_faults(package,value,work.get('matters'))", source)


class OriginalC2Argument(unittest.TestCase):
    PACKAGE = {'lawyers': LAWYERS, 'c2_source': ('The practice has consolidated its leadership. Bruno Lima now handles '
                                                 'complex matters independently and Carla Vega has gained autonomy.')}

    def test_a_c2_that_drops_the_lawyers_the_original_argues_for_is_corrected(self):
        faults = es.c2_argument_faults(self.PACKAGE, 'The current coverage does not reflect the practice. Ana Ruiz Soto leads it.')
        self.assertTrue(faults)
        self.assertIn('Bruno Lima', faults[0]); self.assertIn('Carla Vega', faults[0])
        self.assertIn('never as a nomination', faults[0])

    def test_a_c2_that_keeps_them_passes(self):
        c2 = 'The coverage does not reflect the consolidated leadership: Lima leads matters alone and Vega has gained autonomy.'
        self.assertEqual(es.c2_argument_faults(self.PACKAGE, c2), [])

    def test_names_match_without_accents_or_full_names(self):
        self.assertEqual(es.named_lawyers({'lawyers': [{'name': 'Elena María Peñalver'}]}, 'Penalver leads it.'), ['Elena María Peñalver'])

    def test_the_plan_records_the_c2_argument_apart_from_the_b10_thesis(self):
        self.assertIn('(2) the C2 argument of c2_source', Development.model_fields['original_strategy'].description)
        self.assertIn('the C2 argument (the aspect to\nreconsider', ec.PLAN_TASK)
        self.assertIn('never folded into the B10 thesis', es.ORIGINAL_STRATEGY)


class OneContractForB9(unittest.TestCase):
    def test_reviewer_and_shape_ask_for_proof_not_narrative(self):
        source = inspect.getsource(editorial_case)
        self.assertIn('never require B9 to re-tell its legal problem', source)
        self.assertNotIn('B9 develops the personally attributed legal contribution, distinctive issue', source)
        self.assertNotIn('must be developed in their own B9', source)
        self.assertNotIn('Keep every fact, status and mandate', inspect.getsource(biography_shape))
        self.assertIn('fully proves a mandate', es.SECTION_ROLES)


if __name__ == '__main__':
    unittest.main()
