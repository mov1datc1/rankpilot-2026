"""v1.0.111: one delivery guarantee. A complete, privacy-safe draft is delivered with observations."""
import unittest
from unittest.mock import patch
from core.development_delivery import guaranteed_delivery


def fixture():
    from test_development_delivery import CompleteDevelopmentDeliveryTests
    s=CompleteDevelopmentDeliveryTests().fixture()
    s['field_review_attempts']={}  # no exhaustion bookkeeping at all
    s['repair_report'].update(unresolved=['A correction the repairer could not apply.'])
    return s


class DeliveryGuarantee(unittest.TestCase):
    def test_complete_private_safe_draft_is_delivered_with_observations(self):
        result=guaranteed_delivery(fixture())
        self.assertIsNotNone(result)
        self.assertTrue(result['development_delivery_ready']);self.assertFalse(result['development_validated'])
        self.assertEqual(result['errors'],[])
        self.assertTrue(any('no aplicable' in o for o in result['development_observations']))

    def test_legitimate_reasons_still_stop(self):
        for change in (lambda s:s['development'].update(b10=''),
                       lambda s:s['development'].update(matters=[]),
                       lambda s:s['development']['candidates'][0].update(name='Foreign person'),
                       lambda s:s.update(trace=[{'usage':{'unknown_calls':1}}]),
                       lambda s:s.update(selection_review_validated=False)):
            s=fixture();change(s)
            self.assertIsNone(guaranteed_delivery(s))
        with patch('core.public_privacy.public_privacy_findings',return_value=[{'path':'b10'}]):
            self.assertIsNone(guaranteed_delivery(fixture()))

    def test_develop_uses_the_guarantee_when_other_routes_cannot_retain(self):
        from core.editorial_development import develop
        s=fixture();s['delivery_observations_requested']=True
        with patch('core.development_delivery.retain_complete_development',return_value=None), \
             patch('core.field_review.retain_observations',return_value={'errors':['No se pudo completar la redacción; el avance está guardado.']}), \
             patch('core.review_graph.invoke_role',side_effect=AssertionError('no new generation')):
            result=develop(s)
        self.assertTrue(result['development_delivery_ready']);self.assertEqual(result['errors'],[])
        self.assertEqual(result['delivery_guarantee'],'complete_proposal_with_observations')


if __name__=='__main__':unittest.main()
