"""
Post-Validation Gates — v16.0 Programmatic Enforcement
=======================================================
These validators run AFTER LLM output and BEFORE passing data to the next node.
They enforce constitutional rules that prompt instructions alone cannot guarantee.

Philosophy: "If the LLM ignores a rule, the gate catches it."
"""

import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple


# ─────────────────────────────────────────────
# RANKING ARCHITECTURE VALIDATION LAYER (RAVL)
# ─────────────────────────────────────────────

_ranking_arch_cache = None

def _load_ranking_architecture() -> dict:
    """Load and cache the ranking architecture config."""
    global _ranking_arch_cache
    if _ranking_arch_cache is not None:
        return _ranking_arch_cache
    
    config_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "config", "ranking_architecture.json"
    )
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            _ranking_arch_cache = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"[RAVL] Warning: Could not load ranking_architecture.json: {e}")
        _ranking_arch_cache = {"combinations": [], "default_unknown": {
            "scenario": "D", "ranking_type": "unknown", "firm_bands_exist": False,
            "benchmark_prohibited_phrases": [], "editorial_guidance": ""
        }}
    return _ranking_arch_cache


def get_ranking_architecture(directory: str, guide: str, jurisdiction: str, 
                              practice_area: str) -> dict:
    """Look up the ranking architecture for a specific combination.
    
    Returns the matching combination config, or the default_unknown if not found.
    """
    config = _load_ranking_architecture()
    
    dir_lower = str(directory).lower().strip()
    jur_lower = str(jurisdiction).lower().strip()
    prac_lower = str(practice_area).lower().strip()
    
    for combo in config.get("combinations", []):
        # Match directory
        if combo.get("directory", "").lower() not in dir_lower and dir_lower not in combo.get("directory", "").lower():
            continue
        
        # Match jurisdiction
        if combo.get("jurisdiction", "").lower() not in jur_lower and jur_lower not in combo.get("jurisdiction", "").lower():
            continue
        
        # Match practice area (including aliases)
        practice_match = False
        combo_practice = combo.get("practice_area", "").lower()
        if combo_practice in prac_lower or prac_lower in combo_practice:
            practice_match = True
        else:
            for alias in combo.get("aliases", []):
                if alias.lower() in prac_lower or prac_lower in alias.lower():
                    practice_match = True
                    break
        
        if practice_match:
            print(f"[RAVL] Matched: {combo.get('directory')}/{combo.get('jurisdiction')}/{combo.get('practice_area')} → Scenario {combo.get('scenario')}")
            return combo
    
    # No match found — return default
    default = config.get("default_unknown", {})
    print(f"[RAVL] No match for {directory}/{jurisdiction}/{practice_area} → Scenario D (default)")
    return {
        **default,
        "directory": directory,
        "jurisdiction": jurisdiction,
        "practice_area": practice_area,
        "scenario": "D"
    }


# ─────────────────────────────────────────────
# VALIDATOR 1: EXTERNAL VALIDATION ELIMINATION
# ─────────────────────────────────────────────

# Patterns that indicate external validation reasoning
EXTERNAL_VALIDATION_PATTERNS = [
    r"(?i)external\s+validation",
    r"(?i)external\s+endorsement",
    r"(?i)lacks?\s+(?:external\s+)?(?:validation|endorsement|recognition)",
    r"(?i)secure\s+(?:client\s+)?testimonial",
    r"(?i)client\s+testimonial",
    r"(?i)referee\s+(?:support|strategy|feedback|evidence)",
    r"(?i)market\s+recognition\s+(?:is|remains|appears)",
    r"(?i)without\s+external\s+(?:validation|endorsement)",
    r"(?i)absence\s+of\s+(?:external\s+)?(?:validation|endorsement|referee)",
    r"(?i)no\s+external\s+(?:validation|endorsement|recognition)",
    r"(?i)external\s+(?:validation|endorsement)\s+(?:would|could|should|will)",
]

