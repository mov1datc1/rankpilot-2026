import sys
import json
import tempfile
import unittest
from pathlib import Path

AI_ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_ENGINE))

from utils.rag_router import RAGRouter  # noqa: E402


class RAGRouterTests(unittest.TestCase):
    def test_production_context_quarantines_historical_client_blueprints(self):
        router=RAGRouter()
        for task in ('development narrative', 'writer leadership', 'editor preservation', 'strategist selection'):
            chunks=router.retrieve('Labour & Employment','Chambers','Mexico',task=task)
            sources={c.source for c in chunks}
            self.assertEqual(sources,{'Editorial_Methodology_Scoped.txt',
                'Lawyer_Leadership_Methodology_Scoped.txt','Labour_Editorial_Methodology_Scoped.txt'})
            text='\n'.join(c.text for c in chunks)
            for leaked in ('Schaeffler','DeForest','Vitesco','4 states','BRL 8M',
                           'Supreme Editorial Law','ALWAYS outperform','Partner X led'):
                self.assertNotIn(leaked,text)
            self.assertIn('firm\'s voice',text)
            self.assertIn('internal Audit',text)
            self.assertIn('who performed a specific action',text)
        for entry in router.catalog['quarantined_documents']:
            self.assertTrue((Path(router.knowledge_dir)/entry['source']).exists())

    def test_routes_chunks_and_exposes_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "Real_Estate_Methodology.txt").write_text(
                "# Category fit\n\nReal estate matters require property evidence.\n\n# Outcomes\n\nDistinguish interim relief from final judgments.", encoding="utf-8"
            )
            (root / "Corporate_MA_Methodology.txt").write_text("M&A acquisition method only.", encoding="utf-8")
            (root / "rag_catalog.v2.json").write_text(json.dumps({"version":"test", "documents":[{"source":"Real_Estate_Methodology.txt","practice":"real_estate","directory":"chambers","tier":"reference","approval":"project_reference_only"}]}))
            router = RAGRouter(directory)
            context = router.get_rag_context("Real Estate", "Chambers")
            self.assertIn("NOT SUBMISSION EVIDENCE", context)
            self.assertIn("Real_Estate_Methodology.txt", context)
            self.assertNotIn("M&A acquisition method only", context)
            self.assertTrue(router.get_rag_manifest()[0]["chunk_id"].startswith("rag-"))


if __name__ == "__main__":
    unittest.main()
