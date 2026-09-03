"""Build the immutable canonical submission from deterministic and extracted data."""

import os
import re
import unicodedata
from typing import Dict, List, Tuple
from urllib.parse import urlparse

from core.contracts import (
    CanonicalSubmission,
    DocumentManifest,
    EvidenceClaim,
    EvidenceSupport,
    GapRecord,
    GapSeverity,
    LawyerRecord,
    MatterRecord,
    SourceSpan,
    StrategicObjective,
)
from utils.evidence_validation import classify_matter_cross_border, reconcile_matter_register
from utils.doc_parser import DocumentParser


def _slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return value or "unknown"


def merge_lawyer_roster(source_lawyers: List[Dict], extracted_lawyers: List[Dict]) -> List[Dict]:
    """Make the deterministic B9 roster authoritative while retaining safe detail."""

    def normalized(value: str) -> str:
        plain = unicodedata.normalize("NFKD", value or "")
        return re.sub(r"[^a-z0-9]+", " ", plain.encode("ascii", "ignore").decode().lower()).strip()

    extracted_by_name = {
        normalized(str(item.get("name") or "")): item
        for item in extracted_lawyers
        if item.get("name")
    }
    merged = []
    for source in source_lawyers:
        key = normalized(str(source.get("name") or ""))
        model = dict(extracted_by_name.get(key, {}))
        model["name"] = source.get("name")
        model["is_ranked"] = source.get("is_ranked")
        model["current_ranking"] = (
            source.get("current_ranking") or model.get("current_ranking")
        )
        if source.get("is_partner") is not None:
            model["is_partner"] = source.get("is_partner")
        model["source_excerpt"] = source.get("source_excerpt", "")
        merged.append(model)
    return merged