def validate_no_external_validation(text: str) -> Tuple[str, List[str]]:
    """Remove ALL references to external validation from text.
    
    Returns:
        Tuple of (cleaned_text, list_of_violations_found)
    """
    if not isinstance(text, str) or not text:
        return text, []
    
    violations = []
    result = text
    
    for pattern in EXTERNAL_VALIDATION_PATTERNS:
        matches = re.findall(pattern, result)
        if matches:
            violations.extend(matches)
    
    # Sentence-level removal: remove entire sentences containing these patterns
    sentences = re.split(r'(?<=[.!?])\s+', result)
    clean_sentences = []
    for sentence in sentences:
        has_violation = False
        for pattern in EXTERNAL_VALIDATION_PATTERNS:
            if re.search(pattern, sentence):
                has_violation = True
                break
        if not has_violation:
            clean_sentences.append(sentence)
    
    result = " ".join(clean_sentences)
    
    if violations:
        print(f"[VALIDATOR] External Validation Gate: removed {len(violations)} violations")
        for v in violations[:5]:
            print(f"  ❌ {v}")
    
    return result, violations


# ─────────────────────────────────────────────
# VALIDATOR 2: RANKING ARCHITECTURE ENFORCEMENT
# ─────────────────────────────────────────────

def validate_ranking_architecture(text: str, ranking_arch: dict) -> Tuple[str, List[str]]:
    """Remove prohibited phrases based on ranking architecture.
    
    If firm_bands_exist=False, removes all references to firm bands.
    """
    if not isinstance(text, str) or not text:
        return text, []
    
    violations = []
    result = text
    
    prohibited = ranking_arch.get("benchmark_prohibited_phrases", [])
    
    # Also add universal prohibitions when no firm bands
    if not ranking_arch.get("firm_bands_exist", False):
        config = _load_ranking_architecture()
        universal = config.get("universal_prohibited_when_no_firm_bands", [])
        prohibited = list(set(prohibited + universal))
    
    # Sentence-level removal for prohibited phrases
    sentences = re.split(r'(?<=[.!?])\s+', result)
    clean_sentences = []
    for sentence in sentences:
        has_violation = False
        for phrase in prohibited:
            if phrase.lower() in sentence.lower():
                has_violation = True
                violations.append(f"'{phrase}' in: {sentence[:80]}...")
                break
        if not has_violation:
            clean_sentences.append(sentence)
    
    result = " ".join(clean_sentences)
    
    if violations:
        print(f"[VALIDATOR] Ranking Architecture Gate: removed {len(violations)} violations (scenario={ranking_arch.get('scenario', '?')})")
        for v in violations[:5]:
            print(f"  ❌ {v}")
    
    return result, violations


# ─────────────────────────────────────────────
# VALIDATOR 3: PATH TO DOMINANCE ENFORCEMENT
# ─────────────────────────────────────────────

# Business action verbs that should NOT appear in editorial steps
BUSINESS_BLACKLIST = [
    "secure", "obtain", "acquire", "expand", "diversify", "develop",
    "build relationships", "grow", "invest in", "broaden", "enhance visibility",
    "strengthen your brand", "market expansion", "client acquisition",
    "business development", "revenue growth",
    # v17.4: Additional owner-flagged patterns
    "secure external validation", "diversify client outcomes",
    "expand cross-border", "pursue new clients", "attract new",
    "seek external", "obtain external", "gather testimonials",
    "increase revenue", "win new mandates", "target new",
    "recruit", "hire", "onboard new", "open new offices",
    "enter new markets", "expand into", "develop new practice",
    "increase market share", "grow the team", "build a network",
    "establish partnerships", "forge alliances", "seek endorsements",
    "external endorsements", "client testimonials",
    "cross-border capabilities", "international expansion",
]

