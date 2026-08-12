"""
v20.0: True Entity Extraction — merged best of v19.3 + ChatGPT 5.6 Sol solution.

Key improvements over v19.3:
  - Broader stoplist including sentence starters (For, From, To, Of, In, etc.)
  - Sol's _contains_stopword_only() for single-word rejection
  - company_names parameter for known-entity dictionary (Sol's key insight)
  - Typed returns always: List[Dict] with text/type
  - Person detection with Spanish linkword support (de, del, la, y)
  - Company suffix regex from Sol (handles "S.A. de C.V." properly)
"""

import re
import unicodedata
from typing import List, Dict, Optional, Set


# ============================================================
# STOPLISTS (merged v19.3 + Sol)
# ============================================================

DEFAULT_STOPWORDS = {
    # Sentence starters / generic words (from Sol)
    "the", "this", "that", "these", "those",
    "a", "an", "and", "or", "but",
    "for", "from", "to", "of", "in", "on", "at", "by", "with",
    "as", "it", "its", "is", "are", "was", "were",
    "has", "have", "had", "not", "no",

    # Legal / directory generic words (from v19.3 + Sol)
    "data", "protection", "privacy", "personal", "information",
    "law", "legal", "firm", "client",
    "company", "business", "matter",
    "case", "project", "transaction",
    "agreement", "contract",
    "regulation", "regulations",
    "authority", "authorities",
    "court", "government", "federal", "state", "local",
    "corporate", "commercial",
    "practice", "team",
    "partner", "associate",
    "counsel",
    "framework", "compliance",
    "advisory", "mandate",
    "enhancement", "regularisation",
    "implementation", "department",
    "operational", "strategic", "institutional",
    "article", "section", "chapter",
    "entity", "services", "service",
    "policy",

    # Common submission language (from v19.3)
    "advice", "advising", "assisting",
    "representing", "supporting",
    "work", "experience",
    "industry", "sector",

    # Chambers-specific false positives (from v19.3)
    "mexico", "mexican", "latin", "america",
    "chambers", "partners", "band",
    "submission", "directory", "ranking",
    "confidential", "publishable",
}

DEFAULT_STOP_PHRASES = {
    "data protection",
    "personal data",
    "personal data protection",
    "privacy law",
    "legal advice",
    "legal services",
    "corporate law",
    "commercial law",
    "the client",
    "the company",
    "the firm",
    "data protection framework",
    "data protection advisory",
    "data protection enhancement",
    "data protection regularisation",
    "latin america",
    "mexico city",
    "lead partner",
}

# Known regulations / authorities / legal acronyms.
DEFAULT_REGULATORY_ENTITIES = {
    "ARCO",
    "INAI",
    "LFPDPPP",
    "LGPDPPSO",
    "DOF",
    "PROFECO",
    "COFEPRIS",
    "GDPR",
    "CCPA",
    "LGPD",
}

# Single-token companies MUST come from a known-entity list.
DEFAULT_KNOWN_COMPANIES = {
    "Biocodex",
    "Chedraui",
}

COMPANY_PREFIXES = {
    "grupo", "group", "corporación", "corporation",
    "holding", "holdings", "bank", "banco",
    "tiendas", "hotel",
}

# Company suffix patterns as regex (Sol's approach — handles "S.A. de C.V.")
COMPANY_SUFFIX_PATTERNS = (
    r"S\.?A\.?\s+de\s+C\.?V\.?",
    r"S\.?A\.?B\.?",
    r"S\.?A\.?S\.?",
    r"S\.?A\.?",
    r"S\.?C\.?",
    r"S\.?\s*de\s+R\.?L\.?",
    r"LLC",
    r"L\.L\.C\.",
    r"Inc\.?",
    r"Incorporated",
    r"Ltd\.?",
    r"Limited",
    r"Corp\.?",
    r"Corporation",
    r"Holdings?",
)

# Simple set for _looks_like_company word-level check
COMPANY_SUFFIXES_SIMPLE = {
    "llc", "ltd", "limited", "inc", "corp", "corporation",
    "company", "co", "plc", "lp", "llp",
    "sa", "s.a", "s.a.", "sas", "s.a.s", "spa", "srl", "s.r.l",
    "s.c.", "s. de r.l.", "s.a.b.",
}


# ============================================================
# REGEX PATTERNS
# ============================================================

# Supports accented Spanish / European names.
TITLE_TOKEN = r"[A-ZÁÉÍÓÚÑÜ][A-Za-zÀ-ÖØ-öø-ÿ''\-]+"
UPPER_TOKEN = r"[A-ZÁÉÍÓÚÑÜ]{2,}(?:[-&][A-ZÁÉÍÓÚÑÜ]{2,})?"

TITLE_SEQUENCE_RE = re.compile(
    rf"\b{TITLE_TOKEN}(?:\s+{TITLE_TOKEN}){{1,4}}\b"
)

