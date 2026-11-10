import copy
import unittest
from core.editorial_repetition import repeated_sentences,repetition_fields
from core.editorial_development import development_errors
from core.editorial_repair import repair_targets,apply_corrections
from test_editorial_development import PACKAGE,STRATEGY,DEV

SENTENCE='Our practice combines workforce integration, collective negotiations and employment disputes to support continuity of operations.'
class RepetitionTests(unittest.TestCase):
    def test_nonadjacent_repeat_is_located_without_confusing_cross_field_consistency(self):
        proposal=copy.deepcopy(DEV);proposal['b10']=SENTENCE+'\n\nA distinct supported contribution follows here. '+SENTENCE
        proposal['c2']=SENTENCE
        self.assertEqual(set(repetition_fields(proposal)),{'b10'})
        self.assertTrue(any('repetida' in e for e in development_errors(PACKAGE,STRATEGY,proposal)))
        target=repair_targets(PACKAGE,STRATEGY,proposal)['b10']
        self.assertEqual(target['duplicate_sentences'],[SENTENCE]);self.assertNotIn(SENTENCE,target.get('rejected_quotes',[]))
        correction=lambda value:{'corrections':[{'path':'b10','value':value,'reason':'Retain the substance once.'}],'unresolved':[]}
        fixed=apply_corrections(proposal,{'b10':target},correction(SENTENCE+' A distinct supported contribution follows here.'))
        self.assertIn(SENTENCE,fixed['b10']);self.assertEqual(repeated_sentences(fixed['b10']),[])
        with self.assertRaisesRegex(ValueError,'repeats substantive'):
            apply_corrections(proposal,{'b10':target},correction(proposal['b10']+' Additional words.'))
    def test_short_labels_and_similar_but_distinct_work_do_not_trigger(self):
        self.assertEqual(repeated_sentences('Labour law. Labour law.'),[])
        self.assertEqual(repeated_sentences(SENTENCE+' '+SENTENCE.replace('employment disputes','regulatory audits')),[])

    def test_long_exact_passage_is_detected_after_a_changed_introductory_subject(self):
        tail='practice combines employment compliance, collective negotiations, workplace governance and litigation management to help employers implement operational changes while maintaining continuity of their operations.'
        text='The firm labour '+tail+' Another sentence separates the two paragraphs. The '+tail
        self.assertTrue(repeated_sentences(text))
        self.assertEqual(repeated_sentences('The firm labour '+tail+' The practice advises on new and different matters.'),[])
