import sys
import unittest
from pathlib import Path


AI_ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_ENGINE))

from core.contracts import (  # noqa: E402
    DocumentManifest,
    EvidenceClaim,
    EvidenceSupport,
    LawyerRecord,
    MatterRecord,
)
from utils.evidence_validation import (  # noqa: E402
    reconcile_lawyer_roster,
    reconcile_matter_register,
    validate_claim_grounding,
    validate_artifact_matter_register,
    validate_optimized_matter_text,
    validate_evidence_quotes,
)
from utils.doc_parser import DocumentParser  # noqa: E402
from utils.objective_alignment import (  # noqa: E402
    select_objective_aligned_hero,
    validate_thesis_objective,
    build_objective_aligned_thesis,
    build_source_backed_b10_positioning,
    repair_objective_conflicts,
)
from utils.language_guard import apply_epistemic_filter  # noqa: E402
from utils.canonical_builder import (  # noqa: E402
    infer_transaction_role,
    merge_lawyer_roster,
    reconcile_extracted_matters_to_source,
)


def matter(index: int, status: str = "publishable") -> MatterRecord:
    return MatterRecord(
        matter_id=f"matter-{index:02d}",
        source_label=f"{status.title()} Matter {index}",
        publish_status=status,
        client=f"Client {index}",
    )


