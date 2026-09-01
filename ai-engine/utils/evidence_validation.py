"""Fail-closed validation for canonical submissions and generated claims."""

from collections import Counter
import re
from typing import Iterable, List, Sequence

from core.contracts import (
    CanonicalSubmission,
    DocumentManifest,
    EvidenceClaim,
    EvidenceSupport,
    LawyerRecord,
    MatterRecord,
    ReconciliationResult,
)


def reconcile_matter_register(
    manifest: DocumentManifest,
    matters: Sequence[MatterRecord],
) -> ReconciliationResult:
    """Require exact totals and exact publish/confidential distribution."""

    extracted_total = len(matters)
    extracted_publishable = sum(m.publish_status == "publishable" for m in matters)
    extracted_confidential = sum(m.publish_status == "confidential" for m in matters)
    matter_ids = [m.matter_id for m in matters]
    errors: List[str] = []

    if extracted_total != manifest.total_matters:
        errors.append(
            f"Matter total mismatch: source={manifest.total_matters}, extracted={extracted_total}"
        )
    if extracted_publishable != manifest.publishable_matters:
        errors.append(
            "Publishable matter mismatch: "
            f"source={manifest.publishable_matters}, extracted={extracted_publishable}"
        )
    if extracted_confidential != manifest.confidential_matters:
        errors.append(
            "Confidential matter mismatch: "
            f"source={manifest.confidential_matters}, extracted={extracted_confidential}"
        )
    duplicate_ids = sorted(k for k, count in Counter(matter_ids).items() if count > 1)
    if duplicate_ids:
        errors.append(f"Duplicate matter IDs: {', '.join(duplicate_ids)}")

    return ReconciliationResult(
        passed=not errors,
        errors=errors,
        source_total=manifest.total_matters,
        extracted_total=extracted_total,
        missing_count=max(0, manifest.total_matters - extracted_total),
        over_extracted_count=max(0, extracted_total - manifest.total_matters),
    )


def validate_claim_grounding(
    claims: Iterable[EvidenceClaim],
    available_evidence_ids: Iterable[str],
) -> List[str]:
    """Return errors for unsupported claims or citations outside the ledger."""

    known = set(available_evidence_ids)
    errors: List[str] = []
    for claim in claims:
        if claim.support == EvidenceSupport.UNSUPPORTED:
            errors.append(f"Unsupported claim: {claim.claim_id}: {claim.text}")
            continue
        missing = sorted(set(claim.evidence_ids) - known)
        if missing:
            errors.append(
                f"Claim {claim.claim_id} cites unknown evidence: {', '.join(missing)}"
            )
    return errors


def reconcile_lawyer_roster(
    source_lawyers: Sequence[LawyerRecord],
    extracted_lawyers: Sequence[LawyerRecord],
) -> List[str]:
    """Require exact lawyer presence and exact ranked/partner flags."""

    source = {l.lawyer_id: l for l in source_lawyers}
    extracted = {l.lawyer_id: l for l in extracted_lawyers}
    errors: List[str] = []

    missing = sorted(source.keys() - extracted.keys())
    extra = sorted(extracted.keys() - source.keys())
    if missing:
        errors.append(f"Missing lawyers: {', '.join(missing)}")
    if extra:
        errors.append(f"Unexpected lawyers: {', '.join(extra)}")

    for lawyer_id in sorted(source.keys() & extracted.keys()):
        expected = source[lawyer_id]
        actual = extracted[lawyer_id]
        if expected.is_ranked != actual.is_ranked:
            errors.append(
                f"Ranking mismatch for {expected.name}: "
                f"source={expected.is_ranked}, extracted={actual.is_ranked}"
            )
        if expected.is_partner != actual.is_partner:
            errors.append(
                f"Partner mismatch for {expected.name}: "
                f"source={expected.is_partner}, extracted={actual.is_partner}"
            )
        if expected.current_ranking != actual.current_ranking:
            errors.append(
                f"Current ranking mismatch for {expected.name}: "
                f"source={expected.current_ranking!r}, extracted={actual.current_ranking!r}"
            )
    return errors


def validate_canonical_submission(submission: CanonicalSubmission) -> List[str]:
    """Run all deterministic validation available on a canonical submission."""

    errors = reconcile_matter_register(submission.manifest, submission.matters).errors
    evidence_ids = [span.span_id for span in submission.source_spans]
    errors.extend(validate_claim_grounding(submission.source_claims, evidence_ids))
    return errors


