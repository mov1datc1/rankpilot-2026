"""v1.0.125 (Ángela's Tax review, 27-11): team linked to the work in B10, the
positioning as the conclusion of the evidence in C2, and matters built around why
they mattered. Synthetic names."""
import inspect
import unittest

from core import editorial_construction as ec
from core import field_review, editorial_repair, review_graph

PACKAGE = {
    'departmentHeads': [{'name': 'Ana Ruiz Calvo'}, {'name': 'Bruno Soto Lima'}],
    'matters': [
        {'id': 'm1', 'client': 'Alpha Foods', 'leadPartner': 'Ana Ruiz Calvo (Senior Partner, member of the Executive Committee)', 'publication_route': 'D'},
        {'id': 'm2', 'client': 'Beta Air', 'leadPartner': 'Ana Ruiz Calvo and Bruno Soto Lima', 'publication_route': 'D'},
        {'id': 'm3', 'client': 'Gamma Holdings', 'leadPartner': 'Carla Ibarra', 'publication_route': 'E'},
    ],
}


class TeamLinkedToTheWork(unittest.TestCase):
    def test_a_head_named_once_is_linked_to_their_pillar(self):
        b10 = ('We advise on tax structuring.\n\nOur controversy work includes the defence of Beta Air.\n\n'
               'Our structuring work includes the acquisition by Alpha Foods.\n\n'
               'The department is led by Ana Ruiz Calvo and Bruno Soto Lima.')
        faults = ec.team_link_faults(PACKAGE, {'b10': b10})
        self.assertEqual(len(faults), 2, faults)
        self.assertIn('only in the closing paragraph', faults[0])
        self.assertIn('Alpha Foods', faults[0])

    def test_heads_named_in_the_pillars_pass(self):
        b10 = ('We advise on tax structuring. Ana Ruiz Calvo and Bruno Soto Lima lead the department.\n\n'
               'Ana Ruiz Calvo led the acquisition work for Alpha Foods.\n\n'
               'Bruno Soto Lima and Ana Ruiz Calvo co-lead the defence of Beta Air.')
        self.assertEqual(ec.team_link_faults(PACKAGE, {'b10': b10}), [])

    def test_a_head_without_matters_or_a_short_b10_never_faults(self):
        package = {**PACKAGE, 'departmentHeads': [{'name': 'Dora Vidal'}]}
        self.assertEqual(ec.team_link_faults(package, {'b10': 'a\n\nb\n\nc'}), [])
        self.assertEqual(ec.team_link_faults(PACKAGE, {'b10': 'One paragraph only.'}), [])

    def test_writer_links_each_pillar_to_its_lawyers(self):
        self.assertIn('never a separate element at the end', ec.INSTITUTION_TASK)
        self.assertIn('name the lawyer or lawyers who\nlead or execute its decisive mandates', ec.INSTITUTION_TASK)


class PositioningIsAConclusion(unittest.TestCase):
    def test_petitions_are_faults(self):
        for closing in ('This body of work supports moving the practice to Band 1.',
                        'Ana Ruiz Calvo should be maintained in Band 2.',
                        'Bruno Soto Lima is put forward as a Band 4 candidate.',
                        'The firm seeks Band 1 coverage.'):
            faults = ec.aspiration_faults({}, {'c2': 'Our work is sophisticated.\n\n' + closing})
            self.assertTrue(any('asks for the ranking' in f for f in faults), (closing, faults))

    def test_a_conclusion_at_the_end_passes(self):
        c2 = ('Our recent work combines complex audits with cross-border structuring.\n\n'
              'The breadth and results of this work are those of a Band 1 practice, and the record of '
              'Ana Ruiz Calvo is that of a Band 2 individual.')
        self.assertEqual(ec.aspiration_faults({}, {'c2': c2}), [])

    def test_aspiration_before_the_closing_paragraph_is_a_fault(self):
        c2 = 'We aim for Band 1 recognition.\n\nOur work is sophisticated.\n\nThis is the work of a Band 1 practice.'
        self.assertTrue(any('before its closing paragraph' in f for f in ec.aspiration_faults({}, {'c2': c2})))

    def test_requests_to_authorities_are_not_ranking_petitions(self):
        c2 = 'We file requests to tax authorities and advise on advance payments.\n\nThis is the work of a Band 1 practice.'
        self.assertEqual(ec.aspiration_faults({}, {'c2': c2}), [])

    def test_every_role_knows_the_rule(self):
        self.assertIn('never as a petition to the researcher', ec.INSTITUTION_TASK)
        self.assertIn('each lawyer\'s category is the conclusion of that lawyer\'s evidence', ec.INSTITUTION_TASK)
        self.assertIn('a petition for a\nband or category is a style failure', field_review.TASK)
        self.assertIn('A C2 correction states the positioning once', editorial_repair.TASK)
        self.assertIn('a petition (', inspect.getsource(review_graph))

    def test_checks_run_with_the_construction_checks(self):
        self.assertIn('team_link_faults(package,value)+aspiration_faults(package,value)', inspect.getsource(ec))


class MattersBuiltAroundWhyTheyMattered(unittest.TestCase):
    def test_matter_writer_rules(self):
        task = ec.MATTER_TASK
        for expected in ('WHY THE MATTER MATTERED', 'never a closing\nafterthought', 'Weave each lawyer\'s role',
                         'density, not length', 'no\ninference the record does not support'):
            self.assertIn(expected, task)


if __name__ == '__main__':
    unittest.main()
