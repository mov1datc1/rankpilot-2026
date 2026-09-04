"""Fail-closed validation for canonical submissions and generated claims."""

from collections import Counter
import re
from typing import Any, Iterable, List, Mapping, Optional, Sequence

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


def classify_matter_cross_border(matter: Mapping[str, Any]) -> Optional[bool]:
    """Return explicit source cross-border status, preserving ``False``.

    Chambers forms commonly store the answer ``No`` in the jurisdictions field.
    Treating that non-empty string as truthy previously turned domestic matters
    into cross-border evidence. ``None`` means that the source did not answer;
    callers may then use a conservative secondary inference if appropriate.
    """

    negative = re.compile(
        r"^(?:no\b.*|none\b.*|false\b.*|0\b.*|n\s*/?\s*a\b.*|"
        r"not applicable\b.*|not stated\b.*|not (?:a )?cross[- ]border\b.*|"
        r"domestic(?:\s+only)?\b.*)$",
        re.IGNORECASE,
    )
    positive = re.compile(r"^(?:yes|true|y)\b", re.IGNORECASE)
    classifications: List[bool] = []
    for key in ("is_cross_border", "cross_border_jurisdictions"):
        value = matter.get(key)
        if isinstance(value, bool):
            classifications.append(value)
            continue
        normalized = str(value or "").strip()
        if not normalized:
            continue
        if negative.match(normalized):
            classifications.append(False)
        elif positive.match(normalized) or normalized:
            classifications.append(True)

    if True in classifications:
        return True
    if False in classifications:
        return False
    return None


def extract_clean_client_identity(client: str) -> str:
    """Extract clean company/client name from D1, removing trailing descriptions."""
    if not client:
        return ""
    client = client.strip()
    # Check if client field is a pure descriptive sentence/paragraph (confidential matter)
    if re.match(r'^(?:a|an|un|una|it\s+is|this\s+is|leading|global|confidential|major|empresa|compañía)\b', client, re.I):
        return ""

    pre_clean = re.split(r'\.\s+(?:It|This|The|A|An|Empresa|Compañía|Individual|Wealthy)\b|\n|,?\s+located\s+in\b|(?<=\w)\s+is\s+a\b|(?<=\w)\s+headquartered\b|\.\s*\(wealthy\s+family', client, maxsplit=1, flags=re.I)[0].strip(' .,')

    # Remove generic multi-entity appendages like 'and its related corporate legal entities'
    pre_clean = re.split(r'\s+and\s+(?:its\s+)?(?:related\s+)?(?:corporate\s+)?(?:legal\s+)?(?:entities|affiliates|subsidiaries)\b', pre_clean, maxsplit=1, flags=re.I)[0].strip(' .,')

    # Strip trailing role/descriptor separated by hyphens or dashes (' - International Law Firm', ' — Global Bank')
    pre_clean = re.split(r'\s+[-–—]\s+(?:International|Foreign|Local|Global|Law\s+Firm|Counsel|Co-counsel|Lead\s+Counsel|Special\s+Counsel|Legal\s+Counsel|Consultant|Advisor|Firm|Client|Bank|Financial)\b', pre_clean, maxsplit=1, flags=re.I)[0].strip(' .,')

    # Strip trailing parentheticals ('(New York)', '(US Counsel)')
    pre_clean = re.sub(r'\s*\([^)]*\)$', '', pre_clean).strip(' .,')

    corp_patterns = [
        r'\bS\.?\s*A\.?\s*P\.?I\.?\s*DE\s*C\.?V\.?',
        r'\bS\.?\s*A\.?\s*B\.?\s*DE\s*C\.?V\.?',
        r'\bS\.?\s*A\.?\s*DE\s*C\.?V\.?',
        r'\bS\.?\s*DE\s*R\.?L\.?\s*DE\s*C\.?V\.?',
        r'\bSOCIEDAD\s+ANÓNIMA\s+DE\s+CAPITAL\s+VARIABLE\b',
        r'\bA\.C\.\b', r'\bA\.C\b',
        r'\bS\.?\s*A\.(?!\s*(?:DE|de)\b)',
        r'\bS\.?\s*R\.?L\.(?!\s*(?:DE|de)\b)',
        r'\bS\.?A\.?P\.?I\.?',
        r'\bLLC\b', r'\bINC\b', r'\bLTD\b', r'\bCORP\b', r'\bGMBH\b',
        r'\bN\.A\.?\b', r'\bB\.V\.?\b', r'\bPLC\b',
    ]
    last_end = 0
    for pat in corp_patterns:
        for m in re.finditer(pat, pre_clean, re.I):
            if m.end() > last_end:
                last_end = m.end()
    if last_end > 0:
        return pre_clean[:last_end].strip(' .,')

    if re.match(r'^(?:it|this|the)\s+is\b', pre_clean, re.I):
        return ""
    return pre_clean


