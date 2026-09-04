import sys
import unittest
from pathlib import Path
from unittest.mock import patch


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
    select_verified_source_preservation,
    classify_matter_cross_border,
)
from utils.doc_parser import DocumentParser  # noqa: E402
from utils.objective_alignment import (  # noqa: E402
    select_objective_aligned_hero,
    validate_thesis_objective,
    build_objective_aligned_thesis,
    build_source_backed_b10_positioning,
    compress_oversized_source_b10,
    repair_objective_conflicts,
    select_objective_aligned_b10_source,
)
from utils.language_guard import apply_epistemic_filter  # noqa: E402
from utils.canonical_builder import (  # noqa: E402
    build_strategic_objective,
    infer_transaction_role,
    merge_lawyer_roster,
    reconcile_extracted_matters_to_source,
)
from utils.model_response import coerce_message_text  # noqa: E402
from utils.objective_alignment import compose_b10_with_budget  # noqa: E402
from agents.nodes import (  # noqa: E402
    artifact_validation_node,
    evidence_gap_analysis_node,
    optimization_node,
    safe_json_loads,
    sanitize_client_audit_payload,
)
from agents.constitutional_validator import (  # noqa: E402
    constitutional_validation_node,
    run_layer1_checks,
)


class _FakeMessage:
    content = (
        '{"optimized_text":"Client A instructed the team on the stated mandate.",'
        '"evidence_quotes":["Client A instructed the team on the stated mandate."]}'
    )


class _FakeMatterModel:
    def bind(self, **_kwargs):
        return self

    def invoke(self, _messages):
        return _FakeMessage()


class _FakeMatterModelWithoutQuotes(_FakeMatterModel):
    def invoke(self, _messages):
        return type("Message", (), {
            "content": '{"optimized_text":"Client A instructed the team on the stated mandate."}'
        })()


class _FakeMatterModelWithUnsupportedCrossBorder(_FakeMatterModel):
    def invoke(self, _messages):
        return type("Message", (), {
            "content": (
                '{"optimized_text":"Client A handled a cross-border mandate.",'
                '"evidence_quotes":["D4 Is this a cross-border matter?"]}'
            )
        })()


class _NeverInvokeModel(_FakeMatterModel):
    def invoke(self, _messages):
        raise AssertionError("targeted retry invoked an unaffected model component")


class _CountingMatterModel(_FakeMatterModel):
    def __init__(self):
        self.calls = 0

    def invoke(self, _messages):
        self.calls += 1
        return type("Message", (), {
            "content": (
                '{"optimized_text":"Client B handled the source mandate.",'
                '"evidence_quotes":["Client B handled the source mandate."]}'
            )
        })()


def matter(index: int, status: str = "publishable") -> MatterRecord:
    return MatterRecord(
        matter_id=f"matter-{index:02d}",
        source_label=f"{status.title()} Matter {index}",
        publish_status=status,
        client=f"Client {index}",
    )