def validate_optimized_matter_text(
    matter: MatterRecord,
    optimized_text: str,
    source_text: str,
) -> List[str]:
    """Detect high-risk additions before optimized prose reaches a DOCX."""

    errors: List[str] = []
    if not optimized_text.strip():
        return [f"Empty optimized text for {matter.matter_id}"]
    client = matter.client.strip()
    client_is_unknown = client.casefold() in {
        "unknown client",
        "unknown",
        "not provided",
        "n/a",
    }
    if client and not client_is_unknown and client.casefold() not in optimized_text.casefold():
        errors.append(f"Client omitted from {matter.matter_id}: {matter.client}")

    # New numbers are almost always invented metrics, dates, values, counts, or
    # deadlines. Formatting punctuation is normalized before comparison.
    number_pattern = re.compile(r"(?<!\w)[$€£]?\d[\d.,%]*")
    normalize_number = lambda value: re.sub(r"[.,]", "", value.lower())
    source_numbers = {normalize_number(n) for n in number_pattern.findall(source_text)}
    output_numbers = {normalize_number(n) for n in number_pattern.findall(optimized_text)}
    novel_numbers = sorted(output_numbers - source_numbers)
    if novel_numbers:
        errors.append(
            f"Novel numeric claims in {matter.matter_id}: {', '.join(novel_numbers)}"
        )

    fabricated_work_markers = {
        "audit record",
        "accounting support",
        "full reconstruction",
        "evidence matrix",
        "evidence matrices",
        "procedural calendar",
        "procedural calendars",
        "executive risk memorandum",
        "executive risk memoranda",
        "reviewed invoices",
        "review of invoices",
        "tax returns",
        "performance guarantee",
        "bank guarantee",
        "guarantees",
    }
    source_lower = source_text.lower()
    output_lower = optimized_text.lower()
    added_markers = sorted(
        marker
        for marker in fabricated_work_markers
        if marker in output_lower and marker not in source_lower
    )
    if added_markers:
        errors.append(
            f"Unsupported work products in {matter.matter_id}: {', '.join(added_markers)}"
        )
    return errors


def validate_evidence_quotes(
    optimized_text: str,
    evidence_quotes: Sequence[str],
    source_text: str,
) -> List[str]:
    """Require literal, source-resolvable provenance for generated prose."""

    if optimized_text.strip() == source_text.strip():
        return []
    errors: List[str] = []
    quotes = [str(quote).strip() for quote in evidence_quotes if str(quote).strip()]
    if not quotes:
        return ["Generated matter has no evidence quotes"]
    unknown = [quote for quote in quotes if quote not in source_text]
    if unknown:
        errors.append(f"Evidence quotes absent from source: {unknown!r}")
    sentence_count = len(
        [sentence for sentence in re.split(r"(?<=[.!?])\s+", optimized_text.strip()) if sentence]
    )
    minimum_quotes = min(2, sentence_count)
    if len(quotes) < minimum_quotes:
        errors.append(
            f"Insufficient evidence mapping: {len(quotes)} quote(s) for {sentence_count} sentence(s)"
        )
    return errors


def validate_artifact_matter_register(
    canonical_matters: Sequence[MatterRecord],
    generated_matters: Sequence[dict],
) -> List[str]:
    """Require output count, order, status, and client identity to remain exact."""

    errors: List[str] = []
    if len(canonical_matters) != len(generated_matters):
        errors.append(
            "Generated matter total mismatch: "
            f"canonical={len(canonical_matters)}, generated={len(generated_matters)}"
        )
        return errors
    for index, (expected, actual) in enumerate(
        zip(canonical_matters, generated_matters), start=1
    ):
        actual_client = str(actual.get("client") or "").strip()
        if not actual_client and expected.client.casefold() == "unknown client":
            actual_client = "Unknown client"
        if actual_client.casefold() != expected.client.casefold():
            errors.append(
                f"Matter {index} client mismatch: canonical={expected.client!r}, generated={actual_client!r}"
            )
        actual_status = (
            "confidential"
            if actual.get("is_confidential")
            or actual.get("publish_status") in {"confidential", "non_publishable"}
            else "publishable"
        )
        if actual_status != expected.publish_status:
            errors.append(
                f"Matter {index} status mismatch: canonical={expected.publish_status}, generated={actual_status}"
            )
    return errors