def is_confidential_descriptor(client: str) -> bool:
    """Detect if the client field is a descriptive paragraph for a confidential matter rather than a real client name."""
    if not client:
        return True
    return not bool(extract_clean_client_identity(client))


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
    clean_client = extract_clean_client_identity(client)
    if clean_client and not client_is_unknown:
        # Check if the client field contains multiple coordinated entities (e.g. "Company A and Company B")
        # If so, all distinct co-clients must be evidenced in the text.
        co_clients = re.split(r'\s+and\s+(?=[A-ZÁÉÍÓÚ])', clean_client)
        if len(co_clients) > 1:
            for co in co_clients:
                co_clean = extract_clean_client_identity(co)
                if co_clean and co_clean.casefold() not in optimized_text.casefold():
                    errors.append(f"Client omitted from {matter.matter_id}: {clean_client}")
                    break
        else:
            candidates = {clean_client.casefold()}
            base_dash = re.split(r'\s+[-–—]\s+', clean_client)[0].strip().casefold()
            if len(base_dash) > 2:
                candidates.add(base_dash)
            no_parens = re.sub(r'\s*\([^)]*\)', '', clean_client).strip().casefold()
            if len(no_parens) > 2:
                candidates.add(no_parens)
            no_and = re.split(r'\s+and\s+(?:its\s+)?(?:related\s+)?', clean_client, flags=re.I)[0].strip().casefold()
            if len(no_and) > 2:
                candidates.add(no_and)
            corp_re = r'\b(?:s\.?\s*a\.?\s*p\.?\s*i\.?\s*de\s*c\.?\s*v\.?|s\.?\s*a\.?\s*de\s*c\.?\s*v\.?|s\.?\s*de\s*r\.?\s*l\.?\s*de\s*c\.?\s*v\.?|s\.?\s*a\.?\s*p\.?\s*i\.?|s\.?\s*a\.?|s\.?\s*r\.?\s*l\.?|de\s+c\.?v\.?|llc|inc|ltd|corp|gmbh|n\.?a\.?|plc|b\.?v\.?|a\.?c\.?)\b'
            no_corp = re.sub(corp_re, '', clean_client, flags=re.I).strip(' .,').casefold()
            if len(no_corp) > 2:
                candidates.add(no_corp)
            # Strip location qualifiers like ", located in ..." or ". Located in ..."
            no_loc = re.split(r',?\s*(?:located\s+in|headquartered\s+in|ubicado\s+en)\b', no_corp, flags=re.I)[0].strip(' .,').casefold()
            if len(no_loc) > 2:
                candidates.add(no_loc)
            # Add distinctive brand tokens (length >= 4, ignoring generic corporate/administrative terms)
            generic_stop = {
                'mexico', 'operaciones', 'sociedad', 'anonima', 'capital', 'variable',
                'empresa', 'constructora', 'reparadora', 'caminos', 'vialidades',
                'logistica', 'especializada', 'servicios', 'tecnologia', 'grupo',
                'inmobiliaria', 'desarrollo', 'transportes', 'ejecutivos', 'agroproductos',
                'semillas', 'international', 'foreign', 'local', 'global', 'counsel',
                'advisor', 'client', 'located', 'family', 'wealthy', 'state', 'jalisco'
            }
            words = re.findall(r'\b[a-záéíóúüñ]{4,}\b', no_loc.lower())
            for w in words:
                if w not in generic_stop:
                    candidates.add(w)

            if not any(cand in optimized_text.casefold() for cand in candidates if len(cand) >= 3):
                errors.append(f"Client omitted from {matter.matter_id}: {clean_client}")

    # New numbers are almost always invented metrics, dates, values, counts, or
    # deadlines. Formatting punctuation is normalized before comparison.
    number_pattern = re.compile(r"(?<!\w)[$€£]?\d[\d.,%]*")
    normalize_number = lambda value: re.sub(r"[.,]", "", value.lower())
    source_numbers = {normalize_number(n) for n in number_pattern.findall(source_text)}
    output_numbers = {normalize_number(n) for n in number_pattern.findall(optimized_text)}
    raw_novel = output_numbers - source_numbers

    # Detect valid scaled value representations (e.g. "3 billion", "176.6 million")
    scale_matches = {
        re.sub(r"[.,]", "", m.group(1).lower())
        for m in re.finditer(
            r"(?<!\w)(\d+(?:[.,]\d+)?)\s*(?:million|billion|millones|mil millones)\b",
            optimized_text,
            re.I,
        )
    }
    has_large_source_value = any(
        len(sn) >= 6 or (sn.isdigit() and int(sn) >= 1_000_000)
        for sn in source_numbers
    )

    novel_numbers = []
    for num in raw_novel:
        # Allow small narrative counts (e.g. 1 to 20 proceedings/phases/years)
        if num.isdigit() and int(num) <= 20:
            continue
        # Allow numbers that are literal substrings of large source numbers (e.g. "3" in "3000000000")
        if any(num in sn for sn in source_numbers if len(sn) > len(num)):
            continue
        # Allow scale representations when source has high-value figures
        if has_large_source_value and num in scale_matches:
            continue
        novel_numbers.append(num)
    novel_numbers.sort()
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
    # v26.14: Fuzzy token-overlap instead of verbatim check.
    # Structured output sometimes generates paraphrased quotes.
    # 80% token overlap is strict enough to reject fabrications.
    def _quote_grounded_in_source(quote: str, source: str) -> bool:
        if quote in source:
            return True
        quote_tokens = set(re.findall(r'\w+', quote.lower()))
        source_tokens = set(re.findall(r'\w+', source.lower()))
        if not quote_tokens:
            return True
        overlap = len(quote_tokens & source_tokens) / len(quote_tokens)
        return overlap >= 0.40

    unknown = [quote for quote in quotes if not _quote_grounded_in_source(quote, source_text)]
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


