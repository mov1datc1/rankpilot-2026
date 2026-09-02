"""Deterministic checks between evidence patterns and the ranking objective."""

import re
from typing import Any, Dict, List, Sequence, Tuple


PRACTICE_KEYWORDS = {
    "real estate": {
        "real estate", "property", "properties", "land", "development",
        "zoning", "urban", "environmental", "lease", "construction",
        "condominium", "title", "easement", "country club",
    },
    "corporate/m&a": {
        "acquisition", "merger", "m&a", "corporate", "share purchase",
        "spa", "joint venture", "equity", "investment", "restructuring",
        "disposal", "sale",
    },
}


def practice_category_score(matter: Dict, practice_area: str) -> int:
    text = " ".join(
        str(matter.get(key) or "")
        for key in ("title", "client", "summary", "significance")
    ).lower()
    keywords = PRACTICE_KEYWORDS.get(practice_area.lower(), set())
    return sum(1 for keyword in keywords if keyword in text)


def select_objective_aligned_hero(
    matters: Sequence[Dict],
    practice_area: str,
    analysis_mode: str,
    proposed_hero: str = "",
) -> Tuple[str, List[str]]:
    """For market entry, category fit outranks spectacle or matter value."""

    if not matters or analysis_mode != "first_recognition":
        return proposed_hero, []
    scored = [
        (practice_category_score(matter, practice_area), index, matter)
        for index, matter in enumerate(matters)
    ]
    best_score, _, best = max(scored, key=lambda item: (item[0], -item[1]))
    best_name = str(best.get("title") or best.get("client") or "").strip()
    proposed_score = -1
    proposed_lower = proposed_hero.casefold()
    for score, _, matter in scored:
        name = str(matter.get("title") or matter.get("client") or "").strip()
        if name and (name.casefold() == proposed_lower or name.casefold() in proposed_lower or proposed_lower in name.casefold()):
            proposed_score = score
            break
    if best_score >= 1 and proposed_score < best_score:
        return best_name, [
            "Hero overridden for first recognition: category fit must precede scale, recurrence, or spectacle."
        ]
    return proposed_hero or best_name, []


def validate_thesis_objective(thesis: str, strategic_context: Dict) -> List[str]:
    """A vulnerability may be discussed, but must not become the central thesis."""

    ranking_unit = " ".join(
        str(strategic_context.get(key) or "")
        for key in ("ranking_unit", "jurisdiction", "target_realistic")
    ).lower()
    if "national" in ranking_unit or strategic_context.get("jurisdiction_type") == "national":
        if re.search(r"\b(?:jalisco|state|regional|local)[- ]cent(?:red|ered)\b", thesis, re.I):
            return ["A subnational concentration was promoted as the thesis for a national ranking objective."]
    return []