# Editorial action verbs that SHOULD appear
EDITORIAL_WHITELIST = [
    "differentiate", "reorganise", "reorganize", "extract", "reframe",
    "restructure", "highlight", "amplify", "connect", "strengthen narrative",
    "present", "emphasize", "rewrite", "reorder", "redistribute", "clarify",
    "mine", "identify", "surface", "articulate", "consolidate",
    # v17.4: Additional editorial verbs
    "distil", "distill", "foreground", "reposition", "recalibrate",
    "thread", "sharpen", "map", "align", "annotate", "enrich",
    "integrate evidence", "weave", "unify", "strengthen coherence",
]

def validate_path_to_dominance(steps: List[dict]) -> Tuple[List[dict], List[str]]:
    """v17.4: Validate and filter path_to_dominance steps.
    
    HARD RULE: Steps with business language are REMOVED entirely.
    RankPilot is an editorial consultant, not a business consultant.
    The owner's rule: "Must tell them how to PRESENT evidence better,
    NOT how to develop their practice."
    """
    if not steps:
        return steps, []
    
    violations = []
    cleaned_steps = []
    
    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            cleaned_steps.append(step)
            continue
        
        title = str(step.get("title", "")).lower()
        description = str(step.get("description", "")).lower()
        what = str(step.get("what_must_be_delivered", "")).lower()
        intervention_level = step.get("intervention_level", 1)
        all_text = f"{title} {description} {what}"
        
        has_business = any(verb in all_text for verb in BUSINESS_BLACKLIST)
        
        if has_business:
            # v17.4: REMOVE business steps entirely — don't just reclassify
            violations.append(
                f"REMOVED Step {i+1} '{step.get('title', '')}': business language detected"
            )
            # Do NOT add to cleaned_steps
            continue
            
        # Always add editorial steps
        cleaned_steps.append(step)
    
    if violations:
        print(f"[VALIDATOR v17.4] Path to Dominance Gate: {len(violations)} business steps REMOVED")
        for v in violations:
            print(f"  🗑️ {v}")
    
    return cleaned_steps, violations


# ─────────────────────────────────────────────
# VALIDATOR 4: REALITY CHECK ENFORCEMENT
# ─────────────────────────────────────────────

SPECULATIVE_COMPARISON_PATTERNS = [
    r"(?i)firms?\s+(?:currently\s+)?(?:ranked|positioned)\s+in\s+Band",
    r"(?i)Band\s+\d+\s+(?:firms?|peers?|practices?)\s+(?:typically|usually|generally)",
    r"(?i)peer\s+firms?\s+(?:in|at|within)\s+(?:this|the)\s+(?:category|band|tier)",
    r"(?i)compared?\s+(?:to|with|against)\s+(?:other\s+)?(?:firms?|practices?)\s+(?:in|at)\s+Band",
    r"(?i)market\s+peers?\s+(?:typically|usually|demonstrate|present)",
]

def validate_reality_check(observations: List[str], ranking_arch: dict) -> Tuple[List[str], List[str]]:
    """Validate reality_check observations are internal consistency analysis,
    not speculative market comparisons.
    
    Removes observations that are purely speculative peer comparisons
    when no verified ranking data exists.
    """
    if not observations:
        return observations, []
    
    violations = []
    cleaned = []
    
    firm_bands_exist = ranking_arch.get("firm_bands_exist", False)
    
    for obs in observations:
        if not isinstance(obs, str):
            cleaned.append(obs)
            continue
        
        has_speculation = False
        if not firm_bands_exist:
            for pattern in SPECULATIVE_COMPARISON_PATTERNS:
                if re.search(pattern, obs):
                    has_speculation = True
                    violations.append(f"Speculative comparison: {obs[:100]}...")
                    break
        
        if not has_speculation:
            cleaned.append(obs)
        # If speculative and no firm bands → observation is dropped
    
    if violations:
        print(f"[VALIDATOR] Reality Check Gate: removed {len(violations)} speculative comparisons")
        for v in violations[:3]:
            print(f"  ❌ {v}")
    
    return cleaned, violations


