import unittest
from core.register_review import register_defects, register_output_limit
from core.editorial_development import submission_voice_paths

class RegisterReviewTests(unittest.TestCase):
    def setUp(self):
        self.package={'matters':[{'id':'m','rawNotes':'The client operates industrial facilities.','confidentialityEvidence':{'client_register':[{'quote':'Example | Internet services | Y'}]}}],'rendered_artifact':'The industrial employer retained the firm.','rendered_audit':'Industrial employer Example is selected.'}
        self.check={'matter_id':'m','relationship':'conflicting','rationale':'Source sectors differ; sector is not needed for the labour work.','register_quote':'Internet services','narrative_quote':'industrial facilities','nonessential_sector':True,'claims':[{'scope':'submission','artifact_quote':'The industrial employer retained the firm.','conflicting_artifact_term':'industrial'}]}
    def test_complete_literal_comparison_routes_only_generated_optional_descriptor(self):
        defects=register_defects(self.package,[self.check]);self.assertEqual(len(defects),1)
        self.assertEqual(defects[0]['conflict_resolution'],'omit_nonessential_descriptor')
        self.assertEqual(self.package['matters'][0]['rawNotes'],'The client operates industrial facilities.')
    def test_omitted_or_duplicate_register_comparisons_fail_closed(self):
        for checks in [[],[self.check,self.check]]:
            with self.assertRaisesRegex(ValueError,'incomplete source register'):register_defects(self.package,checks)
    def test_repair_is_not_requested_after_optional_term_has_been_withdrawn(self):
        self.assertEqual(register_defects(self.package,[{**self.check,'claims':[]}]),[])
    def test_fabricated_quotes_and_absent_disputed_words_cannot_create_user_tasks(self):
        for changes in [{'register_quote':'Manufacturing'},{'narrative_quote':'Education'},{'claims':[{'scope':'submission','artifact_quote':'The industrial employer retained the firm.','conflicting_artifact_term':'security'}]}]:
            with self.assertRaisesRegex(ValueError,'not grounded'):register_defects(self.package,[{**self.check,**changes}])
    def test_a_material_sector_conflict_is_not_automatically_withdrawn(self):
        defect=register_defects(self.package,[{**self.check,'nonessential_sector':False}])[0]
        self.assertEqual(defect['conflict_resolution'],'confirm_source')
    def test_source_commentary_is_repaired_but_legal_audits_are_preserved(self):
        proposal={'matters':[{'text':'The firm conducted evidence audits.','completion_status':'The source records completion of the negotiation.'},{'text':'The formal status field is N/A, while the narrative describes ongoing work.'}]}
        self.assertEqual(submission_voice_paths(proposal),['matters/1/text','matters/0/completion_status'])

class RegisterOutputBudgetTests(unittest.TestCase):
    def test_first_call_has_room_for_required_record_checks_and_stays_bounded(self):
        matter={'confidentialityEvidence':{'client_register':[{'quote':'Example | Sector'}]}}
        package={'rendered_artifact':'Final','matters':[{**matter,'id':str(i)} for i in range(32)]}
        self.assertEqual(register_output_limit(package,8192),16384)
        package['matters']=[{**matter,'id':str(i)} for i in range(200)]
        self.assertEqual(register_output_limit(package,8192),32768)
        self.assertEqual(register_output_limit({},8192),8192)
