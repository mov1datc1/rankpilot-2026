"""
Language Guard — v7.0 Epistemic Safety Net
==========================================
Deterministic post-processor that scans ALL text output from the pipeline
and replaces forbidden epistemic patterns with submission-scoped alternatives.

This is the LAST line of defense — even if the LLM ignores prompt instructions,
this module will catch and fix definitive claims about the firm.

"Absence of evidence is NOT evidence of absence."
"""

import re
from typing import Any, Dict, List, Union


# ─────────────────────────────────────────────
# FORBIDDEN → REPLACEMENT PATTERN PAIRS
# Order matters: more specific patterns first
# ─────────────────────────────────────────────

EPISTEMIC_REPLACEMENTS = [
    # Specific compound phrases first
    ("lacks client diversity", "does not yet demonstrate sufficient client diversity in the submission"),
    ("lacks matter diversity", "does not yet demonstrate sufficient matter diversity in the submission"),
    ("lacks sector diversity", "does not yet demonstrate sufficient sector diversity in the submission"),
    ("lacks bench strength", "does not yet demonstrate sufficient bench strength in the submission"),
    ("lacks differentiation", "does not yet demonstrate sufficient differentiation in the submission"),
    ("lacks evidence", "does not yet present sufficient evidence in the submission"),
    
    # "The firm lacks..."
    ("The firm lacks", "The submission does not yet demonstrate sufficient"),
    ("the firm lacks", "the submission does not yet demonstrate sufficient"),
    
    # "The firm depends on..."
    ("The firm depends on", "Based on the presented evidence, the submission concentrates on"),
    ("the firm depends on", "based on the presented evidence, the submission concentrates on"),
    ("The firm depends heavily on", "The submission evidence concentrates significantly on"),
    ("the firm depends heavily on", "the submission evidence concentrates significantly on"),
    
    # "The firm is limited to..."
    ("The firm is limited to", "The current submission presents work primarily in"),
    ("the firm is limited to", "the current submission presents work primarily in"),
    
    # "The firm has no..."
    ("The firm has no", "The submission does not present"),
    ("the firm has no", "the submission does not present"),
    
    # "There is no evidence..."
    ("There is no evidence of", "The submission does not currently provide evidence of"),
    ("there is no evidence of", "the submission does not currently provide evidence of"),
    ("There is no evidence that", "The submission does not currently demonstrate that"),
    ("there is no evidence that", "the submission does not currently demonstrate that"),
    
    # "The firm fails to..."
    ("The firm fails to", "The submission does not currently"),
    ("the firm fails to", "the submission does not currently"),
    
    # "The firm is..." (limitation context)
    ("The firm is overly dependent", "The submission evidence is concentrated"),
    ("the firm is overly dependent", "the submission evidence is concentrated"),
    ("The firm is too concentrated", "The submission presents a concentrated"),
    ("the firm is too concentrated", "the submission presents a concentrated"),
    
    # Generic dependency language
    ("client dependency", "client concentration in the submission"),
    ("revenue dependency", "revenue concentration as presented"),
    ("over-reliance on", "concentration on"),
    ("over-dependent on", "concentrated on"),
    
    # Absolute negative assertions
    ("no cross-border work", "no cross-border work presented in the submission"),
    ("no international work", "no international work demonstrated in the submission"),
    ("no evidence of leadership", "insufficient leadership evidence in the submission"),
]


def apply_epistemic_filter(text: str) -> str:
    """Apply all epistemic replacements to a single text string.
    
    This is a deterministic, regex-free string replacement that catches
    the most common patterns of definitive claims about the firm.
    """
    if not isinstance(text, str) or not text:
        return text
    
    result = text
    for forbidden, replacement in EPISTEMIC_REPLACEMENTS:
        result = result.replace(forbidden, replacement)
    
    return result


def apply_to_dict(data: Any, max_depth: int = 10) -> Any:
    """Recursively apply epistemic filter to all string values in a dict/list.
    
    Args:
        data: The data structure to filter (dict, list, or scalar)
        max_depth: Maximum recursion depth to prevent infinite loops
    
    Returns:
        The same structure with all string values filtered
    """
    if max_depth <= 0:
        return data
    
    if isinstance(data, str):
        return apply_epistemic_filter(data)
    
    if isinstance(data, dict):
        return {k: apply_to_dict(v, max_depth - 1) for k, v in data.items()}
    
    if isinstance(data, list):
        return [apply_to_dict(item, max_depth - 1) for item in data]
    
    # Numbers, booleans, None — pass through unchanged
    return data


def filter_pipeline_output(result: Dict) -> Dict:
    """Apply epistemic filter to all relevant fields in the pipeline output.
    
    This is called in main.py BEFORE sending the response to Next.js.
    It filters: analysis, comprehension, competitive_identity, hypotheses,
    refutation_results, comparative_analysis, editorial_confidence,
    narrative_architecture, and reasoning_trace.
    
    Fields NOT filtered: metadata, matters (raw client data), strategic_context.
    """
    fields_to_filter = [
        "analysis",
        "comprehension", 
        "competitive_identity",
        "hypotheses",
        "refutation_results",
        "comparative_analysis",
        "editorial_confidence",
        "narrative_architecture",
        "reasoning_trace",
        "submission_blueprint",
    ]
    
    filtered = dict(result)  # shallow copy
    
    for field in fields_to_filter:
        if field in filtered and filtered[field]:
            filtered[field] = apply_to_dict(filtered[field])
    
    return filtered