# ─────────────────────────────────────────────
# VALIDATOR 5: CROSS-BORDER ENFORCEMENT
# ─────────────────────────────────────────────

CROSS_BORDER_PATTERNS = [
    r"(?i)(?:expand|develop|build|grow|strengthen)\s+cross.?border",
    r"(?i)cross.?border\s+(?:capabilities|capacity|work|experience|expansion|expertise|advisory|elements?|matters?|mandates?|signals?)",
    r"(?i)lacks?\s+cross.?border",
    r"(?i)absence\s+of\s+cross.?border",
    r"(?i)no\s+cross.?border\s+(?:work|evidence|matters?|signals?)",
    r"(?i)without\s+cross.?border",
    r"(?i)does\s+not\s+(?:currently\s+)?present\s+cross.?border",
    r"(?i)limited\s+cross.?border",
    r"(?i)lack\s+of\s+cross.?border",
    r"(?i)(?:undermined|weakened|limited)\s+by\s+(?:its\s+)?(?:lack\s+of\s+)?cross.?border",
    r"(?i)(?:insufficient|lacking)\s+cross.?border",
    r"(?i)cross.?border.*?(?:limits?\s|limitat|restrict|weaken|undermine)",
]

def validate_cross_border(text: str, is_relevant: bool) -> Tuple[str, List[str]]:
    """Remove cross-border recommendations when not relevant for the practice area.
    
    For domestic regulatory practices (data protection, compliance, tax, labour),
    cross-border is NOT an inherent requirement per owner directive.
    """
    if not isinstance(text, str) or not text or is_relevant:
        return text, []
    
    violations = []
    
    # Sentence-level removal
    sentences = re.split(r'(?<=[.!?])\s+', text)
    clean_sentences = []
    for sentence in sentences:
        has_violation = False
        for pattern in CROSS_BORDER_PATTERNS:
            if re.search(pattern, sentence):
                has_violation = True
                violations.append(f"Cross-border ref removed: {sentence[:80]}...")
                break
        if not has_violation:
            clean_sentences.append(sentence)
    
    result = " ".join(clean_sentences)
    
    if violations:
        print(f"[VALIDATOR] Cross-Border Gate: removed {len(violations)} irrelevant cross-border references")
    
    return result, violations


# ─────────────────────────────────────────────
# VALIDATOR 6: MATTER ENHANCEMENT VERIFICATION
# ─────────────────────────────────────────────

