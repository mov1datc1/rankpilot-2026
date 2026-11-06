import copy
import unittest
from unittest.mock import patch
from core.review_graph import normalize_audit_section_labels, condense_audit_letter

class AuditSectionLabelsTests(unittest.TestCase):
    def test_exclusion_heading_does_not_invent_practice_ineligibility(self):
        for practice in ('Labour & Employment', 'Tax'):
            body='The employee retained the firm. Excluded from the employer-side thesis, although relevant to the practice.'
            letter={'evidence_gaps':'**Asuntos Definitivamente Excluidos (Fuera de la categoría '+practice+')**\n\n'+body,'portfolio':'The same selected portfolio.'}
            before=copy.deepcopy(letter)
            normalized=normalize_audit_section_labels(letter)
            self.assertEqual(normalized['evidence_gaps'],'**Asuntos excluidos del portafolio**\n\n'+body)
            self.assertEqual(normalized['portfolio'],letter['portfolio'])
            self.assertEqual(letter,before)
            self.assertEqual(normalize_audit_section_labels(normalized),normalized)

    def test_reserve_label_does_not_imply_missing_evidence_or_edit_body(self):
        body='Complete evidence, but the selected matter offers a more distinctive result.'
        text='**Asuntos en Reserva Condicional (Reincorporables con información adicional)**\n'+body
        letter={'evidence_gaps':text}
        result,_=condense_audit_letter({'package':{}},letter,[])
        self.assertEqual(result['evidence_gaps'],'**Asuntos en reserva**\n'+body)

    def test_only_whole_application_headings_change_without_a_model_call(self):
        body='Source says: Asuntos Definitivamente Excluidos (Fuera de la categoría Tax).'
        letter={'evidence_gaps':body,'executive_assessment':'An unchanged source-based verdict.'}
        with patch('core.review_graph.invoke_role') as model:
            result,_=condense_audit_letter({'package':{}},letter,[])
        model.assert_not_called()
        self.assertEqual(result,letter)
