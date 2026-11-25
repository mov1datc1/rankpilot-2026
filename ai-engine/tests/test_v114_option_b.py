"""v1.0.114: a case without a department description is generated from its matters."""
import inspect
import unittest

from core.editorial_construction import INSTITUTION_TASK
from core import review_graph


class DepartmentDescriptionIsOptional(unittest.TestCase):
    def test_release_no_longer_fails_on_a_missing_department_source(self):
        self.assertNotIn('Department source narrative is missing', inspect.getsource(review_graph))

    def test_writer_builds_from_the_portfolio_without_inventing(self):
        self.assertIn('When b10_source is empty', INSTITUTION_TASK)
        self.assertIn('never invent a structure, headcount, title, history', INSTITUTION_TASK)


if __name__ == '__main__':
    unittest.main()