def reconcile_extracted_matters_to_source(
    extracted_matters: List[Dict], source_labels: List[str], source_text: str, auto_recover: bool = False
) -> Tuple[List[Dict], Dict]:
    """Select exactly one grounded extraction record per numbered source label."""

    def normalized_label(value: str) -> str:
        match = re.search(
            r"(publishable|confidential|non[- ]publishable)\s+matter\s+(\d+)",
            value or "",
            re.I,
        )
        if not match:
            return ""
        kind = match.group(1).casefold().replace(" ", "-")
        return f"{kind}:{int(match.group(2))}"

    expected = [(label, normalized_label(label)) for label in source_labels]
    sections = DocumentParser.extract_numbered_matter_sections(source_text)
    selected: List[Dict] = []
    used_indices = set()
    missing = []
    duplicate_labels = []

    for exact_label, key in expected:
        candidates = [
            (index, matter)
            for index, matter in enumerate(extracted_matters)
            if normalized_label(str(matter.get("source_label") or "")) == key
        ]
        source_span = str(sections.get(exact_label.casefold(), {}).get("text") or "").casefold()

        # Fallback 1: Match unused extracted matter whose client name appears in source_span
        if not candidates and source_span:
            for index, matter in enumerate(extracted_matters):
                if index in used_indices:
                    continue
                c_name = str(matter.get("client") or "").strip().casefold()
                if c_name and len(c_name) > 3 and c_name in source_span:
                    candidates.append((index, matter))
                    break

        # Fallback 2: Synthesize grounded matter directly from deterministic source section fields if auto_recover is requested
        if not candidates and auto_recover:
            section_text = str(sections.get(exact_label.casefold(), {}).get("text") or "")
            if section_text:
                source_fields = DocumentParser.extract_matter_fields(section_text)
                inferred_client = str(source_fields.get("client") or "").strip()
                if not inferred_client:
                    summary_text = str(source_fields.get("summary") or "").strip()
                    if summary_text:
                        inferred_client = summary_text.split(".")[0][:60].strip()
                    else:
                        inferred_client = f"Matter ({exact_label})"
                synthesized = {
                    "title": inferred_client,
                    "client": inferred_client,
                    "summary": source_fields.get("summary") or "",
                    "significance": "Matter retained from source document.",
                    "lead_partner": source_fields.get("lead_partner") or "",
                    "matter_value": source_fields.get("matter_value") or "",
                    "team_members": source_fields.get("team_members") or "",
                    "other_firms": source_fields.get("other_firms") or "",
                    "completion_date": source_fields.get("completion_date") or "",
                    "source_label": exact_label,
                    "source_excerpt": section_text,
                }
                candidates.append((-1, synthesized))
                print(f"[RECONCILIATION RECOVERY] Synthesized grounded matter for {exact_label} from source text (client: {inferred_client!r})")

        if not candidates:
            missing.append(exact_label)
            continue
        if len(candidates) > 1:
            duplicate_labels.append(exact_label)
        index, chosen = max(
            candidates,
            key=lambda item: (
                bool(str(item[1].get("client") or "").strip())
                and str(item[1].get("client") or "").casefold() in source_span,
                bool(str(item[1].get("source_excerpt") or "").strip())
                and str(item[1].get("source_excerpt") or "").strip() in source_text,
                -item[0],
            ),
        )
        if index >= 0:
            used_indices.add(index)
        grounded = dict(chosen)
        grounded["source_label"] = exact_label
        section_text = str(sections.get(exact_label.casefold(), {}).get("text") or "")
        source_fields = DocumentParser.extract_matter_fields(section_text)
        observed = set(source_fields.pop("_observed_field_numbers", []))
        field_numbers = {
            "client": 1,
            "summary": 2,
            "matter_value": 3,
            "cross_border_jurisdictions": 4,
            "lead_partner": 5,
            "team_members": 6,
            "other_firms": 7,
            "completion_date": 8,
        }
        for field, value in source_fields.items():
            if value or field_numbers[field] in observed:
                grounded[field] = value
        grounded["source_excerpt"] = section_text
        is_confidential = not exact_label.casefold().startswith("publishable")
        grounded["publish_status"] = "confidential" if is_confidential else "publishable"
        grounded["is_confidential"] = is_confidential
        grounded["_confidentiality_locked"] = is_confidential
        jurisdiction = str(source_fields.get("cross_border_jurisdictions") or "").strip()
        if jurisdiction:
            # The explicit D4/E4 source answer is authoritative. Classify it
            # in isolation so a stale model boolean cannot overrule values such
            # as ``No.`` or ``Not applicable.`` through truthiness.
            grounded["is_cross_border"] = classify_matter_cross_border({
                "cross_border_jurisdictions": jurisdiction,
            }) is True
        else:
            grounded["is_cross_border"] = None

        new_client_raw = str(source_fields.get("new_client_status") or "").strip()
        if new_client_raw:
            grounded["is_new_client"] = re.search(r'\byes\b|\bsí\b|\bsi\b|\bnew\b', new_client_raw, re.I) is not None
        else:
            grounded["is_new_client"] = None
        selected.append(grounded)

    dropped = [
        str(matter.get("source_label") or matter.get("client") or f"record-{index + 1}")
        for index, matter in enumerate(extracted_matters)
        if index not in used_indices
    ]
    report = {
        "passed": not missing and len(selected) == len(source_labels),
        "source_count": len(source_labels),
        "selected_count": len(selected),
        "missing_labels": missing,
        "duplicate_labels": duplicate_labels,
        "dropped_records": dropped,
    }
    return selected, report


def build_strategic_objective(context: Dict, metadata: Dict) -> StrategicObjective:
    """Resolve objective fields from explicit request context, never portfolio frequency."""

    directory = context.get("directory") or "Unspecified directory"
    # Document-extracted identity is authoritative. UI selections express the
    # requested workflow, but cannot relabel a Corporate M&A source as Banking.
    practice = metadata.get("practice_area") or context.get("practice_area") or "Unspecified practice"
    ranking_unit = metadata.get("location") or context.get("ranking_unit") or context.get("jurisdiction") or "Unspecified ranking unit"
    current = context.get("current_status") or "Unspecified current position"
    primary = context.get("primary_objective") or "Assess current ranking position"
    priority = context.get("strategic_priority") or primary
    return StrategicObjective(
        directory=str(directory),
        practice_area=str(practice),
        ranking_unit=str(ranking_unit),
        current_position=str(current),
        target=str(primary),
        priority=str(priority),
    )


