"""v1.0.127: one editorial method for every role (the editorial owner's Labour, Tax
and Public Law reviews). Synthetic names."""
import inspect
import unittest

from core import editorial_strategy as es
from core import editorial_construction as ec
from core import field_review, editorial_repair, review_graph, audit_decisions, selection_review, case_register, fact_sheet
from core.audit_decisions import decision_heading
from core.biography_depth import DEPTH_POLICY
from core.editorial_development import Candidate, MatterDraft, Development

LAWYERS = [{'name': 'Ana Ruiz', 'is_ranked': True, 'current_ranking': 'Ranked'},
           {'name': 'Bruno Soto', 'is_ranked': True, 'current_ranking': 'Band 2'},
           {'name': 'Carla Ibarra', 'is_ranked': False, 'current_ranking': 'Not ranked'}]


def plan(*rows):
    return {'candidates': [dict(name=n, recommendation=r, suggested_ranking=s, category_rationale='x', recommended_action='y', **extra)
                           for n, r, s, extra in rows]}


class DeclaredRankingIsAFact(unittest.TestCase):
    def test_a_declared_ranked_lawyer_is_never_sent_to_an_entry_band(self):
        result = es.apply_candidacy(plan(('Ana Ruiz', 'present', 'Entry-band candidate', {})), {'lawyers': LAWYERS})
        c = result['candidates'][0]
        self.assertEqual(c['suggested_ranking'], 'Category pending')
        self.assertIn('ya está rankeado', c['category_missing_criterion'])
        self.assertEqual(c['recommendation'], 'present')

    def test_a_declared_band_is_kept_not_lowered(self):
        c = es.apply_candidacy(plan(('Bruno Soto', 'present', 'Band 4', {})), {'lawyers': LAWYERS})['candidates'][0]
        self.assertEqual(c['suggested_ranking'], 'Band 2')
        c = es.apply_candidacy(plan(('Bruno Soto', 'present', 'Band 1', {})), {'lawyers': LAWYERS})['candidates'][0]
        self.assertEqual(c['suggested_ranking'], 'Band 1')

    def test_a_pending_label_with_an_explanation_becomes_the_form_label(self):
        row = ('Ana Ruiz', 'present', 'Category pending (mantener la posición declarada; confirmar la banda)',
               {'category_missing_criterion': ''})
        c = es.apply_candidacy(plan(row), {'lawyers': LAWYERS})['candidates'][0]
        self.assertEqual(c['suggested_ranking'], 'Category pending')
        self.assertEqual(c['category_missing_criterion'], 'mantener la posición declarada; confirmar la banda')
        from core.candidate_evidence import category_error
        self.assertIsNone(category_error(c))

    def test_an_unranked_lawyer_keeps_the_entry_proposal(self):
        c = es.apply_candidacy(plan(('Carla Ibarra', 'present', 'Entry-band candidate', {})), {'lawyers': LAWYERS})['candidates'][0]
        self.assertEqual(c['suggested_ranking'], 'Entry-band candidate')

    def test_plan_reconciliation_applies_it(self):
        result = ec.reconcile_categories(plan(('Ana Ruiz', 'present', 'Entry-band candidate', {})), {'lawyers': LAWYERS})
        self.assertEqual(result['candidates'][0]['suggested_ranking'], 'Category pending')