UPPER_COMPANY_RE = re.compile(
    rf"\b{UPPER_TOKEN}(?:\s+{UPPER_TOKEN})+\b"
)

# Company suffix regex — catches "Hermes S.A. de C.V."
# Requires at least ONE capitalized word before the suffix to avoid
# false positives like "a hospitality group" or "the team"
COMPANY_SUFFIX_RE = re.compile(
    rf"\b(?:[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ&.'\-]*\s+){{1,6}}"
    rf"(?:{'|'.join(COMPANY_SUFFIX_PATTERNS)})\b",
    re.IGNORECASE
)

# Person: 2-4 capitalized words with Spanish linkwords (Sol's pattern)
PERSON_RE = re.compile(
    r"\b"
    r"(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñü'\-]{1,30})"
    r"(?:\s+(?:de|del|la|las|los|y))?"
    r"(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñü'\-]{1,30})"
    r"(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñü'\-]{1,30}){0,2}"
    r"\b"
)

EVIDENCE_RE = re.compile(
    r"""
    \b(?:
        Evidence | Exhibit | Annex | Appendix | Supporting\s+Document
    )
    \s*
    (?:No\.?|Number|\#)?
    \s*
    [A-Z]?[\-:]?\s*
    \d+(?:[\-./]\d+)*[A-Z]?
    \b
    """,
    re.IGNORECASE | re.VERBOSE,
)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def _normalize(value: str) -> str:
    """Clean and normalize entity text."""
    return re.sub(r"\s+", " ", value).strip(" ,.;:()[]{}")


def _contains_stopword_only(value: str, stoplist: Set[str]) -> bool:
    """Sol's approach: reject if ALL words are generic/stopped."""
    words = value.split()
    if not words:
        return True
    # Reject single generic words like "Data", "Protection", "The"
    if len(words) == 1 and words[0].lower() in stoplist:
        return True
    # Reject candidates composed entirely of generic terms.
    return all(word.lower() in stoplist for word in words)


def _is_stopped(value: str, stopwords: Set[str], stopphrases: Set[str]) -> bool:
    """Enhanced stop-check: phrase match + word-level check."""
    normalized = value.casefold().strip()
    if normalized in stopphrases:
        return True
    words = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ]+", normalized)
    if not words:
        return True
    # Reject phrases made entirely from generic terms.
    if all(word in stopwords for word in words):
        return True
    return False


def _looks_like_company(value: str) -> bool:
    """Check if value matches company patterns."""
    words = value.split()
    if not words:
        return False
    first = re.sub(r"[^\w]", "", words[0]).casefold()
    last = re.sub(r"[^\w.]", "", words[-1]).casefold()
    if first in COMPANY_PREFIXES:
        return True
    if last in COMPANY_SUFFIXES_SIMPLE:
        return True
    # Multiple all-uppercase words: MEGA DIRECT
    if len(words) >= 2 and all(
        re.fullmatch(r"[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ&\-]{1,}", w)
        for w in words
    ):
        return True
    return False


def _looks_like_person(value: str, stopwords: Set[str]) -> bool:
    """Sol's enhanced person detection with Spanish linkwords."""
    words = value.split()
    if not (2 <= len(words) <= 5):
        return False

    # Extract significant words (skip linkwords)
    significant = [
        w for w in words
        if w.lower() not in {"de", "del", "la", "las", "los", "y"}
    ]
    if len(significant) < 2:
        return False

    # Any stopped word = not a person name
    if any(w.lower() in stopwords for w in significant):
        return False

    # Company prefix = not a person
    if re.sub(r"[^\w]", "", words[0]).casefold() in COMPANY_PREFIXES:
        return False

    # All significant words must be title-case
    return all(
        re.fullmatch(r"[A-ZÁÉÍÓÚÑ][a-záéíóúñü'\-]+", w)
        for w in significant
    )


# ============================================================
# MAIN FUNCTION
# ============================================================

