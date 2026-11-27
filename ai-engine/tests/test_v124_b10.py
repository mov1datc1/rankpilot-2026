"""v1.0.124 (Jonathan, 27-11, after Ángela's Labour review): B10 at most 500 words,
presenting the practice with the original's leadership structure. Synthetic names."""
import inspect
import unittest

from core import editorial_construction as ec
from core import field_review, review_graph, editorial_repair
from core.section_limits import B10_MAX_WORDS, C2_MAX_WORDS, B9_MAX_WORDS

SOURCE = (
    "The firm's employment practice handles complex, high-stakes matters in a restrictive market. "
    "Employers face rigid statutory protections and intense regulatory scrutiny. " * 3 +
    "\nThe practice is supported by a deliberately structured senior team. Ana Ruiz Calvo, a senior figure in the market, "
    "brings decades of experience and provides institutional leadership.\n"
    "Crucially, the day-to-day management and execution of the practice are led by Berta Molina, a senior associate with over 16 years "
    "of specialised experience in employment law. She acts as a primary client contact and leads complex disputes.\n"
    "She is complemented by Carla Ibarra, a senior associate with approximately eight years of experience, who has assumed "
    "increasing responsibility in contentious and regulatory matters.\n"
    "This structure gives the practice stability and continuity."
)
PACKAGE = {
    'b10_source': SOURCE,
    'departmentHeads': [{'name': 'Ana Ruiz Calvo'}],
    'lawyers': [{'name': 'Ana Ruiz Calvo'}, {'name': 'Berta Molina'}, {'name': 'Carla Ibarra'}, {'name': 'Diego Paredes'}],
}


class Limits(unittest.TestCase):
    def test_b10_is_500_and_b9_c2_stay_1000(self):
        self.assertEqual((B10_MAX_WORDS, C2_MAX_WORDS, B9_MAX_WORDS), (500, 1000, 1000))

    def test_writer_judge_reviewer_and_repair_carry_the_500_limit(self):
        self.assertIn('B10 has a MAXIMUM of 500 words', ec.INSTITUTION_TASK)
        self.assertIn('C2 has a 1,000-word maximum', ec.INSTITUTION_TASK)
        self.assertNotIn('not a 500-word limit', ec.INSTITUTION_TASK)
        judge = inspect.getsource(review_graph)
        self.assertIn('B10 may run up to 500 words', judge)
        self.assertNotIn('a printed template guidance such as a 500-word limit does not apply', judge)
        self.assertIn('B10 has a 500-word maximum', field_review.TASK)
        self.assertIn('A B10 correction stays within 500 words', editorial_repair.TASK)


class Structure(unittest.TestCase):
    def test_writer_presents_leadership_and_pillars_not_a_matter_list(self):
        task = ec.INSTITUTION_TASK
        for expected in ('B10 PRESENTS the practice', 'PRESERVE its structure', 'never flatten a role',
                         'department leadership and bench depth', 'two to four capability pillars',
                         'never a matter-by-matter catalogue', 'C2 uses these strengths to argue'):
            self.assertIn(expected, task)
        self.assertIn('two to four\ninstitutional_arguments', ec.PLAN_TASK)

    def test_a_person_the_original_presents_must_stay(self):
        flat = ('Our employment practice advises employers in a restrictive market. Ana Ruiz Calvo heads the department; '
                'Berta Molina is part of the team supporting client work. For Client One, we defended ... ' + 'word ' * 300)
        faults = ec.leadership_faults(PACKAGE, {'b10': flat})
        self.assertTrue(any('drops Carla Ibarra' in f for f in faults), faults)
        self.assertTrue(any("Berta Molina's experience" in f and 'over 16 years' in f for f in faults), faults)
        # A lawyer the original never names (Diego Paredes) is not required.
        self.assertFalse(any('Diego Paredes' in f for f in faults))

    def test_the_original_structure_kept_has_no_fault(self):
        kept = ('Ana Ruiz Calvo provides institutional leadership. Berta Molina, with more than 16 years of experience, '
                'leads the day-to-day management of the practice and is the primary client contact, supported by '
                'Carla Ibarra, who brings eight years of experience. ' + 'word ' * 300)
        self.assertEqual(ec.leadership_faults(PACKAGE, {'b10': kept}), [])

    def test_number_words_and_digits_are_the_same_figure(self):
        kept = ('Ana Ruiz Calvo leads. Berta Molina has sixteen years of experience. Carla Ibarra has 8 years of experience. ' + 'word ' * 50)
        self.assertEqual(ec.leadership_faults(PACKAGE, {'b10': kept}), [])

    def test_short_or_empty_original_never_faults(self):
        self.assertEqual(ec.leadership_faults({**PACKAGE, 'b10_source': 'Ana Ruiz Calvo heads the team.'}, {'b10': 'x'}), [])
        self.assertEqual(ec.leadership_faults({**PACKAGE, 'b10_source': ''}, {'b10': 'x'}), [])

    def test_leadership_check_runs_with_the_construction_checks(self):
        source = inspect.getsource(ec.advance) if hasattr(ec, 'advance') else inspect.getsource(ec)
        self.assertIn('length_faults(package,value)+leadership_faults(package,value)', source)


if __name__ == '__main__':
    unittest.main()
