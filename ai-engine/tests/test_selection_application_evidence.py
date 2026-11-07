from selection_answer_fixture import repair_answer
"""Application policy can repair a wrong gate, never authenticate legal facts."""
import copy
import unittest
from unittest.mock import patch
from core.selection_review import review_selection, can_repair_selection
from core.review_graph import create_review_graph, BASE
from utils.review_policy import APPLICATION_RULES

RULE = APPLICATION_RULES['restricted_confidential_delivery']
SOURCE = 'The firm designed employment agreements and regulatory compliance procedures.'
MATTER = {'id': 'm1', 'client': 'Fictional Employer', 'source_excerpt': SOURCE,
          'publish_status': 'confirmation_required', 'confidentialityConfirmed': False,
          'publication_route': 'E', 'resolved_publication_status': 'confirmation_required'}
DECISION = {'matter_id': 'm1', 'disposition': 'core', 'source_quote': SOURCE,
            'legal_understanding': 'Employment compliance work.',
            'rationale': 'It cannot be delivered until the user confirms publication.'}
PACKAGE = {'delivery_policy': 'restricted-unconfirmed-v1', 'matters': [MATTER]}
STRATEGY = {'matters': [DECISION], 'hero_matter_id': 'm1', 'pending_questions': [], 'thesis': 'Employment'}


def diagnosis(**changes):
    return {'status': 'repair_required', 'explanation': 'Confidential delivery remains permitted without public consent.',
            'evidence_kind': 'application_rule', 'rule_id': 'restricted_confidential_delivery',
            'rule_quote': RULE, 'source_quote': '', 'decision_quote': DECISION['rationale'], **changes}


def run(package=PACKAGE, check=None):
    return review_selection({'package': package, 'strategy': STRATEGY},
                            lambda *args: ({'checks': {'M01': check or diagnosis()}}, [{'usage': {'total_tokens': 123}}]))