class EvidenceContractTests(unittest.TestCase):
    def test_legacy_doc_text_count_is_exact(self):
        text = """
        Publishable Matter 1
        Publishable Matter 2
        Confidential Matter 1
        Confidential Matter 2
        Confidential Matter 2
        """
        result = DocumentParser._count_matter_labels_in_text(text)
        self.assertEqual(4, result["total"])
        self.assertEqual(2, result["publishable"])
        self.assertEqual(2, result["confidential"])

    def test_numbered_sections_preserve_verbatim_text(self):
        text = """
Publishable Matter 1
D1 Name of client
Gruppo Montenegro
D2 Summary
Advised Gruppo Montenegro on its acquisition of Pampero from Diageo.
Confidential Matter 1
E1 Name of client
Confidential client
"""
        sections = DocumentParser.extract_numbered_matter_sections(text)
        self.assertIn("publishable matter 1", sections)
        self.assertIn(
            "acquisition of Pampero from Diageo",
            sections["publishable matter 1"]["text"],
        )
        self.assertNotIn(
            "Confidential client",
            sections["publishable matter 1"]["text"],
        )

    def test_c2_source_extraction_does_not_cross_into_matters(self):
        text = """C2 Feedback on our coverage | The guide should address the new regulatory category.
C3 Referee information
Names omitted
Publishable Matter 1
Client 1
"""
        c2 = DocumentParser.extract_c2_source(text)
        self.assertIn("new regulatory category", c2)
        self.assertNotIn("Client 1", c2)

    def test_c2_stops_before_work_highlights_heading(self):
        text = """C2 Feedback on our coverage
Specific source-backed feedback.
WORK HIGHLIGHTS AND CLIENTS
Provide up to 20 matters.
"""
        self.assertEqual(
            "Specific source-backed feedback.",
            DocumentParser.extract_c2_source(text),
        )

    def test_missing_c2_remains_blank(self):
        self.assertEqual("", DocumentParser.extract_c2_source("Publishable Matter 1\nClient"))

    def test_c2_collapses_exact_content_control_repetition(self):
        text = "C2 Feedback on our coverage\nSource answer.Source answer.Source answer.\nC3 Next"
        self.assertEqual("Source answer.", DocumentParser.extract_c2_source(text))

    def test_lawyer_roster_recovers_ranked_and_unranked_rows(self):
        text = """Information regarding Ranked and Unranked lawyers in this practice area.
Pedro I Sosa Mendoza
https://chambers.com/lawyer/pedro-ignacio-sosa-mendoza-latin-america-9:1
Juan José Figueroa
https://firm.example/juan-jose-figueroa
B10 What is this department best known for?
"""
        roster = DocumentParser.extract_lawyer_roster(text)
        self.assertEqual(2, len(roster))
        self.assertTrue(roster[0]["is_ranked"])
        self.assertFalse(roster[1]["is_ranked"])

    def test_deterministic_lawyer_roster_overrides_model_omission(self):
        source = [
            {"name": "Pedro I Sosa Mendoza", "is_ranked": True, "current_ranking": "Ranked"},
            {"name": "Juan José Figueroa", "is_ranked": False, "current_ranking": None},
        ]
        merged = merge_lawyer_roster(source, [{"name": "Pedro I Sosa Mendoza", "is_ranked": False}])
        self.assertEqual(2, len(merged))
        self.assertTrue(merged[0]["is_ranked"])
        self.assertEqual("Juan José Figueroa", merged[1]["name"])

    def test_numbered_register_drops_unsupported_26th_record(self):
        source = """Publishable Matter 1
Client A acquisition
Confidential Matter 1
Client B restructuring
"""
        reconciled, report = reconcile_extracted_matters_to_source(
            [
                {"source_label": "Publishable Matter 1", "client": "Client A"},
                {"source_label": "Confidential Matter 1", "client": "Client B"},
                {"source_label": "Publishable Matter 11", "client": "Unsupported"},
            ],
            ["Publishable Matter 1", "Confidential Matter 1"],
            source,
        )
        self.assertTrue(report["passed"])
        self.assertEqual(2, len(reconciled))
        self.assertEqual(["Publishable Matter 11"], report["dropped_records"])
        self.assertEqual("confidential", reconciled[1]["publish_status"])

    def test_numbered_register_fails_when_real_label_is_missing(self):
        reconciled, report = reconcile_extracted_matters_to_source(
            [{"source_label": "Publishable Matter 1", "client": "Client A"}],
            ["Publishable Matter 1", "Publishable Matter 2"],
            "Publishable Matter 1\nClient A\nPublishable Matter 2\nClient B",
        )
        self.assertFalse(report["passed"])
        self.assertEqual(["Publishable Matter 2"], report["missing_labels"])
        self.assertEqual(1, len(reconciled))

    def test_exact_matter_reconciliation_passes(self):
        manifest = DocumentManifest(
            source_sha256="a" * 64,
            source_format="docx",
            total_matters=2,
            publishable_matters=1,
            confidential_matters=1,
            matter_labels=["Publishable Matter 1", "Confidential Matter 1"],
        )
        result = reconcile_matter_register(
            manifest,
            [matter(1), matter(2, "confidential")],
        )
        self.assertTrue(result.passed)
        self.assertEqual([], result.errors)

    def test_over_extraction_fails_closed(self):
        manifest = DocumentManifest(
            source_sha256="a" * 64,
            source_format="docx",
            total_matters=2,
            publishable_matters=2,
            confidential_matters=0,
            matter_labels=["Publishable Matter 1", "Publishable Matter 2"],
        )
        result = reconcile_matter_register(manifest, [matter(1), matter(2), matter(3)])
        self.assertFalse(result.passed)
        self.assertEqual(1, result.over_extracted_count)

    def test_unsupported_generated_claim_fails(self):
        claim = EvidenceClaim(
            claim_id="claim-1",
            text="The team reviewed invoices and prepared an evidence matrix.",
            support=EvidenceSupport.UNSUPPORTED,
        )
        errors = validate_claim_grounding([claim], ["span-1"])
        self.assertEqual(1, len(errors))
        self.assertIn("Unsupported claim", errors[0])

    def test_unknown_evidence_reference_fails(self):
        claim = EvidenceClaim(
            claim_id="claim-1",
            text="Gruppo Montenegro acquired Pampero from Diageo.",
            evidence_ids=["missing-span"],
            support=EvidenceSupport.SEMANTIC,
            semantic_role="buyer",
        )
        errors = validate_claim_grounding([claim], ["span-1"])
        self.assertEqual(1, len(errors))
        self.assertIn("unknown evidence", errors[0])

    def test_lawyer_ranking_change_fails(self):
        source = [
            LawyerRecord(
                lawyer_id="maria-carolina-cano",
                name="María Carolina Cano",
                is_partner=True,
                is_ranked=True,
                current_ranking="Ranked",
            )
        ]
        extracted = [
            LawyerRecord(
                lawyer_id="maria-carolina-cano",
                name="María Carolina Cano",
                is_partner=True,
                is_ranked=False,
                current_ranking="Not Ranked",
            )
        ]
        errors = reconcile_lawyer_roster(source, extracted)
        self.assertEqual(2, len(errors))
        self.assertTrue(any("Ranking mismatch" in error for error in errors))

    def test_novel_number_in_optimized_matter_fails(self):
        source = "Advised Client 1 on a real estate matter completed in 2024."
        errors = validate_optimized_matter_text(
            matter(1),
            "Advised Client 1 and reviewed 40 invoices in 2024.",
            source,
        )
        self.assertTrue(any("Novel numeric claims" in error for error in errors))

    def test_generated_matter_requires_literal_evidence_quotes(self):
        source = "The team advised Client 1 on an acquisition. The transaction completed in 2024."
        errors = validate_evidence_quotes(
            "Client 1 completed an acquisition after invoice review.",
            ["The team advised Client 1 on an acquisition.", "Invented quote"],
            source,
        )
        self.assertTrue(any("absent from source" in error for error in errors))

    def test_source_fallback_does_not_require_claim_map(self):
        source = "The team advised Client 1."
        self.assertEqual([], validate_evidence_quotes(source, [], source))

    def test_generated_matter_client_change_fails(self):
        errors = validate_artifact_matter_register(
            [matter(1)],
            [{"client": "Different Client", "publish_status": "publishable"}],
        )
        self.assertTrue(any("client mismatch" in error for error in errors))

    def test_first_recognition_hero_prioritizes_category_fit(self):
        hero, notes = select_objective_aligned_hero(
            [
                {"title": "Grupo R Public Lighting Concession", "summary": "35 challenges to a lighting concession"},
                {"title": "El Cielo Country Club Environmental Decree Amparos", "summary": "Protected a real estate development against zoning and environmental restrictions"},
            ],
            "Real Estate",
            "first_recognition",
            "Grupo R Public Lighting Concession",
        )
        self.assertTrue(hero.startswith("El Cielo"))
        self.assertTrue(notes)

    def test_national_objective_rejects_state_centred_thesis(self):
        errors = validate_thesis_objective(
            "A Jalisco-centred Real Estate disputes practice",
            {"ranking_unit": "Mexico national", "jurisdiction_type": "national"},
        )
        self.assertTrue(errors)

    def test_fallback_thesis_uses_national_geographic_evidence(self):
        thesis = build_objective_aligned_thesis(
            [
                {"title": "El Cielo Real Estate Development", "summary": "Environmental restrictions in Jalisco"},
                {"title": "Industrial land matter", "summary": "Property work in Durango and Querétaro"},
            ],
            "Real Estate",
            "Mexico national",
        )
        self.assertIn("Mexico national", thesis)
        self.assertIn("Durango", thesis)
        self.assertNotIn("Jalisco-centred", thesis)

    def test_audit_repairs_regional_identity_but_retains_vulnerability(self):
        repaired = repair_objective_conflicts(
            {"summary": "The firm is a Jalisco-centred Real Estate practice."},
            {"ranking_unit": "Mexico national"},
        )
        self.assertNotIn("Jalisco-centred", repaired["summary"])
        self.assertIn("vulnerability", repaired["summary"])
        self.assertIn("national ranking objective", repaired["summary"])

    def test_b10_positioning_propagates_only_source_backed_anchors(self):
        positioning = build_source_backed_b10_positioning(
            "SUMMUS market entry and banking relationship. Gruppo Montenegro completed the acquisition of Pampero. Dragados undertook downsizing and liquidation.",
            "AraqueReyna",
            "Corporate/M&A",
            "Venezuela",
            "Gruppo Montenegro / Pampero",
            ["SUMMUS", "Unsupported Client"],
        )
        self.assertIn("acquisitions", positioning)
        self.assertIn("market entry", positioning)
        self.assertIn("Gruppo Montenegro / Pampero", positioning)
        self.assertIn("SUMMUS", positioning)
        self.assertNotIn("Unsupported Client", positioning)

    def test_national_b10_uses_documented_geographic_breadth(self):
        positioning = build_source_backed_b10_positioning(
            "Environmental development matters in Jalisco, industrial land in Durango and title work in Querétaro.",
            "Ramos Castillo",
            "Real Estate",
            "Mexico national",
        )
        self.assertIn("Jalisco, Durango, Querétaro", positioning)
        self.assertNotIn("Jalisco-centred", positioning)

    def test_client_output_removes_internal_guard_language(self):
        result = apply_epistemic_filter(
            "The engine restriction prevents precedent testing. The matter has demonstrative capacity."
        )
        self.assertNotIn("engine restriction", result.lower())
        self.assertNotIn("demonstrative capacity", result.lower())

    def test_acquisition_from_semantically_identifies_buyer(self):
        role, counterparty = infer_transaction_role(
            "We advised Gruppo Montenegro on all legal aspects related to the acquisition of Pampero from Diageo."
        )
        self.assertEqual("buyer", role)
        self.assertEqual("Diageo", counterparty)


if __name__ == "__main__":
    unittest.main()
