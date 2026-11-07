import unittest
from core.portfolio_counts import enumeration_defects,rendered_count_defects


class AuditEnumerationTests(unittest.TestCase):
    def strategy(self,count=3):return {'matters':[{'matter_id':str(i),'disposition':'core'} for i in range(count)]}

    def test_extra_reserve_placeholder_is_a_local_generated_defect(self):
        letter={'portfolio':'1. First selected mandate.\n2. Second selected mandate.\n3. Third selected mandate.\n4. Reserved mandate, outside the core.'}
        defects=enumeration_defects(self.strategy(),letter)
        self.assertEqual(len(defects),1);self.assertEqual(defects[0]['field_path'],'portfolio')
        self.assertEqual(defects[0]['owner'],'rankpilot');self.assertEqual(defects[0]['source_quote'],'')
        self.assertEqual(len(rendered_count_defects({'rendered_audit':letter['portfolio']},self.strategy(),letter)),1)

    def test_correct_sequence_passes_and_missing_or_duplicate_indices_fail(self):
        self.assertEqual(enumeration_defects(self.strategy(),{'portfolio':'1. First\n2. Second\n3. Third'}),[])
        for text in ('1. First\n2. Second','1. First\n2. Second\n2. Third','1. First\n3. Third\n2. Second'):
            self.assertTrue(enumeration_defects(self.strategy(),{'portfolio':text}))

    def test_legacy_paragraphs_remain_readable_but_cannot_evade_a_numbered_repair(self):
        self.assertEqual(enumeration_defects(self.strategy(),{'portfolio':'Legacy paragraph portfolio.'}),[])
        self.assertTrue(enumeration_defects(self.strategy(),{'portfolio':'Rewritten without numbers.'},require_numbered=True))

    def test_unrendered_extra_text_does_not_become_an_exact_file_defect(self):
        letter={'portfolio':'1. First\n2. Second\n3. Third\n4. Placeholder'}
        self.assertEqual(rendered_count_defects({'rendered_audit':'Different actual file'},self.strategy(),letter),[])
