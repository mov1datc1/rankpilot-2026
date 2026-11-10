import copy
import unittest
from unittest.mock import patch
from test_field_review import state
from core.development_delivery import retain_complete_development
from core.editorial_development import develop


class CompleteDevelopmentDeliveryTests(unittest.TestCase):
    def test_initial_contract_exhaustion_continues_through_all_field_reviews_without_third_repair(self):
        from core.field_review import advance, units_for
        from test_field_review import verdict
        s=self.fixture();s.pop('field_review_attempts')
        s['repair_report'].update(surgical_retries=1,residual_requests=1,retry_paths=['candidates/0'])
        before=copy.deepcopy(s['development']);calls=[]
        s.update(develop(s))
        self.assertFalse(s['development_delivery_ready'])
        self.assertEqual(s['repair_continuation']['phase'],'review')
        def review(current,role,schema,instruction,payload):
            self.assertEqual(role,'field_reviewer')
            calls.extend(u['field'] for u in payload['units'])
            return verdict(payload['units']),current['trace']+[{'role':role,'usage':{'total_tokens':11}}]
        with patch('core.review_graph.invoke_role',side_effect=review):
            for _ in range(20):
                s.update(advance(s))
                if not s.get('repair_continuation'):break
        self.assertTrue(s['development_delivery_ready'])
        self.assertFalse(s['development_validated'])
        self.assertEqual(set(calls),{u['field'] for u in units_for(s)})
        self.assertEqual(len(calls),len(set(calls)))
        self.assertEqual(s['development'],before)
        self.assertTrue(s['development_observations'])

    def test_unattempted_local_residual_cannot_claim_exhaustion(self):
        for changes in [{'retry_paths':[]},{'residual_requests':0},{'surgical_retries':0}]:
            s=self.fixture();s.pop('field_review_attempts')
            s['repair_report'].update(surgical_retries=1,residual_requests=1,retry_paths=['candidates/0'])
            s['repair_report'].update(changes)
            self.assertIsNone(retain_complete_development(s))

    def test_semantic_observation_can_finish_alongside_existing_local_binding_observation(self):
        from core.field_review import retain_observations, units_for, project_checks
        from test_field_review import verdict
        s=self.fixture();s['development_observations']=['placeholder']
        from core.editorial_development import development_errors
        s['development_observations']=development_errors(s['package'],s['strategy'],s['development'])
        units=units_for(s);target=units[0]['field']
        receipts,defects=project_checks(units,verdict(units,target))
        s.update(field_review_receipts=receipts,field_review_failures=defects)
        result=retain_observations(s)
        self.assertTrue(result['development_delivery_ready'])
        self.assertFalse(result['development_validated'])
        self.assertFalse(result.get('repair_continuation'))
        self.assertEqual(len(result['field_review_observations']),1)

    def fixture(self):
        s=state()
        s['development']['candidates'][0]['submission_case_coverage'][0]['public_quote']='An outdated internal binding.'
        s.update(selection_validated=True,selection_review_validated=True,
            delivery_observations_requested=True,errors=[],
            field_review_attempts={'candidates/0':2},
            repair_report={'failed_paths':['candidates/0'],'unresolved':[]},
            trace=[{'usage':{'total_tokens':17}}])
        return s

    def test_exhausted_internal_binding_reaches_assembly_without_calls_or_false_approval(self):
        s=self.fixture();before=copy.deepcopy(s)
        with patch('core.review_graph.invoke_role',side_effect=AssertionError('No third correction')):
            result=develop(s)
        self.assertTrue(result['development_delivery_ready'])
        self.assertFalse(result['development_validated'])
        self.assertTrue(any('B9' in e for e in result['development_observations']))
        self.assertEqual(result['development'],before['development'])
        self.assertFalse(result.get('delivery_observations_requested'))
        self.assertFalse(result.get('repair_continuation'))
        self.assertEqual(s,before)

    def test_automatic_terminal_boundary_retains_the_same_findings(self):
        s=self.fixture();s.pop('delivery_observations_requested')
        result=retain_complete_development(s,{'errors':['An internal binding remains invalid.']})
        self.assertTrue(result['development_delivery_ready'])
        self.assertEqual(result['errors'],[])
        self.assertIsNone(retain_complete_development(s,{'errors':[]}))

    def test_incomplete_foreign_or_unknown_content_is_not_advertised_as_assemblable(self):
        changes=[lambda s:s['development'].update(b10=''),
            lambda s:s['development'].update(matters=[]),
            lambda s:s['development']['matters'].append(copy.deepcopy(s['development']['matters'][0])),
            lambda s:s['development']['candidates'][0].update(name='Foreign person'),
            lambda s:s['development']['candidates'][0].update(submission_bio=''),
            lambda s:s.update(trace=[{'usage':{'unknown_calls':1}}]),
            lambda s:s.update(selection_review_validated=False),
            lambda s:s.update(development_reusable=False),
            lambda s:s.update(field_review_attempts={'candidates/0':1}),
            lambda s:s.update(repair_continuation={'pending_groups':['candidates/0']}),
            lambda s:s['repair_report'].update(unresolved=['A source answer is needed'])]
        for change in changes:
            s=self.fixture();change(s)
            self.assertIsNone(retain_complete_development(s))
        with patch('core.public_privacy.public_privacy_findings',return_value=[{'path':'b10'}]):
            self.assertIsNone(retain_complete_development(self.fixture()))

    def test_release_keeps_the_unrepaired_observation_after_assembly_permission(self):
        from core.review_graph import release_gate
        s=self.fixture();s.update(retain_complete_development(s))
        result=release_gate(s,require_judge=False)
        self.assertFalse(result['release_verdict']['passed'])
        self.assertTrue(any('B9' in e for e in result['release_verdict']['errors']))
