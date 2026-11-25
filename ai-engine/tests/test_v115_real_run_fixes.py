"""v1.0.115: four defects seen in the first real run of v1.0.114 (synthetic names)."""
import re
import unittest

from core.client_identity import client_aliases, is_legal_form
from core.editorial_development import AUDIT_VOICE
from core.personal_quality import own_directory_commentary, own_register_quote
from core.prose_rules import EXTRA_LEAD


def polish(text):
    for pattern, repl in EXTRA_LEAD:
        text = pattern.sub(repl, text)
    return re.sub(r'[ \t]{2,}', ' ', text)


class LegalFormIsNotAnIdentity(unittest.TestCase):
    def test_company_forms_are_never_aliases(self):
        for client, form in (('Editores Ejemplo, C.A.', 'C.A.'), ('Example Holdings, LLC', 'LLC'),
                             ('Servicios Ejemplo, S. de R.L. de C.V.', 'C.V.')):
            self.assertNotIn(form, client_aliases([client]))
        self.assertIn('Editores Ejemplo', client_aliases(['Editores Ejemplo, C.A.']))
        self.assertTrue(is_legal_form('S.A. de C.V.'))
        self.assertFalse(is_legal_form('SKF'))
        self.assertFalse(is_legal_form('Alfa'))


class RegisterVoice(unittest.TestCase):
    def test_listed_adjective_is_removed_and_facts_stay(self):
        self.assertEqual(polish('She is a listed lead partner on the mandate.'), 'She is a lead partner on the mandate.')
        self.assertEqual(polish('The sources support her listed leadership.'), 'The sources support her leadership.')
        self.assertEqual(polish('He is listed as a member of the matter team.'), 'He is a member of the matter team.')
        self.assertEqual(polish('She is listed in leadership roles on tax matters.'), 'She holds leadership roles on tax matters.')

    def test_attribution_reasoning_is_detected_in_public_prose(self):
        for text in ('She leads the matter, while the source attributes the advice to the department.',
                     'Her documented role is mandate leadership; the record assigns the work to the team.',
                     'The sources support her leadership and participation.'):
            self.assertTrue(AUDIT_VOICE.search(text), text)
        self.assertFalse(AUDIT_VOICE.search('She led the audit, which closed with a resolution for 1% of the assessment.'))


class OwnEvidence(unittest.TestCase):
    PACKAGE = {
        'lawyers': [{'name': 'Ana Ruiz Soto'}, {'name': 'Luis Mora Vega'}],
        'matters': [{'id': 'm1', 'leadPartner': 'Ana Ruiz (Senior Partner)', 'source_excerpt': 'E5 Lead partner\nAna Ruiz (Senior Partner)'},
                    {'id': 'm2', 'leadPartner': 'Luis Mora (Partner)', 'source_excerpt': 'E5 Lead partner\nLuis Mora (Partner)'}],
        'ranking_verification': {'profile_research': {'profiles': [
            {'status': 'retrieved', 'subject': {'kind': 'individual', 'name': 'Luis Mora Vega'},
             'commentary': [{'text': 'Luis Mora Vega is a well-known tax lawyer.'}]}]}},
    }

    def test_register_passage_naming_the_lawyer_is_own_evidence(self):
        self.assertTrue(own_register_quote('Ana Ruiz Soto', 'Ana Ruiz (Senior Partner)', self.PACKAGE))
        self.assertFalse(own_register_quote('Ana Ruiz Soto', 'Luis Mora (Partner)', self.PACKAGE))
        self.assertFalse(own_register_quote('Ana Ruiz Soto', 'Ana Ruiz (Managing Partner)', self.PACKAGE))

    def test_shared_short_name_is_not_accepted(self):
        package = dict(self.PACKAGE, lawyers=[{'name': 'Ana Ruiz Soto'}, {'name': 'Ana Ruiz Paz'}])
        self.assertFalse(own_register_quote('Ana Ruiz Soto', 'Ana Ruiz (Senior Partner)', package))

    def test_own_directory_commentary_only_for_that_person(self):
        quote = 'Luis Mora Vega is a well-known tax lawyer.'
        self.assertTrue(own_directory_commentary('Luis Mora Vega', quote, self.PACKAGE))
        self.assertFalse(own_directory_commentary('Ana Ruiz Soto', quote, self.PACKAGE))


if __name__ == '__main__':
    unittest.main()