class EvidenceContractTests(unittest.TestCase):
    def test_legacy_doc_text_count_detects_duplicate_heading(self):
        text = """
        Publishable Matter 1
        Publishable Matter 2
        Confidential Matter 1
        Confidential Matter 2
        Confidential Matter 2
        """
        result = DocumentParser._count_matter_labels_in_text(text)
        self.assertEqual(5, result["total"])
        self.assertEqual(2, result["publishable"])
        self.assertEqual(3, result["confidential"])
        self.assertFalse(result["label_validation"]["passed"])
        self.assertEqual(
            ["Confidential Matter 2"],
            result["label_validation"]["duplicate_labels"],
        )

    def test_inline_matter_reference_is_not_a_heading(self):
        text = """Publishable Matter 1
Client A
Not stated in source (Confidential Matter 2)
Confidential Matter 1
Client B
"""
        result = DocumentParser._count_matter_labels_in_text(text)
        self.assertEqual(2, result["total"])
        self.assertTrue(result["label_validation"]["passed"])

    def test_contiguous_register_preserves_non_numeric_physical_order(self):
        result = DocumentParser.validate_matter_labels([
            "Publishable Matter 1",
            "Confidential Matter 1",
            "Confidential Matter 3",
            "Confidential Matter 2",
        ])
        self.assertTrue(result["passed"])

    def test_generated_source_is_rejected(self):
        result = DocumentParser.detect_rankpilot_generated_source(
            "Current ranking: Band 2\nSuggested ranking: Suggested for ranking"
        )
        self.assertFalse(result["passed"])
        self.assertTrue(result["is_generated_output"])
        filename_result = DocumentParser.detect_rankpilot_generated_source(
            "SUBMISSION FORM",
            "/tmp/RankPilot_Submission_Form_Real_Estate.docx",
        )
        self.assertFalse(filename_result["passed"])

    def test_renamed_legacy_generated_submission_is_rejected_by_content(self):
        result = DocumentParser.detect_rankpilot_generated_source(
            """SUBMISSION FORM
Chambers and Partners should recognize that market leadership is defined by
high-stakes regulatory risk management and complex institutional governance.
The firm combines senior regulatory memory with active front-line partner leadership.
""",
            "/tmp/Original.docx",
        )
        self.assertFalse(result["passed"])
        self.assertTrue(
            any("generated positioning" in error for error in result["errors"])
        )

    def test_matter_fields_are_recovered_from_exact_source_section(self):
        fields = DocumentParser.extract_matter_fields("""D1 Name of client
SANU Corp, C.A. and HAS Higiene, Agua y Saneamiento, C.A.
D2 Summary
Joint restructuring mandate.
D3 Value
US$14 million
D4 Cross-border
Venezuela and Colombia
D5 Lead partner
María Carolina Cano
""")
        self.assertEqual(
            "SANU Corp, C.A. and HAS Higiene, Agua y Saneamiento, C.A.",
            fields["client"],
        )
        self.assertEqual("US$14 million", fields["matter_value"])
        self.assertEqual("María Carolina Cano", fields["lead_partner"])

    def test_matter_field_parser_removes_template_instructions(self):
        fields = DocumentParser.extract_matter_fields("""D1 Name of client
this will be publishable. If you cannot reveal the client name, give a general description.
Gruppo Montenegro (Montenegro S.r.l.)
D2 Summary
Please say why this matter was important. Also, tell us exactly what role your department played.
Advised Gruppo Montenegro on the Pampero acquisition.
D3 Matter value
include currency and amount in figures
Confidential
""")
        self.assertEqual("Gruppo Montenegro (Montenegro S.r.l.)", fields["client"])
        self.assertEqual(
            "Advised Gruppo Montenegro on the Pampero acquisition.", fields["summary"]
        )
        self.assertEqual("Confidential", fields["matter_value"])

    def test_legacy_form_cleaner_removes_ole_prefix_and_xml_postamble(self):
        raw = """WordDocument
binary metadata
SUBMISSION FORM
A. PRELIMINARY INFORMATION
A1 Firm name
Firm A
A2 Practice Area
Corporate M&A
A3 Location (Jurisdiction)
Venezuela
Publishable Matter 1
D1 Name of client
Client A
Ref: PAB006
Please upload completed submissions online at
<xs:schema>container metadata</xs:schema>
"""
        cleaned = DocumentParser._clean_legacy_doc_text(raw)
        self.assertTrue(cleaned.startswith("SUBMISSION FORM"))
        self.assertNotIn("WordDocument", cleaned)
        self.assertNotIn("Ref: PAB006", cleaned)
        self.assertNotIn("xs:schema", cleaned)

    def test_source_identity_and_all_department_heads_are_deterministic(self):
        text = """SUBMISSION FORM
A1 Firm name
ARAQUEREYNA
A2 Practice Area
CORPORATE M&A
A3 Location (Jurisdiction)
Venezuela
B7 Head or Heads of department
Name
Email
Telephone number
Pedro Ignacio Sosa Mendoza
Manuel Reyna\x07 HYPERLINK "mailto:person@example.com"
+58 414 000 0000
B8 Hires / Departures
"""
        self.assertEqual(
            {
                "firm_name": "ARAQUEREYNA",
                "practice_area": "CORPORATE M&A",
                "jurisdiction": "Venezuela",
            },
            DocumentParser.extract_chambers_preliminary_fields(text),
        )
        self.assertEqual(
            ["Pedro Ignacio Sosa Mendoza", "Manuel Reyna"],
            DocumentParser.extract_department_heads(text),
        )

    def test_docx_pipe_table_header_is_not_a_department_head(self):
        text = """B7 Head or Heads of department
Name | Email | Telephone number
José Pablo Ramos Castillo | j.ramos@ramoscastillo.com | (+52) 33 1003 1135
B8 Hires / Departures
"""
        self.assertEqual(
            ["José Pablo Ramos Castillo"],
            DocumentParser.extract_department_heads(text),
        )

    def test_source_preservation_retains_long_form_client_identity(self):
        canonical_client = (
            "COMINVI, S.A. DE C.V., a mining-services company, and PROYECTOS, "
            "DESARROLLOS, URBANIZACIÓN Y CONSTRUCCIÓN, S.A. DE C.V."
        )
        preferred_summary = (
            "COMINVI, S.A. DE C.V. instructed the firm on a real-estate matter."
        )
        source_text = (
            "D1 Name of client\n"
            f"{canonical_client}\n"
            "D2 Summary\n"
            f"{preferred_summary}"
        )
        selected, errors = select_verified_source_preservation(
            MatterRecord(
                matter_id="matter-11",
                source_label="Publishable Matter 11",
                publish_status="publishable",
                client=canonical_client,
            ),
            preferred_summary,
            source_text,
        )
        self.assertEqual(f"Client: {canonical_client}\n\n{preferred_summary}", selected)
        self.assertEqual([], errors)

    def test_source_preservation_prefers_contract_complete_summary(self):
        preferred_summary = "Client A instructed the firm on the stated mandate."
        source_text = f"D1 Name of client\nClient A\nD2 Summary\n{preferred_summary}"
        selected, errors = select_verified_source_preservation(
            MatterRecord(
                matter_id="matter-01",
                source_label="Publishable Matter 1",
                publish_status="publishable",
                client="Client A",
            ),
            preferred_summary,
            source_text,
        )
        self.assertEqual(preferred_summary, selected)
        self.assertEqual([], errors)

    def test_explicit_no_is_not_cross_border_evidence(self):
        self.assertIs(
            False,
            classify_matter_cross_border({
                "is_cross_border": False,
                "cross_border_jurisdictions": "No.",
            }),
        )
        self.assertIs(
            False,
            classify_matter_cross_border({"is_cross_border": "False"}),
        )
        self.assertIs(
            True,
            classify_matter_cross_border({
                "cross_border_jurisdictions": "Mexico and the United States",
            }),
        )
        self.assertIsNone(classify_matter_cross_border({}))

    def test_source_no_with_period_overrides_stale_cross_border_boolean(self):
        source = """Publishable Matter 1
D1 Name of client
Client A
D2 Summary
Client A instructed the firm on a domestic property matter.
D4 Cross-border jurisdictions
No.
D5 Lead partner
Lawyer A
"""
        reconciled, report = reconcile_extracted_matters_to_source(
            [{
                "source_label": "Publishable Matter 1",
                "client": "Client A",
                "is_cross_border": True,
            }],
            ["Publishable Matter 1"],
            source,
        )
        self.assertTrue(report["passed"])
        self.assertFalse(reconciled[0]["is_cross_border"])

    def test_layer1_ignores_original_b10_cross_border_wording(self):
        source_b10 = "The source describes a cross-border matter."
        passed, violations = run_layer1_checks({
            "original_b10": source_b10,
            "enhanced_b7": source_b10,
            "matters": [],
            "strategic_context": {"cross_border_relevant": False},
            "metadata": {"practice_area": "Real Estate"},
        })
        self.assertTrue(passed)
        self.assertFalse(any("A4-CROSSBORDER" in item for item in violations))

    def test_layer1_rejects_generated_b10_cross_border_insertion(self):
        source_b10 = "The source describes domestic property litigation."
        passed, violations = run_layer1_checks({
            "original_b10": source_b10,
            "enhanced_b7": "Generated cross-border positioning.\n\n" + source_b10,
            "matters": [],
            "strategic_context": {"cross_border_relevant": False},
            "metadata": {"practice_area": "Real Estate"},
        })
        self.assertFalse(passed)
        self.assertTrue(any("A4-CROSSBORDER" in item for item in violations))

    def test_publishable_matter_stops_before_confidential_register_heading(self):
        text = """Publishable Matter 10
D1 Name of client
Client A
E. CONFIDENTIAL INFORMATION
CONFIDENTIAL CLIENTS
Secret Client
Confidential Matter 1
E1 Name of client
Secret Client
"""
        section = DocumentParser.extract_numbered_matter_sections(text)[
            "publishable matter 10"
        ]["text"]
        self.assertIn("Client A", section)
        self.assertNotIn("CONFIDENTIAL CLIENTS", section)
        self.assertNotIn("Secret Client", section)

    def test_explicit_blank_source_field_clears_model_inference(self):
        source = """Confidential Matter 1
E1 Name of client
Client A
E2 Summary
Source summary.
E3 Matter value
Confidential
E4 Is this a cross-border matter?
E5 Lead partner
Partner One
"""
        matters, report = reconcile_extracted_matters_to_source(
            [{
                "source_label": "Confidential Matter 1",
                "client": "Client A",
                "summary": "Source summary.",
                "cross_border_jurisdictions": "Spain and Venezuela",
            }],
            ["Confidential Matter 1"],
            source,
        )
        self.assertTrue(report["passed"])
        self.assertEqual("", matters[0]["cross_border_jurisdictions"])

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

    def test_numbered_sections_accept_docx_row_and_concatenated_field_headings(self):
        text = """Publishable Matter 7 | D1 Name of client | Client Seven
D2 Summary | Source seven.
Publishable Matter 8D1 Name of client
Client Eight
D2 Summary
Source eight.
Confidential Matter 1
E1 Name of client
Client Nine
"""
        sections = DocumentParser.extract_numbered_matter_sections(text)
        self.assertEqual(
            {"publishable matter 7", "publishable matter 8", "confidential matter 1"},
            set(sections),
        )
        self.assertIn("Client Seven", sections["publishable matter 7"]["text"])
        self.assertIn("Client Eight", sections["publishable matter 8"]["text"])

    def test_final_legacy_doc_matter_stops_after_completion_field(self):
        text = """Confidential Matter 1
E1 Name of client
Client One
E2 Summary
Source-backed matter summary.
E8 Completion date
June 2026
Rob Howe Microsoft Office Word
Extracted Text
Content Type
"""
        section = DocumentParser.extract_numbered_matter_sections(text)[
            "confidential matter 1"
        ]["text"]
        self.assertIn("June 2026", section)
        self.assertNotIn("Microsoft Office", section)
        self.assertNotIn("Extracted Text", section)

    def test_responses_api_text_blocks_parse_as_json(self):
        content = [
            {"type": "text", "text": '{"optimized_text":"Source'},
            {"type": "output_text", "text": '","evidence_quotes":[]}'},
        ]
        self.assertEqual(
            '{"optimized_text":"Source","evidence_quotes":[]}',
            coerce_message_text(content),
        )
        self.assertEqual("Source", safe_json_loads(content)["optimized_text"])

    def test_json_parser_selects_complete_optimizer_object_with_quotes(self):
        content = (
            '{"optimized_text":"Incomplete"}'
            '{"optimized_text":"Grounded","evidence_quotes":["Source quote"]}'
        )
        parsed = safe_json_loads(
            content,
            expected_keys={"optimized_text", "evidence_quotes"},
        )
        self.assertEqual("Grounded", parsed["optimized_text"])
        self.assertEqual(["Source quote"], parsed["evidence_quotes"])

    def test_source_metadata_overrides_mislabeled_ui_objective(self):
        objective = build_strategic_objective(
            {"practice_area": "Banking & Finance", "jurisdiction": "Latin America"},
            {"practice_area": "CORPORATE M&A", "location": "Venezuela"},
        )
        self.assertEqual("CORPORATE M&A", objective.practice_area)
        self.assertEqual("Venezuela", objective.ranking_unit)

    def test_client_audit_removes_sdk_and_validation_internals(self):
        payload = sanitize_client_audit_payload({
            "summary": "Client-safe analysis",
            "id": "resp_123",
            "response_metadata": {"model": "internal"},
            "audit_letter": {
                "the_state_of_play": "Source-backed conclusion",
                "encrypted_content": "opaque",
                "_validation_warnings": ["internal warning"],
            },
        })
        self.assertEqual("Client-safe analysis", payload["summary"])
        self.assertNotIn("id", payload)
        self.assertNotIn("response_metadata", payload)
        self.assertEqual(
            {"the_state_of_play": "Source-backed conclusion"},
            payload["audit_letter"],
        )

    def test_b10_budget_keeps_original_and_required_partner(self):
        original = " ".join(f"source{i}" for i in range(450))
        strategic = (
            "The practice combines documented acquisitions and restructurings. "
            "A second supporting proposition uses the verified portfolio."
        )
        result = compose_b10_with_budget(
            original,
            strategic,
            ["The department is led by Pedro Ignacio Sosa Mendoza."],
        )
        self.assertLessEqual(len(result.split()), 500)
        self.assertIn(original, result)
        self.assertIn("Pedro Ignacio Sosa Mendoza", result)

    def test_oversized_b10_removes_only_known_marketing_boilerplate(self):
        generic_intro = (
            "We are a firm dedicated to the personalized provision of legal services in "
            "administrative and tax matters, with a high degree of specialization. "
            "Our vocation is customer service, seeking at all times to exceed any "
            "expectations and solve problems in a comprehensive way. "
            "We do this through experience, optimal preparation, persistence and "
            "determination that distinguish us, taking as a guiding principle of our "
            "actions the most solid ethical and moral principles. "
            "We seek to build a long-term relationship of trust with our clients, "
            "contributing with determination in the growth and overall vision development "
            "of their projects, especially in the region of Guadalajara and throughout "
            "the State of Jalisco, where most of our clients operate. "
            "Your complete satisfaction is and will always be our goal, and our greatest "
            "triumph. "
        )
        factual_tail = " ".join(f"evidence{i}" for i in range(462))
        original = generic_intro + factual_tail
        result = compress_oversized_source_b10(original)
        self.assertLessEqual(len(result.split()), 500)
        self.assertIn(factual_tail, result)
        self.assertNotIn("personalized provision", result)
        self.assertNotIn("long-term relationship of trust", result)

    def test_real_estate_b10_drops_explicit_off_practice_prose(self):
        source = (
            "We advise on administrative and tax matters. "
            "One mandate concerns the practice of General Business Law. "
            "The team used expert real estate identification evidence to protect the "
            "client's private property. "
            "Its Amparo Proceedings and Administrative Law experience supports legal defence. "
            "An energy and natural resources matter concerned a power plant."
        )
        result = select_objective_aligned_b10_source(source, "Real Estate")
        self.assertIn("private property", result)
        self.assertIn("Amparo Proceedings", result)
        self.assertNotIn("General Business Law", result)
        self.assertNotIn("power plant", result)

    def test_matter_parser_removes_template_questions_and_duplicate_copy(self):
        repeated = (
            "Client A protected its property. Legal/Technical Complexities of Various Types? "
            "Tight deadlines? A multitude of parties involved in the case across different "
            "jurisdictions? Does your client hold a dominant position in the market? "
            "A suspension protected the property."
        )
        section = (
            "Publishable Matter 1\nD1 Name of client\nClient A\nD2 Summary\n"
            + repeated + "\n" + repeated + "\nD4 Cross-border jurisdictions\nNo."
        )
        fields = DocumentParser.extract_matter_fields(section)
        self.assertNotIn("Legal/Technical", fields["summary"])
        self.assertEqual(1, fields["summary"].count("Client A protected its property."))

    def test_matter_parser_repairs_concatenated_client_paragraphs(self):
        fields = DocumentParser.extract_matter_fields(
            "D1 Name of client\nFirst client description.PROYECTOS, S.A. DE C.V. "
            "is the second client.\nD2 Summary\nSource-backed work."
        )
        self.assertIn("description. PROYECTOS", fields["client"])
        self.assertIn("S.A. DE C.V.", fields["client"])

    @patch(
        "agents.constitutional_validator.run_layer1_checks",
        return_value=(False, ["[B6-WORDCOUNT] B10 exceeds 500 words: 589w"]),
    )
    def test_b6_word_limit_failure_does_not_retry_all_matters(self, _layer1):
        result = constitutional_validation_node({"constitutional_retry_count": 0})
        self.assertEqual("blocked", result["constitutional_route"])
        self.assertEqual(0, result["constitutional_retry_count"])
        self.assertEqual(
            "CONSTITUTIONAL_VALIDATION_FAILED",
            result["release_verdict"]["code"],
        )

    @patch(
        "agents.constitutional_validator.run_layer1_checks",
        return_value=(False, [
            "[C6-EVIDENCE] Matter 'Client B': evidence '20-year' lost in optimization"
        ]),
    )
    def test_layer1_evidence_retry_targets_only_matching_matter(self, _layer1):
        result = constitutional_validation_node({
            "constitutional_retry_count": 0,
            "matters": [
                {"client": "Client A", "matter_id": "matter-01"},
                {"client": "Client B", "matter_id": "matter-02"},
            ],
            "canonical_submission": {"matters": [
                {"matter_id": "matter-01"},
                {"matter_id": "matter-02"},
            ]},
        })
        self.assertEqual("optimization", result["constitutional_route"])
        self.assertEqual(["matters"], result["constitutional_retry_scopes"])
        self.assertEqual(["matter-02"], result["constitutional_retry_matter_ids"])

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

    def test_source_current_ranking_overrides_model_value(self):
        source = [{"name": "Pedro Sosa", "is_ranked": True, "current_ranking": "Band 2"}]
        merged = merge_lawyer_roster(
            source,
            [{"name": "Pedro Sosa", "is_ranked": False, "current_ranking": "Unranked"}],
        )
        self.assertTrue(merged[0]["is_ranked"])
        self.assertEqual("Band 2", merged[0]["current_ranking"])

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

    def test_reconciliation_locks_all_non_narrative_source_fields(self):
        source = """Publishable Matter 1
D1 Name of client
Joint Client A and Client B
D2 Summary
Source summary.
D3 Value
US$20 million
D4 Cross-border
Venezuela and Spain
D5 Lead partner
Lead Lawyer
D6 Team
Associate One
D7 Other firms
Firm X
D8 Completion
Ongoing
"""
        reconciled, report = reconcile_extracted_matters_to_source(
            [{
                "source_label": "Publishable Matter 1",
                "client": "Wrong Client",
                "matter_value": "Wrong Value",
                "lead_partner": "Wrong Lawyer",
            }],
            ["Publishable Matter 1"],
            source,
        )
        self.assertTrue(report["passed"])
        locked = reconciled[0]
        self.assertEqual("Joint Client A and Client B", locked["client"])
        self.assertEqual("US$20 million", locked["matter_value"])
        self.assertEqual("Lead Lawyer", locked["lead_partner"])
        self.assertEqual("Firm X", locked["other_firms"])

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

    def test_unknown_client_placeholder_is_not_required_in_client_prose(self):
        record = MatterRecord(
            matter_id="matter-01",
            source_label="Publishable Matter 1",
            publish_status="publishable",
            client="Unknown client",
        )
        errors = validate_optimized_matter_text(
            record,
            "The team advised on the restructuring described in the source.",
            "The team advised on the restructuring described in the source.",
        )
        self.assertFalse(any("Client omitted" in error for error in errors))

    def test_short_grounded_optimization_keeps_evidence_quotes(self):
        source = (
            "Publishable Matter 1\nD1 Name of client\nClient A\nD2 Summary\n"
            "Client A instructed the team on the stated mandate.\n"
            "D3 Value\nNot provided\nD4 Cross-border\nNot provided"
        )
        state = {
            "matters": [{
                "title": "Matter 1",
                "client": "Client A",
                "summary": "Client A instructed the team on the stated mandate.",
            }],
            "canonical_submission": {
                "matters": [{"source_span_ids": ["matter-span-01"]}],
            },
            "evidence_ledger": {"matter-span-01": {"text": source}},
            "strategic_context": {},
            "narrative_architecture": {},
            "analysis": {},
            "pipeline_manifest": {"document": {"source_matters": {"total": 1}}},
            "original_b10": "",
            "original_c2": "",
        }
        with patch("agents.nodes.get_model", return_value=_FakeMatterModel()):
            result = optimization_node(state)
        optimized = result["matters"][0]
        self.assertEqual(
            ["Client A instructed the team on the stated mandate."],
            optimized["_evidence_quotes"],
        )
        self.assertNotEqual("Enhancement Failed", optimized["status"])

    def test_optimization_without_evidence_map_preserves_exact_source(self):
        source = (
            "Publishable Matter 1\nD1 Name of client\nClient A\nD2 Summary\n"
            "Client A instructed the team on the stated mandate."
        )
        state = {
            "matters": [{
                "title": "Matter 1",
                "client": "Client A",
                "summary": "Client A instructed the team on the stated mandate.",
            }],
            "canonical_submission": {
                "matters": [{"source_span_ids": ["matter-span-01"]}],
            },
            "evidence_ledger": {"matter-span-01": {"text": source}},
            "strategic_context": {},
            "narrative_architecture": {},
            "analysis": {},
            "pipeline_manifest": {"document": {"source_matters": {"total": 1}}},
            "original_b10": "",
            "original_c2": "",
        }
        with patch("agents.nodes.get_model", return_value=_FakeMatterModelWithoutQuotes()):
            result = optimization_node(state)

        optimized = result["matters"][0]
        self.assertEqual(
            "Client A instructed the team on the stated mandate.",
            optimized["optimized_text"],
        )
        self.assertTrue(optimized["_source_fallback"])
        self.assertEqual("Source Preserved", optimized["status"])

    def test_audit_only_retry_reuses_matters_and_b10_without_model_calls(self):
        existing_matter = {
            "matter_id": "matter-01",
            "source_label": "Publishable Matter 1",
            "title": "Matter 1",
            "client": "Client A",
            "summary": "Client A instructed the team.",
            "optimized_text": "Client A instructed the team.",
            "publish_status": "publishable",
        }
        state = {
            "constitutional_retry_count": 1,
            "constitutional_retry_scopes": ["audit"],
            "constitutional_retry_matter_ids": [],
            "constitutional_violation_feedback": "Complete the Strategic Audit.",
            "matters": [existing_matter],
            "canonical_submission": {"matters": [{
                "matter_id": "matter-01",
                "source_label": "Publishable Matter 1",
                "source_span_ids": ["matter-span-01"],
            }]},
            "evidence_ledger": {"matter-span-01": {"text": "Client A instructed the team."}},
            "strategic_context": {},
            "narrative_architecture": {},
            "analysis": {},
            "pipeline_manifest": {"document": {"source_matters": {"total": 1}}},
            "original_b10": "Original B10 source narrative with enough words to be considered substantive content.",
            "enhanced_b7": "Previously approved B10 narrative.",
            "original_c2": "",
        }
        with patch("agents.nodes.get_model", return_value=_NeverInvokeModel()):
            result = optimization_node(state)
        self.assertEqual(
            "Client A instructed the team.",
            result["matters"][0]["optimized_text"],
        )
        self.assertEqual("Previously approved B10 narrative.", result["enhanced_b7"])

    def test_empty_target_list_never_reruns_every_matter(self):
        existing_matter = {
            "matter_id": "matter-01",
            "source_label": "Publishable Matter 1",
            "client": "Client A",
            "summary": "Source matter.",
            "optimized_text": "Approved matter.",
            "publish_status": "publishable",
        }
        state = {
            "constitutional_retry_count": 1,
            "constitutional_retry_scopes": ["matters"],
            "constitutional_retry_matter_ids": [],
            "matters": [existing_matter],
            "canonical_submission": {"matters": [{
                "matter_id": "matter-01",
                "source_label": "Publishable Matter 1",
                "source_span_ids": ["matter-span-01"],
            }]},
            "evidence_ledger": {"matter-span-01": {"text": "Source matter."}},
            "strategic_context": {},
            "narrative_architecture": {},
            "analysis": {},
            "pipeline_manifest": {"document": {"source_matters": {"total": 1}}},
            "original_b10": "",
            "original_c2": "",
        }
        with patch("agents.nodes.get_model", return_value=_NeverInvokeModel()):
            result = optimization_node(state)
        self.assertEqual("Approved matter.", result["matters"][0]["optimized_text"])

    def test_targeted_retry_invokes_only_the_failed_matter(self):
        matters = [
            {
                "matter_id": f"matter-0{index}",
                "source_label": f"Publishable Matter {index}",
                "client": f"Client {name}",
                "summary": f"Client {name} handled the source mandate.",
                "optimized_text": f"Approved matter {name}.",
                "publish_status": "publishable",
            }
            for index, name in enumerate(("A", "B", "C"), start=1)
        ]
        canonical = [
            {
                "matter_id": f"matter-0{index}",
                "source_label": f"Publishable Matter {index}",
                "source_span_ids": [f"matter-span-0{index}"],
            }
            for index in range(1, 4)
        ]
        ledger = {
            f"matter-span-0{index}": {
                "text": f"Client {name} handled the source mandate."
            }
            for index, name in enumerate(("A", "B", "C"), start=1)
        }
        model = _CountingMatterModel()
        state = {
            "constitutional_retry_count": 1,
            "constitutional_retry_scopes": ["matters"],
            "constitutional_retry_matter_ids": ["matter-02"],
            "constitutional_violation_feedback": "Revise matter-02 only.",
            "matters": matters,
            "canonical_submission": {"matters": canonical},
            "evidence_ledger": ledger,
            "strategic_context": {},
            "narrative_architecture": {},
            "analysis": {},
            "pipeline_manifest": {"document": {"source_matters": {"total": 3}}},
            "original_b10": "",
            "original_c2": "",
        }
        with patch("agents.nodes.get_model", return_value=model):
            result = optimization_node(state)
        self.assertEqual(1, model.calls)
        self.assertEqual("Approved matter A.", result["matters"][0]["optimized_text"])
        self.assertEqual(
            "Client B handled the source mandate.",
            result["matters"][1]["optimized_text"],
        )
        self.assertEqual("Approved matter C.", result["matters"][2]["optimized_text"])

    def test_audit_retry_reuses_existing_evidence_gap_analysis(self):
        payload = {"gaps": [{"targeted_question": "Which outcome is documented?"}]}
        state = {
            "constitutional_retry_count": 1,
            "constitutional_retry_scopes": ["audit"],
            "matter_evidence_gaps": payload,
            "interrogation_questions": ["Which outcome is documented?"],
        }
        with patch("agents.nodes.get_model", side_effect=AssertionError("model invoked")):
            result = evidence_gap_analysis_node(state)
        self.assertEqual(payload, result["matter_evidence_gaps"])
        self.assertEqual(
            ["Which outcome is documented?"], result["interrogation_questions"]
        )

    def test_json_parser_selects_complete_strategic_audit_object(self):
        content = (
            '{"score":65}'
            '{"score":78,"score_rationale":"Evidence supports the score.",'
            '"summary":"Complete summary.","audit_letter":{"closing":"Complete."}}'
        )
        parsed = safe_json_loads(
            content,
            expected_keys={"score", "score_rationale", "summary", "audit_letter"},
        )
        self.assertEqual(78, parsed["score"])
        self.assertEqual("Complete summary.", parsed["summary"])

    def test_domestic_matter_rejects_generated_cross_border_framing(self):
        summary = "Client A instructed the team on the stated domestic mandate."
        source = (
            "Publishable Matter 1\nD1 Name of client\nClient A\nD2 Summary\n"
            f"{summary}\nD4 Is this a cross-border matter?\nNo"
        )
        state = {
            "matters": [{
                "title": "Matter 1",
                "client": "Client A",
                "summary": summary,
                "cross_border_jurisdictions": "No",
                "is_cross_border": False,
            }],
            "canonical_submission": {
                "matters": [{"source_span_ids": ["matter-span-01"]}],
            },
            "evidence_ledger": {"matter-span-01": {"text": source}},
            "strategic_context": {"cross_border_relevant": False},
            "narrative_architecture": {},
            "analysis": {},
            "pipeline_manifest": {"document": {"source_matters": {"total": 1}}},
            "original_b10": "",
            "original_c2": "",
        }
        with patch(
            "agents.nodes.get_model",
            return_value=_FakeMatterModelWithUnsupportedCrossBorder(),
        ):
            result = optimization_node(state)

        optimized = result["matters"][0]
        self.assertEqual(summary, optimized["optimized_text"])
        self.assertTrue(optimized["_source_fallback"])
        self.assertEqual("Source Preserved", optimized["status"])

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

    def test_artifact_gate_accepts_verified_exact_source_repair(self):
        source = "Client 1 instructed the team on the stated mandate."
        result = artifact_validation_node({
            "canonical_submission": {
                "matters": [{
                    "matter_id": "matter-01",
                    "source_label": "Publishable Matter 1",
                    "publish_status": "publishable",
                    "client": "Client 1",
                    "source_span_ids": ["span-01"],
                }],
                "lawyers": [],
            },
            "evidence_ledger": {
                "span-01": {"text": source},
            },
            "matters": [{
                "client": "Client 1",
                "publish_status": "publishable",
                "optimized_text": "Client 1 completed an unsupported audit.",
                "_evidence_quotes": [],
            }],
            "analysis": {},
            "strategic_context": {},
            "gaps": [],
            "interrogation_questions": [],
            "matter_evidence_gaps": {},
        })

        self.assertTrue(result["artifact_validation"]["passed"])
        self.assertEqual([], result["artifact_validation"]["matter_rollbacks"])
        self.assertEqual(1, len(result["artifact_validation"]["source_preservations"]))
        self.assertEqual(source, result["matters"][0]["optimized_text"])

    def test_artifact_gate_repairs_literal_summary_that_omits_full_client(self):
        full_client = "Client A, S.A. de C.V., and Project Company B, S.A. de C.V."
        summary = "Client A instructed the firm on the stated mandate."
        source = f"D1 Name of client\n{full_client}\nD2 Summary\n{summary}"
        result = artifact_validation_node({
            "canonical_submission": {
                "matters": [{
                    "matter_id": "matter-11",
                    "source_label": "Publishable Matter 11",
                    "publish_status": "publishable",
                    "client": full_client,
                    "source_span_ids": ["span-11"],
                }],
                "lawyers": [],
            },
            "evidence_ledger": {"span-11": {"text": source}},
            "matters": [{
                "client": full_client,
                "publish_status": "publishable",
                "summary": summary,
                "optimized_text": summary,
                "_source_fallback": True,
                "_evidence_quotes": [],
            }],
            "analysis": {},
            "strategic_context": {},
            "gaps": [],
            "interrogation_questions": [],
            "matter_evidence_gaps": {},
        })

        self.assertTrue(result["artifact_validation"]["passed"])
        self.assertEqual([], result["artifact_validation"]["matter_rollbacks"])
        self.assertEqual(
            f"Client: {full_client}\n\n{summary}",
            result["matters"][0]["optimized_text"],
        )

    def test_generated_matter_client_change_fails(self):
        errors = validate_artifact_matter_register(
            [matter(1)],
            [{"client": "Different Client", "publish_status": "publishable"}],
        )
        self.assertTrue(any("client mismatch" in error for error in errors))

    def test_blank_generated_client_matches_canonical_unknown_placeholder(self):
        unknown = MatterRecord(
            matter_id="matter-01",
            source_label="Confidential Matter 1",
            publish_status="confidential",
            client="Unknown client",
        )
        self.assertEqual(
            [],
            validate_artifact_matter_register(
                [unknown],
                [{"client": "", "publish_status": "confidential"}],
            ),
        )

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

    def test_international_firm_descriptor_client_extraction(self):
        from utils.evidence_validation import extract_clean_client_identity
        client = "Debevoise & Plimpton - International Law Firm"
        clean = extract_clean_client_identity(client)
        self.assertEqual("Debevoise & Plimpton", clean)

        client_jpm = "JP Morgan Chase Bank, N.A. (New York) and its related corporate legal entities"
        clean_jpm = extract_clean_client_identity(client_jpm)
        self.assertIn("JP Morgan Chase Bank", clean_jpm)

    def test_international_firm_client_validation_accepts_clean_variant(self):
        from utils.evidence_validation import validate_optimized_matter_text
        matter = MatterRecord(
            matter_id="matter-02",
            source_label="Matter 2",
            publish_status="publishable",
            client="Debevoise & Plimpton - International Law Firm",
            source_span_ids=["s1"],
        )
        opt_text = "AraqueReyna advised Debevoise & Plimpton on Venezuelan banking and regulatory compliance matters."
        source_text = "Debevoise & Plimpton advised on regulatory aspects."
        errors = validate_optimized_matter_text(matter, opt_text, source_text)
        self.assertEqual([], errors)


if __name__ == "__main__":
    unittest.main()