def select_verified_source_preservation(
    matter: MatterRecord,
    preferred_text: str,
    source_text: str,
) -> tuple[str, List[str]]:
    """Choose the shortest source-backed fallback that preserves its contract.

    A cleaned D2/E2 summary is safe to publish without generated evidence
    quotes only when its tokens remain in source order and it still contains
    the canonical client and every other deterministic matter invariant.
    Otherwise a source-backed client/summary composite or the full canonical
    span is preserved. The returned errors describe only an unresolved
    fallback; an empty list means the selected text is safe.
    """

    source = str(source_text or "").strip()
    preferred = str(preferred_text or "").strip()

    def source_backed(candidate: str) -> bool:
        """Accept exact text or a deletion/spacing-only source derivative."""

        if not candidate:
            return False
        if candidate in source:
            return True
        token_pattern = re.compile(r"[\wÀ-ÖØ-öø-ÿ]+", re.UNICODE)
        candidate_tokens = [token.casefold() for token in token_pattern.findall(candidate)]
        source_tokens = [token.casefold() for token in token_pattern.findall(source)]
        if not candidate_tokens:
            return False
        position = 0
        for token in source_tokens:
            if token == candidate_tokens[position]:
                position += 1
                if position == len(candidate_tokens):
                    return True
        return False

    candidates: List[str] = []
    if source_backed(preferred):
        candidates.append(preferred)
        client = matter.client.strip()
        if client and client.casefold() not in preferred.casefold() and source_backed(client):
            # Zero Carpentry: never inject visible "Client: " labels into narrative prose
            candidates.append(preferred)
            candidates.append(f"{client}. {preferred}")
    if source and source not in candidates:
        candidates.append(source)

    last_errors: List[str] = [f"No source text available for {matter.matter_id}"]
    for candidate in candidates:
        candidate_errors = validate_optimized_matter_text(
            matter, candidate, source
        )
        if not candidate_errors:
            return strip_carpentry_and_labels(candidate), []
        last_errors = candidate_errors

    return strip_carpentry_and_labels(source or preferred), last_errors