def validate_matter_enhancement(original_text: str, enhanced_text: str,
                                 min_preservation: float = 0.70) -> Tuple[bool, dict]:
    """Verify that matter enhancement preserved factual content.
    
    Checks:
    1. Word count: enhanced >= 70% of original (allows editorial compression)
    2. Key facts preserved (numbers, names, jurisdictions)
    
    Returns:
        Tuple of (is_valid, details_dict)
    """
    if not original_text or not enhanced_text:
        return True, {"reason": "empty input"}
    
    orig_words = len(original_text.split())
    enhanced_words = len(enhanced_text.split())
    
    word_ratio = enhanced_words / max(orig_words, 1)
    word_ok = word_ratio >= min_preservation
    
    # Extract key facts from original
    # Numbers (monetary values, counts, dates)
    orig_numbers = set(re.findall(r'\b\d[\d,.]+\b', original_text))
    enhanced_numbers = set(re.findall(r'\b\d[\d,.]+\b', enhanced_text))
    numbers_preserved = orig_numbers.issubset(enhanced_numbers)
    missing_numbers = orig_numbers - enhanced_numbers
    
    # Proper nouns (capitalized words that aren't sentence starters)
    # v17.0: Filter out raw_text field labels (Title, Client, Value, Summary, Significance, Lead, Partner)
    field_labels = {'Title', 'Client', 'Value', 'Summary', 'Significance', 'Lead', 'Partner', 'None', 'The', 'This', 'That', 'These', 'Their', 'There'}
    orig_proper = set(re.findall(r'(?<!\. )\b[A-Z][a-z]{2,}\b', original_text)) - field_labels
    enhanced_proper = set(re.findall(r'(?<!\. )\b[A-Z][a-z]{2,}\b', enhanced_text)) - field_labels
    # Legacy preservation check. Novel entities are separately rejected by the
    # canonical artifact validation layer; this check only detects omissions.
    if orig_proper:
        proper_ratio = len(orig_proper & enhanced_proper) / len(orig_proper)
    else:
        proper_ratio = 1.0
    proper_ok = proper_ratio >= 0.50
    
    is_valid = word_ok and numbers_preserved and proper_ok
    
    details = {
        "original_words": orig_words,
        "enhanced_words": enhanced_words,
        "word_ratio": round(word_ratio, 3),
        "word_ok": word_ok,
        "numbers_preserved": numbers_preserved,
        "missing_numbers": list(missing_numbers) if missing_numbers else [],
        "proper_noun_ratio": round(proper_ratio, 3),
        "proper_ok": proper_ok,
        "is_valid": is_valid,
    }
    
    if not is_valid:
        print(f"[VALIDATOR] Matter Enhancement Gate: FAILED")
        print(f"  Words: {orig_words} → {enhanced_words} (ratio={word_ratio:.2f}, min={min_preservation})")
        if missing_numbers:
            print(f"  Missing numbers: {missing_numbers}")
        if not proper_ok:
            print(f"  Proper noun preservation: {proper_ratio:.2f}")
    
    return is_valid, details


# ─────────────────────────────────────────────
# MASTER VALIDATOR: Apply all gates to analysis output
# ─────────────────────────────────────────────

