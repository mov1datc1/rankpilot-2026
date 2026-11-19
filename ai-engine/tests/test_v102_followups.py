"""v1.0.102: defects measured in the DeForest v1.0.101 real run (18-11-2026)."""
import unittest

from core.editorial_repetition import drop_restated_sentences
from core.editorial_development import bind_development
from core.review_graph import calibrate_verdict, identity_absent_from_word
from core.public_privacy import sector_rule, public_disclosure
from core.candidate_evidence import CHAMBERS_CATEGORY_GUIDANCE, category_error
from core.editorial_construction import reconcile_categories
from core import reserve_comparisons

DUPLICATE = ('DeForest coordinates local litigation strategy. Eduardo’s leadership also extends to work for Megacable '
             'involving litigation coordination, cross-state governance and preventive frameworks. His practice also '
             'includes litigation coordination, cross-state governance and preventive frameworks, including work for Megacable.')


class RestatedSentence(unittest.TestCase):
    def test_the_adjacent_restatement_from_the_run_is_removed(self):
        out = drop_restated_sentences(DUPLICATE)
        self.assertEqual(out.count('cross-state governance'), 1)
        self.assertIn('Eduardo’s leadership also extends', out)

    def test_the_sentence_a_quotation_depends_on_is_the_one_kept(self):
        quote = 'His practice also includes litigation coordination'
        out = drop_restated_sentences(DUPLICATE, [quote])
        self.assertIn(quote, out)
        self.assertEqual(out.count('cross-state governance'), 1)

    def test_a_different_fact_or_figure_or_a_distant_sentence_is_kept(self):
        for text in ('DeForest negotiated the agreement and prevented a strike at the plant. DeForest negotiated the agreement and prevented a strike at three plants.',
                     'The firm handled 200 labour proceedings for the employer nationwide. The firm handled 45 labour proceedings for the employer nationwide.',
                     'DeForest reviewed regulations, agreements, policies and commissions. Ana teaches law. DeForest reviewed regulations, agreements, policies and commissions.'):
            self.assertEqual(drop_restated_sentences(text), text)
        self.assertEqual(drop_restated_sentences('Short. Short.'), 'Short. Short.')

    def test_construction_applies_it_to_b9_without_breaking_public_quotes(self):
        quote = 'Eduardo’s leadership also extends to work for Megacable'
        proposal = {'candidates': [{'name': 'Eduardo', 'submission_bio': DUPLICATE,
                                    'profile_coverage': [{'decision': 'retain', 'public_quote': quote, 'relationship': 'client', 'entity_name': 'Megacable'}],
                                    'submission_case_coverage': [], 'supporting_matters': []}]}
        bound = bind_development({'matters': []}, proposal)
        bio = bound['candidates'][0]['submission_bio']
        self.assertEqual(bio.count('cross-state governance'), 1)
        self.assertIn(bound['candidates'][0]['profile_coverage'][0]['public_quote'], bio)


WORD = 'B9 Eduardo’s leadership also extends to work for a confidential client involving litigation coordination.'


def megacable(code='PUBLICATION_PERMISSION', quote='Eduardo’s leadership also extends to work for Megacable involving litigation coordination.'):
    return {'code': code, 'severity': 'critical', 'scope': 'submission', 'field_path': 'candidates/0/submission_bio',
            'message': 'La B9 pública identifica a Megacable como cliente sin permiso.' if code == 'PUBLICATION_PERMISSION'
            else 'Megacable permanece nombrado públicamente sin permiso.',
            'artifact_quote': quote, 'source_quote': 'clients such as Volkswagen and Megacable.', 'matter_id': None}


