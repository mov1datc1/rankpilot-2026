import copy
import unittest
from core.source_aliases import grounded_spelling_alias
from core.review_graph import calibrate_verdict


class SourceAliasTests(unittest.TestCase):
    def setUp(self):
        self.names = ['Example Engineering Manufactury', 'Example Engineering & Manufacturing']
        self.package = {
            'matters': [{'id': 'm', 'client': self.names[0],
                         'rawNotes': self.names[1] + ', a manufacturer, retained the firm for a labour mandate.'}],
            'rendered_audit': self.names[0] + ' is selected.'}
        self.defect = {'code': 'SOURCE_CONFLICT', 'severity': 'critical', 'scope': 'letter',
                       'matter_id': 'm', 'field_path': 'client', 'conflict_basis': 'source_vs_source',
                       'conflict_resolution': 'preserve_source_aliases', 'alias_basis': 'same_party_spelling',
                       'source_aliases': self.names, 'source_quote': '\n'.join(self.names),
                       'artifact_quote': self.package['rendered_audit'],
                       'message': 'Identify both attested spellings in the internal Audit.'}

    def test_selected_same_party_alias_is_software_work_without_source_rewrite_or_approval(self):
        before = copy.deepcopy(self.package)
        result = calibrate_verdict({'passed': False, 'defects': [self.defect]}, self.package,
                                   {'matters': [{'matter_id': 'm', 'disposition': 'core'}]})
        self.assertTrue(grounded_spelling_alias(self.defect, self.package))
        self.assertEqual(result['defects'][0]['owner'], 'rankpilot')
        self.assertEqual(result['defects'][0]['severity'], 'critical')
        self.assertFalse(result['passed'])
        self.assertEqual(self.package, before)

    def test_missing_semantic_assessment_or_wrong_record_cannot_use_similarity(self):
        for change in [{'alias_basis': None}, {'alias_basis': 'different_or_uncertain_party'},
                       {'source_aliases': self.names[:1]}, {'matter_id': 'other'},
                       {'source_aliases': [self.names[0], 'Invented Engineering Manufacturing']}]:
            with self.subTest(change=change):
                self.assertFalse(grounded_spelling_alias({**self.defect, **change}, self.package))

    def test_legal_entities_geography_and_materially_different_names_stay_unresolved(self):
        for names in [('Example Engineering Ltd', 'Example Engineering LLC'),
                      ('Example Engineering North', 'Example Engineering South'),
                      ('Example Engineering Manufacturing UK', 'Example Engineering Manufacturing DE'),
                      ('Example Engineering Manufactury', 'Example Engineering Mining')]:
            package = {**self.package, 'matters': [{'id': 'm', 'client': names[0], 'rawNotes': names[1]}]}
            defect = {**self.defect, 'source_aliases': list(names)}
            self.assertFalse(grounded_spelling_alias(defect, package))
            result = calibrate_verdict({'passed': False, 'defects': [defect]}, package)
            self.assertEqual(result['defects'][0]['owner'], 'user')
            self.assertFalse(result['passed'])

    def test_alias_cannot_repair_roles_values_or_a_fabricated_output_quote(self):
        for change in [{'field_path': 'role'}, {'field_path': 'value'}, {'scope': 'facts'},
                       {'artifact_quote': 'Absent quotation'}, {'conflict_resolution': 'confirm_source'}]:
            result = calibrate_verdict({'passed': False, 'defects': [{**self.defect, **change}]}, self.package)
            self.assertEqual(result['defects'][0]['owner'], 'user')
            self.assertFalse(result['passed'])

    def test_accents_punctuation_and_connector_do_not_create_a_different_party(self):
        names = ['Éxample Engineering', 'Example & Engineering']
        package = {'matters': [{'id': 'm', 'client': names[0], 'source_excerpt': names[1]}]}
        self.assertTrue(grounded_spelling_alias({**self.defect, 'source_aliases': names}, package))