class FourCandidacyStates(unittest.TestCase):
    def test_state_decides_the_recommendation(self):
        rows = [('Ana Ruiz', 'present', 'Category pending', {'candidacy_state': 'under_documented'}),
                ('Bruno Soto', 'do_not_present', 'Category pending', {'candidacy_state': 'development_potential'}),
                ('Carla Ibarra', 'develop', 'Category pending', {'candidacy_state': 'inviable'})]
        result = es.apply_candidacy(plan(*rows), {'lawyers': []})
        self.assertEqual([c['recommendation'] for c in result['candidates']], ['develop', 'develop', 'do_not_present'])

    def test_missing_state_follows_the_recommendation(self):
        c = es.apply_candidacy(plan(('Ana Ruiz', 'develop', 'Category pending', {})), {'lawyers': []})['candidates'][0]
        self.assertEqual(c['candidacy_state'], 'development_potential')

    def test_audit_names_the_state_and_what_to_obtain(self):
        heading = decision_heading({'name': 'Dora Vidal', 'recommendation': 'develop', 'candidacy_state': 'under_documented',
                                    'current_ranking': '', 'suggested_ranking': 'Category pending',
                                    'recommended_action': 'Obtener su papel propio en dos asuntos.'})
        self.assertIn('candidatura insuficientemente documentada. Información a conseguir: Obtener su papel propio', heading)

    def test_the_schema_offers_the_states(self):
        self.assertIn('under_documented', str(Candidate.model_fields['candidacy_state'].annotation))
        self.assertIn('Thin evidence alone is never inviable', Candidate.model_fields['candidacy_state'].description)


class SectionFunctions(unittest.TestCase):
    B10 = ('Our practice advises regulated companies on disputes with the State.\n\n'
           'For Alpha Bank we challenged a suspension order of the banking regulator under constitutional principles.')

    def test_c2_that_presents_the_practice_is_corrected(self):
        c2 = ('Our public-law portfolio reflects a capable practice.\n\n'
              'For Alpha Bank we challenged a suspension order of the banking regulator under constitutional principles.\n\n'
              'Alpha Bank challenged a suspension order of the banking regulator under constitutional principles too.')
        faults = es.section_faults({}, {'b10': self.B10, 'c2': c2})
        self.assertTrue(any('opens by presenting the practice' in f for f in faults), faults)
        self.assertTrue(any('repeats B10' in f for f in faults), faults)

    def test_c2_that_reads_the_coverage_passes(self):
        c2 = ('The current coverage recognises our regulatory advice but not the volume of constitutional litigation we conduct.\n\n'
              'Our challenge to a banking suspension order shows that litigation capability in a single decisive case.')
        self.assertEqual(es.section_faults({}, {'b10': self.B10, 'c2': c2}), [])

    def test_every_writer_and_reviewer_reads_the_method(self):
        for text in (ec.INSTITUTION_TASK, ec.bio_task(), ec.PLAN_TASK):
            self.assertIn('ONE STRATEGY, FOUR SECTIONS', text)
        for text in (field_review.TASK, editorial_repair.TASK, review_graph.BASE):
            self.assertIn('EDITORIAL METHOD', text)
        self.assertIn('MATTER SIGNIFICANCE', selection_review.SELECTION_REASONING)
        self.assertIn('CANDIDACY', audit_decisions.WRITING_TASK)

    def test_c2_is_feedback_on_the_coverage(self):
        flat = ' '.join(ec.INSTITUTION_TASK.split())
        self.assertIn("C2 is the firm's feedback on the directory's coverage", flat)
        self.assertIn('the precise aspect that deserves reconsideration', flat)

    def test_original_strategy_is_planned_and_handed_to_the_writer(self):
        self.assertIn('original_strategy', ec.PLAN_FIELDS)
        self.assertIn('original_strategy', Development.model_fields)
        self.assertIn("'original_strategy':work.get('original_strategy','')", inspect.getsource(ec))


class B9IsAnArgument(unittest.TestCase):
    def test_no_five_hundred_word_target(self):
        self.assertIn('usually needs 200 to 400 words', DEPTH_POLICY)
        self.assertNotIn('500–1,000', DEPTH_POLICY)
        self.assertIn('usually 200 to 400 words', Candidate.model_fields['submission_bio'].description)
        self.assertIn('never re-tell its facts here', ec.bio_task())