def extract_true_entities(
    text: str,
    company_names: Optional[Set[str]] = None,
    known_companies: Optional[Set[str]] = None,
    regulatory_entities: Optional[Set[str]] = None,
    extra_stopwords: Optional[Set[str]] = None,
    extra_stopphrases: Optional[Set[str]] = None,
) -> List[Dict[str, str]]:
    """
    Extract conservative named entities from legal-directory text.

    v20.0: Always returns typed dicts: [{"text": "...", "type": "company|person|regulation|evidence"}]
    
    For legal pipelines, pass known client/company names via company_names parameter.
    This is critical — regex alone cannot determine whether "Hermes" is a company.
    
    Args:
        text: The text to extract entities from.
        company_names: Known company names for this submission (highest priority).
        known_companies: Default known single-word companies (merged with company_names).
        regulatory_entities: Known regulatory acronyms.
        extra_stopwords: Additional words to stop.
        extra_stopphrases: Additional phrases to stop.
    
    Returns:
        List of dicts: [{"text": "Grupo Hermes", "type": "company"}, ...]
    """
    if not text:
        return []

    # Merge company_names (per-submission) with known_companies (defaults)
    companies = set(known_companies or DEFAULT_KNOWN_COMPANIES)
    if company_names:
        companies.update(company_names)
    
    regulations = set(regulatory_entities or DEFAULT_REGULATORY_ENTITIES)

    stopwords = set(DEFAULT_STOPWORDS)
    if extra_stopwords:
        stopwords.update(x.casefold() for x in extra_stopwords)

    stopphrases = set(DEFAULT_STOP_PHRASES)
    if extra_stopphrases:
        stopphrases.update(x.casefold() for x in extra_stopphrases)

    results: List[Dict[str, str]] = []
    seen: Set[str] = set()

    def add(value: str, entity_type: str):
        value = _normalize(value)
        key = value.casefold()
        if not value or key in seen:
            return
        if _contains_stopword_only(value, stopwords):
            return
        if _is_stopped(value, stopwords, stopphrases):
            return
        seen.add(key)
        results.append({"text": value, "type": entity_type})

    # --------------------------------------------------------
    # 1. Evidence identifiers (highest priority)
    # --------------------------------------------------------
    for match in EVIDENCE_RE.finditer(text):
        add(match.group(), "evidence")

    # --------------------------------------------------------
    # 2. Known regulations (second priority)
    # --------------------------------------------------------
    for regulation in regulations:
        if re.search(
            rf"(?<!\w){re.escape(regulation)}(?!\w)",
            text, flags=re.IGNORECASE
        ):
            add(regulation, "regulation")

    # --------------------------------------------------------
    # 3. Known companies (third priority — from submission data)
    # --------------------------------------------------------
    for company in companies:
        if re.search(
            rf"(?<!\w){re.escape(company)}(?!\w)",
            text, flags=re.IGNORECASE
        ):
            add(company, "company")

    # --------------------------------------------------------
    # 4. Company suffix patterns: "X S.A. de C.V."
    # --------------------------------------------------------
    for match in COMPANY_SUFFIX_RE.finditer(text):
        candidate = _normalize(match.group())
        if not _contains_stopword_only(candidate, stopwords):
            add(candidate, "company")

    # --------------------------------------------------------
    # 5. ALL CAPS multi-word: MEGA DIRECT
    # --------------------------------------------------------
    for match in UPPER_COMPANY_RE.finditer(text):
        candidate = _normalize(match.group())
        # Skip if it's a known regulation
        tokens = candidate.split()
        if all(t.upper() in {r.upper() for r in regulations} for t in tokens):
            continue
        if len(tokens) >= 2:
            if not _contains_stopword_only(candidate, stopwords):
                add(candidate, "company")

    # --------------------------------------------------------
    # 6. Person names (Sol's regex with Spanish linkwords)
    # --------------------------------------------------------
    for match in PERSON_RE.finditer(text):
        candidate = _normalize(match.group())
        # Known company always beats person classification
        if candidate.casefold() in {c.casefold() for c in companies}:
            continue
        if _looks_like_person(candidate, stopwords):
            add(candidate, "person")

    # --------------------------------------------------------
    # 7. Title-case sequences (lowest priority fallback)
    # --------------------------------------------------------
    for match in TITLE_SEQUENCE_RE.finditer(text):
        candidate = _normalize(match.group())
        if _is_stopped(candidate, stopwords, stopphrases):
            continue
        if candidate.casefold() in seen:
            continue
        if _looks_like_company(candidate):
            add(candidate, "company")
        elif _looks_like_person(candidate, stopwords):
            add(candidate, "person")

    return results


def extract_entity_names(
    text: str,
    company_names: Optional[Set[str]] = None,
) -> Set[str]:
    """
    Convenience function: returns just entity text strings as a set.
    Drop-in replacement for the old naive regex approach.
    """
    entities = extract_true_entities(text, company_names=company_names)
    return {e["text"] for e in entities}


# ============================================================
# EXAMPLE
# ============================================================

if __name__ == "__main__":
    sample = """
    The Data Protection team advised Grupo Hermes, a hospitality group
    with nearly five decades of experience.

    María Fernández de la Torre represented Biocodex in proceedings
    involving INAI and ARCO.

    MEGA DIRECT supplied Evidence No. 123 and Exhibit #45.
    Tiendas Chedraui S.A. de C.V. retained the firm.
    """

    entities = extract_true_entities(
        sample,
        company_names={"Grupo Hermes", "MEGA DIRECT", "Biocodex"},
    )

    for e in entities:
        print(e)