def validate_analysis_output(analysis: dict, strategic_context: dict) -> Tuple[dict, dict]:
    """Apply all post-validation gates to the analysis node output.
    
    Args:
        analysis: The raw JSON output from the analysis LLM
        strategic_context: The strategic context from context_engine_node
    
    Returns:
        Tuple of (cleaned_analysis, validation_report)
    """
    report = {
        "external_validation": [],
        "ranking_architecture": [],
        "path_to_dominance": [],
        "reality_check": [],
        "cross_border": [],
        "total_violations": 0,
    }
    
    result = dict(analysis)
    
    # Get ranking architecture
    ranking_arch = get_ranking_architecture(
        strategic_context.get("directory", ""),
        strategic_context.get("directory_name", ""),
        strategic_context.get("jurisdiction", ""),
        strategic_context.get("practice_area", "")
    )
    
    cross_border_relevant = strategic_context.get("cross_border_relevant", True)
    
    # Apply to audit_letter if it exists
    audit = result.get("audit_letter", {})
    if isinstance(audit, dict):
        # 1. External Validation — apply to all text fields
        for field in ["the_state_of_play", "the_unfair_advantage", "competitive_context",
                      "competitive_positioning_text", "closing", "summary"]:
            if field in audit and isinstance(audit[field], str):
                audit[field], violations = validate_no_external_validation(audit[field])
                report["external_validation"].extend(violations)
            elif field in result and isinstance(result[field], str):
                result[field], violations = validate_no_external_validation(result[field])
                report["external_validation"].extend(violations)
        
        # Also check summary at top level
        if "summary" in result and isinstance(result["summary"], str):
            result["summary"], violations = validate_no_external_validation(result["summary"])
            report["external_validation"].extend(violations)
        
        # 2. Ranking Architecture — apply to text fields
        for field in ["the_state_of_play", "competitive_context", 
                      "competitive_positioning_text", "summary"]:
            if field in audit and isinstance(audit[field], str):
                audit[field], violations = validate_ranking_architecture(audit[field], ranking_arch)
                report["ranking_architecture"].extend(violations)
        if "summary" in result and isinstance(result["summary"], str):
            result["summary"], violations = validate_ranking_architecture(result["summary"], ranking_arch)
            report["ranking_architecture"].extend(violations)
        
        # 3. Reality Check
        if "the_reality_check" in audit and isinstance(audit["the_reality_check"], list):
            audit["the_reality_check"], violations = validate_reality_check(
                audit["the_reality_check"], ranking_arch
            )
            report["reality_check"].extend(violations)
        
        # 3b. External validation in reality check items
        if "the_reality_check" in audit and isinstance(audit["the_reality_check"], list):
            cleaned_checks = []
            for item in audit["the_reality_check"]:
                if isinstance(item, str):
                    item, violations = validate_no_external_validation(item)
                    report["external_validation"].extend(violations)
                    item, violations = validate_ranking_architecture(item, ranking_arch)
                    report["ranking_architecture"].extend(violations)
                    if not cross_border_relevant:
                        item, violations = validate_cross_border(item, cross_border_relevant)
                        report["cross_border"].extend(violations)
                    if item.strip():  # Only keep non-empty
                        cleaned_checks.append(item)
                else:
                    cleaned_checks.append(item)
            audit["the_reality_check"] = cleaned_checks
        
        # 4. Path to Dominance
        if "the_path_to_dominance" in audit and isinstance(audit["the_path_to_dominance"], list):
            audit["the_path_to_dominance"], violations = validate_path_to_dominance(
                audit["the_path_to_dominance"]
            )
            report["path_to_dominance"].extend(violations)
            
            # Also validate external validation and cross-border in step descriptions
            for step in audit["the_path_to_dominance"]:
                if isinstance(step, dict):
                    for field in ["title", "description", "what_must_be_delivered"]:
                        if field in step and isinstance(step[field], str):
                            step[field], violations = validate_no_external_validation(step[field])
                            report["external_validation"].extend(violations)
                            if not cross_border_relevant:
                                step[field], violations = validate_cross_border(step[field], cross_border_relevant)
                                report["cross_border"].extend(violations)
        
        # 5. Cross-border in ALL text fields (v17.6.1: comprehensive sweep)
        if not cross_border_relevant:
            # v17.6.1: Sweep ALL string fields in audit (catches reasoning trace, etc.)
            for field in list(audit.keys()):
                if isinstance(audit[field], str):
                    audit[field], violations = validate_cross_border(audit[field], cross_border_relevant)
                    report["cross_border"].extend(violations)
            # Also sweep top-level result fields
            for field in ["summary", "competitive_identity"]:
                if field in result and isinstance(result[field], str):
                    result[field], violations = validate_cross_border(result[field], cross_border_relevant)
                    report["cross_border"].extend(violations)
        
        result["audit_letter"] = audit
    
    # Calculate total
    report["total_violations"] = sum(len(v) for v in report.values() if isinstance(v, list))
    
    if report["total_violations"] > 0:
        print(f"\n{'='*60}")
        print(f"[POST-VALIDATION GATE] Total violations caught & fixed: {report['total_violations']}")
        print(f"  External Validation: {len(report['external_validation'])}")
        print(f"  Ranking Architecture: {len(report['ranking_architecture'])}")
        print(f"  Path to Dominance: {len(report['path_to_dominance'])}")
        print(f"  Reality Check: {len(report['reality_check'])}")
        print(f"  Cross-Border: {len(report['cross_border'])}")
        print(f"{'='*60}\n")
    else:
        print("[POST-VALIDATION GATE] ✅ All checks passed — no violations found")
    
    # Inject ranking architecture context into result for downstream nodes
    result["_ranking_architecture"] = {
        "scenario": ranking_arch.get("scenario", "D"),
        "ranking_type": ranking_arch.get("ranking_type", "unknown"),
        "firm_bands_exist": ranking_arch.get("firm_bands_exist", False),
        "editorial_guidance": ranking_arch.get("editorial_guidance", ""),
    }
    
    return result, report
