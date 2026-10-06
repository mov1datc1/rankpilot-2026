import sys
import json
import tempfile
import unittest
from pathlib import Path

AI_ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_ENGINE))

from utils.rag_router import RAGRouter  # noqa: E402


class RAGRouterTests(unittest.TestCase):
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
