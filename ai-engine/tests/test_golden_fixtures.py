import json
import unittest
from pathlib import Path


FIXTURES = Path(__file__).parent / "fixtures"


class GoldenFixtureTests(unittest.TestCase):
    def load_fixture(self, filename: str):
        return json.loads((FIXTURES / filename).read_text(encoding="utf-8"))

    def test_araquereyna_expected_invariants(self):
        fixture = self.load_fixture("araquereyna_31_08.json")
        self.assertEqual(
            {"total": 25, "publishable": 10, "confidential": 15},
            fixture["expected_manifest"],
        )
        self.assertEqual(6, len(fixture["ranked_lawyers"]))
        self.assertEqual("buyer", fixture["semantic_claims"][0]["client_role"])
        self.assertEqual("seller", fixture["semantic_claims"][0]["counterparty_role"])

    def test_ramos_expected_invariants(self):
        fixture = self.load_fixture("ramos_castillo_31_08.json")
        self.assertEqual(
            {"total": 33, "publishable": 20, "confidential": 13},
            fixture["expected_manifest"],
        )
        self.assertIn("national", fixture["objective"]["ranking_unit"].lower())
        self.assertTrue(fixture["hero"].startswith("El Cielo"))


if __name__ == "__main__":
    unittest.main()