class SelectionApplicationEvidenceTests(unittest.TestCase):
    def test_invalid_diagnosis_rechecks_once_then_repairs_within_three_real_reviews(self):
        corrected={**DECISION,'rationale':'Distinct supported employment compliance work.'}
        calls=[]
        def invoke(state,role,*args):
            calls.append(role)
            if role=='strategist':
                return repair_answer(args[-1] if 'args' in locals() else payload,[corrected]),[]
            attempt=calls.count(role)
            check=diagnosis(evidence_kind='source',rule_id=None,rule_quote='',source_quote='"publication_route":"E"') if attempt==1 else diagnosis() if attempt==2 else {'status':'supported','source_quote':'','explanation':'Supported work.'}
            return {'checks':{'M01':check}},[]
        before=copy.deepcopy(PACKAGE)
        with patch('core.review_graph.strategist',return_value={'strategy':STRATEGY,'errors':[]}),patch('core.review_graph.invoke_role',side_effect=invoke):
            result=create_review_graph().invoke({'package':PACKAGE,'operation':'strategy'})
        self.assertEqual(calls,['selection_reviewer','selection_reviewer','strategist','selection_reviewer'])
        self.assertEqual(result['selection_review_attempts'],3)
        self.assertEqual(result['selection_diagnostic_rechecks'],1)
        self.assertTrue(result['selection_review_validated'])
        self.assertEqual(PACKAGE,before)
        self.assertNotIn('approved_artifact',result)

    def test_deferral_does_not_consume_the_diagnostic_recheck_and_transport_does_not_repeat(self):
        from core.review_graph import run_editorial_stage,SelectionReviewDeferred
        calls=[]
        def invoke(state,role,*args):
            calls.append(role)
            if len(calls)==1:
                return {'checks':{'M01':diagnosis(source_quote='Invented original claim.')}},[]
            if len(calls)==2:
                raise SelectionReviewDeferred('No request started')
            return {'checks':{'M01':{'status':'supported','source_quote':'','explanation':'Supported.'}}},[]
        with patch('core.review_graph.strategist',return_value={'strategy':STRATEGY,'errors':[]}) as select,patch('core.review_graph.invoke_role',side_effect=invoke):
            saved=run_editorial_stage('strategy',{'package':PACKAGE})
            self.assertTrue(saved['selection_review_deferred'])
            self.assertTrue(saved['selection_diagnostic_invalid'])
            self.assertEqual(saved['selection_diagnostic_rechecks'],0)
            self.assertEqual(saved['selection_review_attempts'],1)
            result=run_editorial_stage('strategy',saved)
        select.assert_called_once()
        self.assertEqual(result['selection_diagnostic_rechecks'],1)
        self.assertEqual(result['selection_review_attempts'],2)
        self.assertTrue(result['selection_review_validated'])
        from core.selection_review import can_recheck_selection_diagnostic
        self.assertFalse(can_recheck_selection_diagnostic({**saved,'selection_review_deferred':False,'trace':[{'usage':{'unknown_calls':1}}]}))

    def test_a_fourth_semantic_review_is_never_purchased(self):
        from core.review_graph import selection_review
        for valid in (False,True):
            with patch('core.review_graph.invoke_role') as model:
                result=selection_review({'package':PACKAGE,'strategy':STRATEGY,'selection_review_attempts':3,'selection_review_validated':valid,'selection_validated':valid,'trace':[{'usage':{'total_tokens':123}}]})
            model.assert_not_called()
            self.assertEqual(result['selection_review_validated'],valid)
            self.assertEqual(result['trace'][0]['usage']['total_tokens'],123)

    def test_valid_application_diagnosis_can_reach_repair_without_consent_or_approval(self):
        before = copy.deepcopy(PACKAGE)
        result = run()
        self.assertFalse(result['selection_review_validated'])
        self.assertFalse(result['selection_review_unavailable'])
        self.assertTrue(can_repair_selection(result))
        check = result['selection_feedback']['failed_checks']['m1']
        self.assertEqual(check['rule_quote'], RULE)
        self.assertEqual(check['source_quote'], '')
        self.assertTrue(check['evidence_bound'])
        self.assertEqual(PACKAGE, before)
        self.assertFalse(PACKAGE['matters'][0]['confidentialityConfirmed'])

    def test_rule_cannot_bind_outside_its_exact_policy_and_same_matter_route(self):
        packages = [{**PACKAGE, 'delivery_policy': None}, {**PACKAGE, 'delivery_policy': 'other-policy'}]
        packages += [{**PACKAGE, 'matters': [{**MATTER, **change}]} for change in
                     ({'publication_route': 'D'}, {'resolved_publication_status': 'publishable'},
                      {'resolved_publication_status': 'unknown'})]
        for package in packages:
            with self.subTest(package=package):
                result = run(package)
                self.assertTrue(result['selection_review_unavailable'])
                self.assertFalse(can_repair_selection(result))
                self.assertFalse(result['selection_validated'])

    def test_mixed_invented_or_mistyped_authority_stops_without_buying_repair(self):
        bad = [diagnosis(source_quote=SOURCE), diagnosis(rule_quote='A made-up rule.'),
               diagnosis(rule_id=None), diagnosis(evidence_kind='source'),
               diagnosis(decision_quote='Words from another decision.'),
               diagnosis(evidence_kind='source', rule_id=None, rule_quote='',
                         source_quote='"publication_route":"E","resolved_publication_status":"confirmation_required"')]
        for check in bad:
            with self.subTest(check=check):
                result = run(check=check)
                self.assertTrue(result['selection_review_unavailable'])
                self.assertFalse(result['selection_review_validated'])
                self.assertFalse(can_repair_selection(result))
                self.assertEqual(result['trace'][0]['usage']['total_tokens'], 123)
                self.assertEqual(result['selection_review_attempts'], 1)

    def test_repair_and_reviewer_receive_the_same_policy_and_preserve_sources(self):
        before = copy.deepcopy(PACKAGE)
        corrected = {**DECISION, 'rationale': 'Distinct supported employment compliance work.'}
        calls = []
        def invoke(state, role, schema, instruction, payload):
            calls.append(role)
            self.assertEqual(payload['delivery_policy'], 'restricted-unconfirmed-v1')
            self.assertEqual(payload['application_rules']['restricted_confidential_delivery'], RULE)
            if role == 'strategist':
                return repair_answer(payload,[corrected]), []
            if calls.count(role) == 1:
                return {'checks': {'M01': diagnosis()}}, []
            return {'checks': {'M01': {'status': 'supported', 'source_quote': '', 'explanation': 'Supported work.'}}}, []
        with patch('core.review_graph.strategist', return_value={'strategy': STRATEGY, 'errors': []}), \
             patch('core.review_graph.invoke_role', side_effect=invoke):
            result = create_review_graph().invoke({'package': PACKAGE, 'operation': 'strategy'})
        self.assertEqual(calls, ['selection_reviewer', 'strategist', 'selection_reviewer'])
        self.assertTrue(result['selection_review_validated'])
        self.assertEqual(PACKAGE, before)
        self.assertNotIn('approved_artifact', result)

    def test_old_saved_decision_requirement_is_not_in_the_model_policy(self):
        self.assertIn(RULE, BASE)
        self.assertNotIn('absent or conflicting flags require a saved user decision', BASE)
        self.assertNotIn('Publication permission and unresolved monetary identity still require', BASE)