def infer_transaction_role(source_text: str) -> Tuple[str, str]:
    """Infer only roles made semantically unequivocal by acquisition syntax."""

    acquisition = re.search(
        r"\b(?:acquisition|acquired)\b[\s\S]{0,220}?\bfrom\s+([A-Z][^\n.;,]{1,100})",
        source_text,
        re.IGNORECASE,
    )
    if acquisition:
        return "buyer", acquisition.group(1).strip()
    return "", ""


def build_canonical_submission(state: Dict) -> Tuple[CanonicalSubmission, List[str]]:
    """Create canonical state and fail-closed reconciliation errors."""

    pipeline_manifest = state.get("pipeline_manifest", {})
    doc_info = pipeline_manifest.get("document", {})
    source_info = doc_info.get("source_matters", {})
    metadata = state.get("metadata", {})
    context = state.get("submission_context", {})
    file_path = state.get("file_path", "")
    parsed_path = urlparse(file_path).path if str(file_path).startswith(("http://", "https://")) else str(file_path)
    extension = os.path.splitext(parsed_path)[1].lower().lstrip(".") or "docx"
    if extension not in {"doc", "docx", "pdf"}:
        extension = "docx"

    manifest = DocumentManifest(
        source_sha256=doc_info.get("file_hash", ""),
        source_format=extension,
        total_matters=int(source_info.get("total", 0)),
        publishable_matters=int(source_info.get("publishable", 0)),
        confidential_matters=int(source_info.get("confidential", 0)),
        matter_labels=list(source_info.get("matter_labels", [])),
    )
    objective = build_strategic_objective(context, metadata)

    matters: List[MatterRecord] = []
    spans: List[SourceSpan] = []
    gaps: List[GapRecord] = []
    source_claims: List[EvidenceClaim] = []
    status_counters = {"publishable": 0, "confidential": 0}
    source_sections = DocumentParser.extract_numbered_matter_sections(state.get("doc_text", ""))

    for index, raw in enumerate(state.get("matters", []), start=1):
        raw_status = raw.get("publish_status", "publishable")
        status = "confidential" if raw.get("is_confidential") or raw_status in {"confidential", "non_publishable"} else "publishable"
        status_counters[status] += 1
        fallback_label = f"{'Publishable' if status == 'publishable' else 'Confidential'} Matter {status_counters[status]}"
        source_label = str(raw.get("source_label") or fallback_label).strip()
        matter_id = f"matter-{index:02d}"
        deterministic_section = source_sections.get(source_label.lower(), {})
        excerpt = str(deterministic_section.get("text") or "").strip()
        model_excerpt = str(raw.get("source_excerpt") or "").strip()
        if not excerpt and model_excerpt and model_excerpt in state.get("doc_text", ""):
            excerpt = model_excerpt
        span_ids: List[str] = []
        if excerpt:
            span_id = f"{matter_id}-source"
            spans.append(
                SourceSpan(
                    span_id=span_id,
                    section=source_label,
                    text=excerpt,
                    matter_id=matter_id,
                    confidentiality=status,
                )
            )
            span_ids.append(span_id)
        else:
            gaps.append(
                GapRecord(
                    gap_id=f"{matter_id}-missing-source",
                    severity=GapSeverity.BLOCKING_FACTUAL,
                    subject_id=matter_id,
                    description="The extracted matter has no verbatim source excerpt.",
                    question="The system must recover the exact source passage for this matter before optimization.",
                )
            )

        inferred_role, inferred_counterparty = infer_transaction_role(excerpt)
        client_role = raw.get("client_role") or inferred_role or None
        counterparty = raw.get("counterparty") or inferred_counterparty or None
        if inferred_role and span_ids:
            source_claims.append(
                EvidenceClaim(
                    claim_id=f"{matter_id}-client-role",
                    text=(
                        f"{raw.get('client') or 'The client'} acted as {inferred_role}"
                        + (f" and the counterparty was {inferred_counterparty}" if inferred_counterparty else "")
                    ),
                    evidence_ids=span_ids,
                    support=EvidenceSupport.SEMANTIC,
                    semantic_role=inferred_role,
                )
            )

        matters.append(
            MatterRecord(
                matter_id=matter_id,
                source_label=source_label,
                publish_status=status,
                client=str(raw.get("client") or "Unknown client"),
                title=str(raw.get("title") or ""),
                source_span_ids=span_ids,
                lead_lawyers=[name.strip() for name in str(raw.get("lead_partner") or "").split(",") if name.strip()],
                client_role=client_role,
                counterparty=counterparty,
                matter_value=raw.get("matter_value") or raw.get("value") or None,
                value_type="unknown" if (raw.get("matter_value") or raw.get("value")) else None,
                completion_status=raw.get("completion_date") or None,
            )
        )

    lawyers: List[LawyerRecord] = []
    document_text = state.get("doc_text", "")
    for index, raw in enumerate(metadata.get("lawyers", []), start=1):
        name = str(raw.get("name") or "").strip()
        if not name:
            continue
        lawyer_span_ids: List[str] = []
        name_position = document_text.casefold().find(name.casefold())
        if name_position >= 0:
            line_start = document_text.rfind("\n", 0, name_position) + 1
            line_end = document_text.find("\n", name_position)
            if line_end < 0:
                line_end = len(document_text)
            lawyer_span_id = f"lawyer-{index:02d}-source"
            spans.append(
                SourceSpan(
                    span_id=lawyer_span_id,
                    section="Lawyer roster",
                    text=document_text[line_start:line_end].strip() or name,
                    confidentiality="internal",
                )
            )
            lawyer_span_ids.append(lawyer_span_id)
        else:
            gaps.append(
                GapRecord(
                    gap_id=f"lawyer-{index:02d}-missing-source",
                    severity=GapSeverity.BLOCKING_FACTUAL,
                    subject_id=f"lawyer-{index:02d}",
                    description=f"Extracted lawyer {name!r} is not present verbatim in the source.",
                    question="Please confirm the lawyer's exact source spelling and ranking status.",
                )
            )
        lawyers.append(
            LawyerRecord(
                lawyer_id=_slug(name),
                name=name,
                is_partner=raw.get("is_partner"),
                is_ranked=raw.get("is_ranked"),
                current_ranking=raw.get("current_ranking"),
                source_span_ids=lawyer_span_ids,
            )
        )

    canonical = CanonicalSubmission(
        manifest=manifest,
        objective=objective,
        source_spans=spans,
        matters=matters,
        lawyers=lawyers,
        source_claims=source_claims,
        gaps=gaps,
    )
    errors = list(reconcile_matter_register(manifest, matters).errors)
    source_lawyer_names = {
        _slug(str(item.get("name") or ""))
        for item in pipeline_manifest.get("source_lawyers", [])
        if item.get("name")
    }
    canonical_lawyer_names = {lawyer.lawyer_id for lawyer in lawyers}
    if source_lawyer_names and source_lawyer_names != canonical_lawyer_names:
        missing = sorted(source_lawyer_names - canonical_lawyer_names)
        extra = sorted(canonical_lawyer_names - source_lawyer_names)
        if missing:
            errors.append(f"Missing source lawyers: {', '.join(missing)}")
        if extra:
            errors.append(f"Unexpected lawyers outside source roster: {', '.join(extra)}")
    errors.extend(
        f"Missing verbatim source evidence for {gap.subject_id}"
        for gap in gaps
        if gap.severity == GapSeverity.BLOCKING_FACTUAL
    )
    return canonical, errors