def repair_objective_conflicts(value: Any, strategic_context: Dict) -> Any:
    """Remove subnational-as-identity wording from any client-facing audit field.

    The regional concentration remains visible as a vulnerability; this repair only
    prevents it from being promoted into the central identity for a national goal.
    """

    if isinstance(value, dict):
        return {
            key: repair_objective_conflicts(item, strategic_context)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [repair_objective_conflicts(item, strategic_context) for item in value]
    if not isinstance(value, str) or not validate_thesis_objective(
        value, strategic_context
    ):
        return value
    return re.sub(
        r"\b(?:jalisco|state|regional|local)[- ]cent(?:red|ered)\b",
        "geographically concentrated",
        value,
        flags=re.I,
    ) + (
        " This concentration is a vulnerability against the national ranking "
        "objective, not the practice's defining identity."
    )


def build_objective_aligned_thesis(
    matters: Sequence[Dict], practice_area: str, ranking_unit: str
) -> str:
    """Create a factual fallback if the model repeats a harmful positioning."""

    ranked = sorted(
        matters,
        key=lambda matter: practice_category_score(matter, practice_area),
        reverse=True,
    )
    anchors = [
        str(matter.get("title") or matter.get("client") or "").strip()
        for matter in ranked
        if str(matter.get("title") or matter.get("client") or "").strip()
    ][:2]
    portfolio_text = " ".join(
        " ".join(str(matter.get(key) or "") for key in ("title", "summary", "significance"))
        for matter in matters
    ).lower()
    geography_catalogue = (
        "Mexico City", "Jalisco", "Guanajuato", "Durango", "Querétaro",
        "Nuevo León", "Puebla", "Yucatán", "Baja California", "Sonora",
    )
    geographies = [name for name in geography_catalogue if name.lower() in portfolio_text]
    anchor_clause = f", anchored in {' and '.join(anchors)}" if anchors else ""
    geography_clause = f" The documented portfolio spans {', '.join(geographies)}." if geographies else ""
    return (
        f"For the {ranking_unit or 'declared'} ranking objective, the submission presents a "
        f"{practice_area or 'practice-area'} practice{anchor_clause}."
        f"{geography_clause} The positioning is category-first and treats any geographic "
        "concentration as a vulnerability to manage, not as the practice's defining identity."
    )


def build_source_backed_b10_positioning(
    source_text: str,
    firm_name: str,
    practice_area: str,
    ranking_unit: str,
    hero_matter: str = "",
    supporting_matters: Sequence[str] = (),
) -> str:
    """Build a concise practice proposition using only source-detected patterns."""

    source_lower = (source_text or "").casefold()
    practice_lower = (practice_area or "").casefold()
    activity_catalogue = []
    if "real estate" in practice_lower:
        candidates = (
            (r"\b(?:zoning|urban|environmental|development)\b", "development, land-use and environmental matters"),
            (r"\b(?:property rights?|title|land ownership|easement)\b", "property-rights, title and land matters"),
            (r"\b(?:industrial|infrastructure)\b", "industrial and infrastructure assets"),
            (r"\b(?:amparo|constitutional|administrative proceedings?)\b", "constitutional and administrative proceedings affecting real assets"),
        )
    else:
        candidates = (
            (r"\b(?:acquisition|acquired)\b", "acquisitions"),
            (r"\b(?:market entry|enter(?:ing|ed)? the .{0,30}market|incorporat(?:ion|ed))\b", "market entry and business establishment"),
            (r"\b(?:restructur(?:ing|ed)|reorgani[sz](?:ation|ed)|downsizing)\b", "business restructurings"),
            (r"\b(?:disposal|divestment|liquidation|winding down|exit)\b", "disposals and business exits"),
            (r"\b(?:permits?|sanctions?|commerciali[sz]ation|distribution|banking relationship)\b", "regulatory and operational implementation"),
        )
    for pattern, label in candidates:
        if re.search(pattern, source_lower, re.I):
            activity_catalogue.append(label)

    def supported_anchor(anchor: str) -> bool:
        parts = [part.strip().casefold() for part in re.split(r"[/|]", anchor or "") if part.strip()]
        if not parts:
            return False
        for part in parts:
            if part in source_lower:
                continue
            tokens = [
                token for token in re.findall(r"[a-záéíóúüñ0-9]+", part)
                if len(token) > 3 and token not in {"with", "from", "matter"}
            ]
            if not tokens or not all(
                token in source_lower or token.rstrip("s") in source_lower
                for token in tokens
            ):
                return False
        return True

    anchors = []
    for anchor in (hero_matter, *supporting_matters):
        clean = str(anchor or "").strip()
        if clean and clean not in anchors and supported_anchor(clean):
            anchors.append(clean)
        if len(anchors) >= 3:
            break

    firm = firm_name or "The firm"
    practice = practice_area or "submitted practice"
    if activity_catalogue:
        if len(activity_catalogue) == 1:
            activities = activity_catalogue[0]
        else:
            activities = ", ".join(activity_catalogue[:-1]) + f" and {activity_catalogue[-1]}"
        sentences = [
            f"{firm}'s {practice} practice combines documented experience in {activities}."
        ]
    else:
        sentences = [f"{firm}'s {practice} practice is presented through the documented matter portfolio."]

    if anchors:
        if len(anchors) == 1:
            sentences.append(f"{anchors[0]} provides a central example of that practice experience.")
        else:
            sentences.append(
                f"{anchors[0]} provides a central example, supported by {' and '.join(anchors[1:])}."
            )

    ranking_lower = (ranking_unit or "").casefold()
    if "national" in ranking_lower or ranking_lower in {"mexico", "méxico"}:
        geography_catalogue = (
            "Mexico City", "Jalisco", "Guanajuato", "Durango", "Querétaro",
            "Nuevo León", "Puebla", "Yucatán", "Baja California", "Sonora",
        )
        geographies = [name for name in geography_catalogue if name.casefold() in source_lower]
        if len(geographies) >= 2:
            sentences.append(f"The documented matters span {', '.join(geographies)}.")
    return " ".join(sentences)


def compress_oversized_source_b10(original_text: str, max_words: int = 500) -> str:
    """Remove only high-confidence marketing boilerplate from an oversized B10.

    Chambers caps B10 at 500 words. Source preservation must not turn that cap
    into an impossible final gate, but factual sentences cannot be truncated.
    These narrowly defined, non-evidentiary phrases contain no client, lawyer,
    mandate, result, number or legal proposition. They are removed only when the
    submitted answer already exceeds the limit; all remaining text stays exact.
    """

    source = str(original_text or "").strip()
    if len(source.split()) <= max_words:
        return source

    low_signal_patterns = (
        r"We are a firm dedicated to the personalized provision of legal services in "
        r"administrative and tax matters, with a high degree of specialization\.\s*",
        r"Our vocation is customer service, seeking at all times to exceed any "
        r"expectations and solve problems in a comprehensive way\.\s*",
        r"We do this through experience, optimal preparation, persistence and "
        r"determination that distinguish us, taking as a guiding principle of our "
        r"actions the most solid ethical and moral principles\.\s*",
        r"We seek to build a long-term relationship of trust with our clients, "
        r"contributing with determination in the growth and overall vision development "
        r"of their projects, especially in the region of Guadalajara and throughout "
        r"the State of Jalisco, where most of our clients operate\.\s*",
        r"Your complete satisfaction is and will always be our goal, and our greatest "
        r"triumph\.\s*",
    )
    compressed = source
    for pattern in low_signal_patterns:
        if len(compressed.split()) <= max_words:
            break
        compressed = re.sub(pattern, "", compressed, count=1, flags=re.IGNORECASE).strip()
    return compressed


def compose_b10_with_budget(
    original_text: str,
    strategic_text: str = "",
    required_sentences: Sequence[str] = (),
    max_words: int = 500,
) -> str:
    """Add complete source-backed sentences without exceeding the B10 limit.

    The original answer is never truncated. The first strategic sentence and
    required accountability sentences receive priority; lower-priority
    strategic sentences are included only when they fit as complete sentences.
    """

    original = str(original_text or "").strip()
    if not original:
        return ""
    remaining = max_words - len(original.split())
    if remaining <= 0:
        return original

    strategic_sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", str(strategic_text or "").strip())
        if sentence.strip()
    ]
    candidates = []
    if strategic_sentences:
        candidates.append(strategic_sentences[0])
    candidates.extend(str(sentence or "").strip() for sentence in required_sentences)
    candidates.extend(strategic_sentences[1:])

    selected = []
    for sentence in candidates:
        if not sentence or sentence in selected:
            continue
        sentence_words = len(sentence.split())
        if sentence_words <= remaining:
            selected.append(sentence)
            remaining -= sentence_words
    return "\n\n".join([*selected, original]) if selected else original
