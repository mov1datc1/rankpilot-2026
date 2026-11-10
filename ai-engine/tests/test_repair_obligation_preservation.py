import copy
import unittest
from unittest.mock import patch
from core.editorial_repair import unique_defects,repair_rejected_development
from test_field_review import state


class RepairObligationPreservationTests(unittest.TestCase):
    def findings(self):
        base={'code':'EDITORIAL_OMISSION','owner':'rankpilot','scope':'submission',
              'field_path':'matters/0/text','artifact_quote':'The firm managed the integration.',
              'severity':'critical','matter_id':None}
        return [{**base,'obligation_id':'integration','source_quote':'The acquisition involved two businesses.',
                 'message':'Preserve the acquisition context.'},
                {**base,'obligation_id':'workforce','source_quote':'The work covered six locations and 5000 employees.',
                 'message':'Preserve location and workforce scale.'},
                {**base,'obligation_id':'proceedings','source_quote':'The team managed 35 proceedings.',
                 'message':'Preserve the number of proceedings.'}]

    def test_same_paragraph_keeps_every_distinct_source_obligation(self):
        findings=self.findings();before=copy.deepcopy(findings)
        self.assertEqual(unique_defects(findings),findings)
        self.assertEqual(findings,before)

    def test_legacy_findings_without_ids_keep_distinct_instructions(self):
        findings=self.findings()
        for f in findings:f.pop('obligation_id');f['source_quote']='One original paragraph supports all facts.'
        self.assertEqual(len(unique_defects(findings)),3)

    def test_true_duplicate_preserves_strongest_severity(self):
        finding=self.findings()[0]
        warning={**finding,'severity':'warning','message':'  Preserve   the acquisition context. '}
        self.assertEqual(unique_defects([warning,finding,warning]),[finding])

    def test_all_obligations_reach_same_target_and_repair_feedback(self):
        current=state();proposal=current['development'];findings=self.findings()
        for f in findings:f['artifact_quote']=proposal['matters'][0]['text']
        def repair(s,p,targets):
            self.assertEqual(s['repair_feedback'],findings)
            for f in findings:self.assertIn(f['message'],targets['matters/0/text']['problem'])
            self.assertEqual(p,proposal)
            return {'captured':True}
        with patch('core.editorial_repair.repair_development',side_effect=repair),\
             patch('core.review_graph.invoke_role',side_effect=AssertionError('Known field needs no paid locator')):
            self.assertEqual(repair_rejected_development(current,proposal,findings),{'captured':True})


if __name__=='__main__':unittest.main()
