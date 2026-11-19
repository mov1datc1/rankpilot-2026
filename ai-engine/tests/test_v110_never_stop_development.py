"""v1.0.110: a correction that cannot be applied becomes an observation; the case continues."""
import unittest
from core.prose_rules import natural_lead
from core.editorial_voice import voice_matches
from core.development_delivery import retain_complete_development


def _fixture():
    from test_development_delivery import CompleteDevelopmentDeliveryTests
    return CompleteDevelopmentDeliveryTests().fixture()


class ParticipationWordingIsFixedInCode(unittest.TestCase):
    def test_listed_as_a_team_member_becomes_natural_wording_with_the_same_facts(self):
        text='Ana Prado is listed as a team member on the litigation engagement. She is also listed as a team member on two further mandates.'
        self.assertTrue(voice_matches(text))
        fixed=natural_lead(text)
        self.assertEqual(fixed,'Ana Prado is a team member on the litigation engagement. She is also a team member on two further mandates.')
        self.assertEqual(voice_matches(fixed),[])
        self.assertEqual(natural_lead('They were recorded as members of the team.'),'They were members of the team.')
        kept='Ana is a partner and a member of the bar.'
        self.assertEqual(natural_lead(kept),kept)


class UnresolvedCorrectionNeverStopsTheCase(unittest.TestCase):
    def test_a_correction_the_repairer_cannot_apply_is_retained_as_an_observation(self):
        s=_fixture()
        s['repair_report'].update(unresolved=['The rejected phrase overlaps a passage that must be preserved verbatim.'])
        s['field_review_attempts']={}
        retained=retain_complete_development(s)
        self.assertIsNotNone(retained)
        # The case continues to the independent field review instead of stopping,
        # and the unapplied correction stays visible as an observation.
        self.assertEqual((retained.get('repair_continuation') or {}).get('phase'),'review')
        self.assertTrue(retained.get('development_observations'))
        self.assertFalse(retained.get('development_validated'))

    def test_incomplete_or_unsafe_proposals_still_do_not_pass(self):
        from unittest.mock import patch
        s=_fixture();s['repair_report'].update(unresolved=['x']);s['development'].update(b10='')
        self.assertIsNone(retain_complete_development(s))
        s=_fixture();s['repair_report'].update(unresolved=['x'])
        with patch('core.public_privacy.public_privacy_findings',return_value=[{'path':'b10'}]):
            self.assertIsNone(retain_complete_development(s))


if __name__=='__main__':unittest.main()