class JudgeReadsTheDeliveredWord(unittest.TestCase):
    def test_a_name_the_word_does_not_print_is_not_a_blocking_finding(self):
        package = {'rendered_artifact': WORD, 'matters': []}
        self.assertEqual(identity_absent_from_word(megacable(), package), ['Megacable'])
        # Also when the judge quoted the Word itself but still named the client.
        self.assertEqual(identity_absent_from_word(megacable('EDITORIAL_OMISSION', WORD[3:]), package), ['Megacable'])
        acceptance = [{'criterion': 'confidentiality', 'status': 'failed', 'evidence': 'La B9 nombra a Megacable.'}]
        summary = {'code': 'EDITORIAL_OMISSION', 'severity': 'critical', 'scope': 'submission', 'source_quote': '', 'artifact_quote': '',
                   'message': 'La aceptación editorial no está completa: confidentiality'}
        verdict = calibrate_verdict({'passed': False, 'acceptance': acceptance,
                                     'defects': [megacable(), megacable('EDITORIAL_OMISSION', WORD[3:]), summary]}, package, {})
        self.assertTrue(verdict['passed'])
        self.assertTrue(all(d['severity'] == 'warning' for d in verdict['defects']))

    def test_a_name_the_word_prints_still_blocks(self):
        package = {'rendered_artifact': WORD.replace('a confidential client', 'Megacable'), 'matters': []}
        self.assertEqual(identity_absent_from_word(megacable(), package), [])
        verdict = calibrate_verdict({'passed': False, 'defects': [megacable()]}, package, {})
        self.assertFalse(verdict['passed'])

    def test_another_critical_finding_keeps_the_acceptance_summary_blocking(self):
        package = {'rendered_artifact': WORD, 'matters': []}
        other = {'code': 'UNSUPPORTED_CLAIM', 'severity': 'critical', 'scope': 'submission', 'message': 'Invented result.',
                 'artifact_quote': 'B9', 'source_quote': '', 'matter_id': None}
        summary = {'code': 'EDITORIAL_OMISSION', 'severity': 'critical', 'scope': 'submission', 'source_quote': '', 'artifact_quote': '',
                   'message': 'La aceptación editorial no está completa: confidentiality'}
        verdict = calibrate_verdict({'passed': False, 'acceptance': [{'criterion': 'confidentiality', 'status': 'failed', 'evidence': 'Megacable'}],
                                     'defects': [megacable(), other, summary]}, package, {})
        self.assertFalse(verdict['passed'])
        self.assertEqual(next(d for d in verdict['defects'] if d['message'].startswith('La aceptación'))['severity'], 'critical')

    def test_an_omission_finding_is_never_reclassified(self):
        defect = {'code': 'EDITORIAL_OMISSION', 'severity': 'critical', 'scope': 'submission',
                  'message': 'La B9 omite el trabajo de Megacable.', 'artifact_quote': 'B9 Eduardo', 'source_quote': 'Megacable work'}
        self.assertEqual(identity_absent_from_word(defect, {'rendered_artifact': WORD}), [])


def axle(sector='Supply & Logistics Services'):
    return {'id': 'axle', 'client': 'American Axle Manufactury', 'publication_route': 'E', 'resolved_publication_status': 'confidential',
            'summary': "American Axle & Manufacturing, one of the world's leading automotive component manufacturers, appointed DeForest.",
            'confidentialityEvidence': {'client_register': [{'quote': f'American Axle Manufactury | {sector} | Y | Y | Full-scope labor advisory'}]}}


class DisputedClientSector(unittest.TestCase):
    def test_register_and_narrative_disagree_so_no_sector_label(self):
        rule = sector_rule(axle())
        self.assertTrue(rule['disputed'])
        self.assertEqual(rule['register_sector'], 'Supply & Logistics Services')
        self.assertTrue(public_disclosure({'matters': [axle()]}, {'axle'})[0]['client_sector']['disputed'])

    def test_agreeing_or_absent_sector(self):
        self.assertFalse(sector_rule(axle('Automotive supplier'))['disputed'])
        matter = axle();matter['confidentialityEvidence'] = {}
        self.assertIsNone(sector_rule(matter))


class CategoryFollowsTheFirmMethodology(unittest.TestCase):
    def test_a_specific_band_target_is_offered_and_valid(self):
        self.assertIn('Band N candidate', CHAMBERS_CATEGORY_GUIDANCE['guidance'])
        self.assertIn('Established Individual', CHAMBERS_CATEGORY_GUIDANCE['guidance'])
        self.assertIsNone(category_error({'suggested_ranking': 'Band 5 candidate'}))
        self.assertIsNotNone(category_error({'suggested_ranking': 'Band ranking candidate'}))

    def test_a_maturity_descriptor_is_still_not_a_category(self):
        plan = reconcile_categories({'candidates': [{'suggested_ranking': 'Established Individual', 'category_rationale': 'x'},
                                                    {'suggested_ranking': 'Band 5 candidate', 'category_rationale': 'y'}]})
        self.assertEqual([c['suggested_ranking'] for c in plan['candidates']], ['Category pending', 'Band 5 candidate'])


class ReserveComparisonKeepsTheReserveWork(unittest.TestCase):
    def test_instruction_requires_the_reserve_actions_before_its_gaps(self):
        self.assertIn("reserve's OWN concrete actions", reserve_comparisons.INSTRUCTION)


if __name__ == '__main__':
    unittest.main()
