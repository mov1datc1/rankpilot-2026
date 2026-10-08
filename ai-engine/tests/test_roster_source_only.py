import unittest
from utils.doc_parser import DocumentParser

class RosterSourceOnlyTests(unittest.TestCase):
    def test_shared_first_name_and_surname_do_not_merge_distinct_people(self):
        text='Name | E-mail | Partner Since | Comments\nJose Alberto Diaz | a@example.test | 2020 | Handles disputes.\nJose Luis Diaz | b@example.test |  | Handles compliance.\nComposition of the department:\n'
        roster=DocumentParser.extract_lawyer_roster(text)
        self.assertEqual([l['name'] for l in roster],['Jose Alberto Diaz','Jose Luis Diaz'])
        self.assertTrue(roster[0]['isPartner']);self.assertIsNone(roster[1]['isPartner'])
    def test_firm_name_cannot_inject_people_or_roles(self):
        self.assertEqual(DocumentParser.extract_lawyer_roster('DeForest Labour & Employment practice.'),[])
    def test_known_name_cannot_inject_proposed_ranking(self):
        text='B9 Information regarding Ranked and Unranked lawyers\nName | Comments | Partner | Ranked\nEduardo Garduño | Source biography | Y | N\nB10 Department'
        roster=DocumentParser.extract_lawyer_roster(text)
        self.assertEqual(len(roster),1);self.assertIsNone(roster[0]['suggestedRank'])
    def test_legacy_cell_separator_preserves_whole_names_and_explicit_flags(self):
        text='B9 Information regarding Ranked and Unranked lawyers\nName\nComments or Web Link\nPartner Y/N\nRanked Y/N\nMaría Alejandra García Nieto\x07HYPERLINK "https://example.com/person" https://example.com/person\nN\nN\nB10 What is this department best known for?'
        roster=DocumentParser.extract_lawyer_roster(text)
        self.assertEqual(len(roster),1);self.assertEqual(roster[0]['name'],'María Alejandra García Nieto')
        self.assertFalse(roster[0]['isPartner']);self.assertFalse(roster[0]['isRanked'])
    def test_missing_rank_flag_not_inferred_from_link(self):
        text='B9 Information regarding Ranked and Unranked lawyers\nSofia Vega | https://chambers.com/lawyer/sofia\nY\nB10 Department'
        roster=DocumentParser.extract_lawyer_roster(text)
        self.assertIsNone(roster[0]['isRanked']);self.assertIsNone(roster[0]['current_ranking'])
    def test_multiline_table_cells_do_not_end_roster_at_first_blank_line(self):
        text='Name | E-mail | Partner Since | Comments\nSofia Vega | sofia@example.test | 2020 | Handles disputes.\n\nShe lectures at universities.\n\nLuis Perez | luis@example.test |  | Advises on compliance.\nComposition of the department:\n'
        roster=DocumentParser.extract_lawyer_roster(text)
        self.assertEqual([l['name'] for l in roster],['Sofia Vega','Luis Perez'])
        self.assertIn('lectures',roster[0]['bio']);self.assertTrue(roster[0]['isPartner'])
        self.assertIsNone(roster[1]['isPartner']);self.assertIsNone(roster[1]['isRanked'])