class Matters(unittest.TestCase):
    PACKAGE = {'matters': [{'id': 'm1', 'client': 'Delta Works', 'contested_facts': [
        {'subject': 'arbitral forum', 'quote_a': 'treaty arbitration under applicable international investment agreements',
         'quote_b': 'Arbitration filed at the International Chamber of Commerce (ICC) in Paris'}]}]}

    def test_a_contested_fact_is_never_stated(self):
        text = 'We advised Delta Works in the treaty arbitration before the ICC in Paris on State conduct.'
        self.assertTrue(es.conflict_faults(self.PACKAGE, [{'matter_id': 'm1', 'text': text}]))
        clean = 'We advised Delta Works in an international arbitration on the conduct of State entities under domestic law.'
        self.assertEqual(es.conflict_faults(self.PACKAGE, [{'matter_id': 'm1', 'text': clean}]), [])

    def test_one_word_of_a_version_on_the_disputed_object_is_stating_it(self):
        package = {'matters': [{'id': 'm1', 'client': 'Delta Works', 'contested_facts': [
            {'subject': 'arbitral forum', 'quote_a': 'leading to a treaty arbitration under applicable international investment agreements.',
             'quote_b': 'Yes. Arbitration filled at the International Chamber of Commerce (ICC) in Paris.'}]}]}
        text = 'We acted in an international investment arbitration on State conduct, within international investment law.'
        self.assertIn('investment', es.conflict_faults(package, [{'matter_id': 'm1', 'text': text}])[0])
        clean = 'We acted in an international arbitration on State conduct, framed within international investment law.'
        self.assertEqual(es.conflict_faults(package, [{'matter_id': 'm1', 'text': clean}]), [])

    def test_a_procedural_outcome_is_not_the_opening(self):
        text = 'The Arbitration Tribunal determined that it had no jurisdiction. We analysed State conduct.'
        self.assertTrue(es.opening_faults(self.PACKAGE, [{'matter_id': 'm1', 'text': text}]))
        good = 'We analysed State conduct affecting major infrastructure works. The tribunal later declined jurisdiction.'
        self.assertEqual(es.opening_faults(self.PACKAGE, [{'matter_id': 'm1', 'text': good}]), [])

    def test_register_reads_conflicts_and_the_sheet_carries_them(self):
        self.assertIn('material_conflicts', case_register.MatterFacts.model_fields)
        self.assertIn("matter['contested_facts']", inspect.getsource(case_register))
        sheet = fact_sheet.build(self.PACKAGE, {})
        self.assertEqual(sheet['clients'][0]['contested_facts'][0]['subject'], 'arbitral forum')

    def test_a_v1_register_stays_readable_but_a_new_generation_reads_conflicts(self):
        self.assertEqual(case_register.VERSION, 'case-register-v2')
        saved = {'version': 'case-register-v1', 'method': 'model', 'clients': {}, 'matters': {'m1': {'leads': [], 'team': []}}, 'lawyers': {}}
        self.assertIs(case_register.current({'case_register': saved, 'matters': []}), saved)

    def test_the_register_compares_form_answers_with_the_narrative(self):
        self.assertIn('cross_border_cell', case_register.MatterFacts.model_fields['material_conflicts'].description)
        self.assertIn('Report it even when an expert could reconcile', case_register.MatterFacts.model_fields['material_conflicts'].description)
        self.assertIn('ICC in Paris', case_register.matter_sources({'crossBorder': 'Yes. Arbitration at the ICC in Paris.'}))

    def test_writers_receive_the_opening_and_significance_rules(self):
        self.assertIn('never the opening', ec.MATTER_TASK)
        self.assertIn('routine filing, registration or permit', ec.MATTER_TASK)
        self.assertIn('an adverse, procedural or jurisdictional outcome is stated after the work', MatterDraft.model_fields['text'].description)


class Rubric(unittest.TestCase):
    def test_the_rubric_reads_a_saved_run_without_calling_a_model(self):
        from evals import editorial_rubric as r
        self.assertEqual(len(r.CRITERIA), 8)
        payload = r.view({'chambersData': {'original_b10': 'o', 'lawyers': [{'name': 'Ana Ruiz', 'current_ranking': 'Ranked'}],
                                           'editorial_development': {'b10': 'b', 'c2': 'c', 'candidates': [], 'matters': []}}})
        self.assertEqual(payload['declared_rankings'], {'Ana Ruiz': 'Ranked'})
        self.assertLess(r.estimate(payload)[1], 0.3)


if __name__ == '__main__':
    unittest.main()
