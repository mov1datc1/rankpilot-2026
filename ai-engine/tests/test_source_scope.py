import unittest
from utils.source_scope import source_scope

class SourceScopeTests(unittest.TestCase):
    def test_literal_declarations(self):
        result=source_scope('A2 Practice Area\nTax\nA3 Location (Jurisdiction)\nMexico\nDirectory: Chambers')
        self.assertEqual(result['practice_area'],{'value':'Tax','quote':'A2 Practice Area\nTax'})
        self.assertEqual(result['jurisdiction']['value'],'Mexico')
        self.assertEqual(result['directory']['value'],'Chambers')

    def test_narrative_mentions_are_not_scope(self):
        self.assertEqual(source_scope('Advised a Chilean client in Mexico on a tax dispute.\nChambers research involves interviews.'),{})

    def test_next_header_is_not_a_field_value(self):
        result=source_scope('Practice Area\nCountry: Mexico')
        self.assertNotIn('practice_area',result)
        self.assertEqual(result['jurisdiction']['value'],'Mexico')

    def test_spanish_labels(self):
        result=source_scope('Área de práctica: Laboral\nJurisdicción: México')
        self.assertEqual(result['practice_area']['value'],'Laboral')
        self.assertEqual(result['jurisdiction']['value'],'México')

    def test_rag_rejects_other_jurisdictions_and_editions(self):
        import tempfile
        import json
        from pathlib import Path
        from utils.rag_router import RAGRouter
        with tempfile.TemporaryDirectory() as folder:
            Path(folder,'local.txt').write_text('Tax method scoped to one jurisdiction and edition.\n' * 20)
            catalog={'version':'test','documents':[{'source':'local.txt','practice':'tax','directory':'chambers','jurisdiction':'Mexico','edition':'2026','tier':'reference','approval':'project_reference_only'}]}
            Path(folder,'rag_catalog.v2.json').write_text(json.dumps(catalog))
            router=RAGRouter(folder)
            router.catalog=catalog
            self.assertTrue(router.retrieve('Tax','Chambers','Mexico','2026'))
            self.assertEqual(router.retrieve('Tax','Chambers','Chile','2026'),[])
            self.assertEqual(router.retrieve('Tax','Chambers','Mexico','2025'),[])
            self.assertEqual(router.retrieve('Tax','Chambers'),[])