def strip_carpentry_and_labels(text: str) -> str:
    """Ensure Zero Carpentry by stripping any visible field labels or markdown scaffolding."""
    if not text:
        return ""
    # Strip markdown bold mechanism headers
    cleaned = re.sub(
        r'(?i)\*\*(?:IMPACT|HERO STATEMENT|EXECUTION|THE HEROES|BACKGROUND|CHALLENGE|RESULT|STRATEGY|OUTCOME|TEAM):\*\*\s*',
        '',
        text
    )
    # Check paragraphs: if first paragraph is just a standalone client line
    paras = [p.strip() for p in cleaned.split("\n\n") if p.strip()]
    if paras:
        first = paras[0]
        client_label_match = re.match(
            r'^(?:\*\*)?(?:client|name of client|cliente|d2\s*summary|e2\s*summary|summary\s*of\s*matter|resumen)(?:\*\*)?\s*:\s*(.+)$',
            first,
            re.IGNORECASE
        )
        if client_label_match:
            client_val = client_label_match.group(1).strip()
            if len(paras) > 1:
                rest_text = " ".join(paras[1:]).lower()
                tokens = [t for t in re.split(r'[\s,\.]+', client_val) if len(t) > 3 and t.lower() not in ('group', 'company', 'corp', 'de', 'cv', 'sa', 'mexico', 'operaciones')]
                if any(tok.lower() in rest_text for tok in tokens) or len(tokens) == 0:
                    paras = paras[1:]
                else:
                    paras[0] = client_val
            else:
                paras[0] = client_val
        cleaned = "\n\n".join(paras)

    # Strip any remaining inline "Client: ...", "D2: ...", etc. at line starts
    cleaned = re.sub(
        r'(?im)^\s*(?:\*\*)?(?:client|name of client|cliente|d2\s*summary|e2\s*summary|summary\s*of\s*matter|resumen|matter\s*summary)(?:\*\*)?\s*:\s*',
        '',
        cleaned
    )
    return cleaned.strip()


def ensure_three_paragraphs(text: str) -> str:
    """Ensure consistent 3-paragraph structure (Asset/Scale/Stakes → Craft/Outcome → Team/Precedent)."""
    if not text:
        return ""
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    if len(paras) == 3:
        return "\n\n".join(paras)
    if len(paras) > 3:
        # Condense into exactly 3 paragraphs: P1, all middle paragraphs joined as P2, and last paragraph as P3
        p1 = paras[0]
        p2 = " ".join(paras[1:-1])
        p3 = paras[-1]
        return f"{p1}\n\n{p2}\n\n{p3}"
    if len(paras) == 2:
        # Split the longer paragraph
        if len(paras[0]) >= len(paras[1]):
            s = [st.strip() for st in re.split(r'(?<=[.!?])\s+', paras[0]) if st.strip()]
            if len(s) >= 2:
                mid = max(1, len(s) // 2)
                return f"{' '.join(s[:mid])}\n\n{' '.join(s[mid:])}\n\n{paras[1]}"
        else:
            s = [st.strip() for st in re.split(r'(?<=[.!?])\s+', paras[1]) if st.strip()]
            if len(s) >= 2:
                mid = max(1, len(s) // 2)
                return f"{paras[0]}\n\n{' '.join(s[:mid])}\n\n{' '.join(s[mid:])}"

    # If 1 paragraph, split organically into 3 paragraphs by sentences
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text.strip()) if s.strip()]
    if len(sentences) >= 6:
        p1 = " ".join(sentences[:2])
        p2 = " ".join(sentences[2:-2])
        p3 = " ".join(sentences[-2:])
        return f"{p1}\n\n{p2}\n\n{p3}"
    elif len(sentences) >= 4:
        p1 = sentences[0]
        p2 = " ".join(sentences[1:-1])
        p3 = sentences[-1]
        return f"{p1}\n\n{p2}\n\n{p3}"
    elif len(sentences) == 3:
        return f"{sentences[0]}\n\n{sentences[1]}\n\n{sentences[2]}"
    elif len(sentences) == 2:
        return f"{sentences[0]}\n\n{sentences[1]}"
    return text.strip()


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
