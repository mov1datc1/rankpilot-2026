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
    # ═══ PROHIBITED EDITORIAL TERMS (v7.1) ═══
    # These terms are banned across ALL prompts but may still leak
    ("high-sophistication firm", "a sophisticated practice"),
    ("High-sophistication firm", "A sophisticated practice"),
    ("a high-sophistication firm", "a firm with a sophisticated practice"),
    ("strategic plan", "editorial strategy"),
    ("market expansion", "editorial positioning"),
    ("operational excellence", "institutional capability"),
    ("value proposition", "competitive positioning"),
    ("leverage synergies", "build on institutional strengths"),
    ("optimize portfolio", "strengthen the submission narrative"),
    ("scalable model", "sustainable practice trajectory"),
    ("diversification", "practice breadth"),
    ("broaden client base", "demonstrate range beyond anchor clients"),
    ("Diversify your client base", "Demonstrate range beyond anchor clients in the submission"),
    ("diversify your client base", "demonstrate range beyond anchor clients in the submission"),
    ("Broaden your market presence", "Strengthen editorial positioning through evidence depth"),
    ("broaden your market presence", "strengthen editorial positioning through evidence depth"),
    ("Develop a strategic plan", "Develop an editorial positioning strategy"),
    ("develop a strategic plan", "develop an editorial positioning strategy"),

    # ═══ EPISTEMIC VIOLATIONS — Firm-wide claims ═══
    # Specific compound phrases first
    ("lacks client diversity", "does not yet demonstrate sufficient client diversity in the submission"),
    ("lacks matter diversity", "does not yet demonstrate sufficient matter diversity in the submission"),
    ("lacks sector diversity", "does not yet demonstrate sufficient sector diversity in the submission"),
    ("lacks bench strength", "does not yet demonstrate sufficient bench strength in the submission"),
    ("lacks differentiation", "does not yet demonstrate sufficient differentiation in the submission"),
    ("lacks evidence", "does not yet present sufficient evidence in the submission"),
    ("lacking broader", "not yet demonstrating broader"),
    ("Lacking broader", "Not yet demonstrating broader"),
    ("the lack of broader", "the absence of demonstrated broader"),
    ("The lack of broader", "The absence of demonstrated broader"),
    ("the lack of", "the absence of demonstrated"),
    ("The lack of", "The absence of demonstrated"),
    
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

    # ═══ v8.0: INDIRECT NEGATIVE FORMS ═══
    ("heavily concentrated on", "evidence is primarily drawn from"),
    ("is heavily concentrated", "evidence is primarily drawn from"),
    ("without demonstrating", "without yet presenting evidence of"),
    ("Without demonstrating", "Without yet presenting evidence of"),
    ("remains undemonstrated", "is not yet demonstrated in the submission"),
    ("is not supported by", "is not yet supported by evidence in the submission"),
    ("is not evidenced", "is not yet evidenced in the submission"),
    ("does not have", "does not present in the submission"),
    ("has not demonstrated", "has not yet demonstrated in the submission"),
    ("has not shown", "has not yet shown in the submission"),
    ("unable to demonstrate", "has not yet demonstrated in the submission"),
    
    # ═══ v8.0: CONSULTANT-SPEAK PATTERNS ═══
    ("should consider diversifying", "could strengthen the submission by presenting a broader range of"),
    ("Should consider diversifying", "Could strengthen the submission by presenting a broader range of"),
    ("would benefit from a plan to", "could strengthen the editorial narrative by"),
    ("needs to develop a strategy", "the submission narrative would benefit from"),
    ("Needs to develop a strategy", "The submission narrative would benefit from"),
    ("should consider expanding", "could strengthen the submission by including"),
    ("needs to invest in", "the submission would benefit from presenting"),
    ("must address the gap", "the submission could address this editorial dimension"),
    ("avoidable defects", "areas for editorial strengthening"),
    ("Avoidable defects", "Areas for editorial strengthening"),
    ("held back by", "could be strengthened by addressing"),
    ("Held back by", "Could be strengthened by addressing"),
    ("currently lacking", "not yet presenting"),
    ("Currently lacking", "Not yet presenting"),
    ("the firm should", "the submission could"),
    ("The firm should", "The submission could"),
    ("the firm needs to", "the submission narrative would benefit from"),
    ("The firm needs to", "The submission narrative would benefit from"),
    
    # ═══ v8.0: SPANISH EQUIVALENTS ═══
    ("El despacho carece de", "El submission no presenta aún evidencia de"),
    ("el despacho carece de", "el submission no presenta aún evidencia de"),
    ("El despacho depende de", "La evidencia presentada se concentra en"),
    ("el despacho depende de", "la evidencia presentada se concentra en"),
    ("No hay evidencia de", "El submission no presenta actualmente evidencia de"),
    ("no hay evidencia de", "el submission no presenta actualmente evidencia de"),
    ("El despacho no tiene", "El submission no presenta"),
    ("el despacho no tiene", "el submission no presenta"),
    ("La firma carece de", "El submission no presenta aún evidencia de"),
    ("la firma carece de", "el submission no presenta aún evidencia de"),
    ("La firma depende de", "La evidencia presentada se concentra en"),
    ("la firma depende de", "la evidencia presentada se concentra en"),
    ("falta de diversidad", "ausencia de diversidad demostrada en el submission"),
    ("falta de evidencia", "ausencia de evidencia en el submission"),

    # ═══ v9.0: DEPENDENCY LANGUAGE — Owner Observation 2 ═══
    ("appears highly dependent on", "emphasizes work in"),
    ("Appears highly dependent on", "Emphasizes work in"),
    ("appears dependent on", "emphasizes work in"),
    ("highly dependent on the", "concentrated in the"),
    ("Highly dependent on the", "Concentrated in the"),
    ("heavily reliant on", "concentrated on"),
    ("Heavily reliant on", "Concentrated on"),
    ("over-concentration on", "emphasis on"),
    ("over-concentration in", "emphasis in"),
    
    # ═══ v9.0: CONSULTANT-SPEAK — Owner Observation 4 ═══
    ("Consider broadening", "The submission could present a broader range of"),
    ("consider broadening", "the submission could present a broader range of"),
    ("Improve your positioning", "The submission's editorial positioning could be strengthened"),
    ("improve your positioning", "the submission's editorial positioning could be strengthened"),
    ("Enhance your visibility", "The submission could present more evidence of"),
    ("enhance your visibility", "the submission could present more evidence of"),
    ("expand your reach", "present a wider range of"),
    ("Expand your reach", "Present a wider range of"),
    ("strengthen your brand", "strengthen the editorial identity in the submission"),
    ("Strengthen your brand", "Strengthen the editorial identity in the submission"),
    ("develop a strategy", "develop the editorial narrative"),
    ("Develop a strategy", "Develop the editorial narrative"),
    ("invest in developing", "present evidence of"),
    ("Invest in developing", "Present evidence of"),
    ("needs to improve", "the submission would benefit from strengthening"),
    ("Needs to improve", "The submission would benefit from strengthening"),
    ("consider investing in", "present evidence of"),
    ("Consider investing in", "Present evidence of"),
    
    # ═══ v9.0: EVIDENCE COMPRESSION — Owner Observation 6 ═══
    ("various matters", "multiple documented matters"),
    ("various mandates", "multiple documented mandates"),
    ("several engagements", "multiple documented engagements"),
    ("a range of matters", "a documented portfolio of matters"),

    # ═══ v15.0: EXTERNAL VALIDATION NON-INFERENCE (RC-5) ═══
    ("lacks external validation", "does not include external validation evidence in the submission"),
    ("Lacks external validation", "Does not include external validation evidence in the submission"),
    ("it lacks external validation", "the submission does not include external validation evidence"),
    ("It lacks external validation", "The submission does not include external validation evidence"),
    ("lacks market recognition", "is not yet documented in the submission with market recognition evidence"),
    ("Lacks market recognition", "Is not yet documented in the submission with market recognition evidence"),
    ("lacks client endorsement", "does not include client endorsement in the submission"),
    ("lacks referee support", "does not include referee information in the submission"),
    ("lacks individual lawyer recognition", "does not yet include individual lawyer profiles in the submission"),
    ("Lacks individual lawyer recognition", "Does not yet include individual lawyer profiles in the submission"),
    ("it lacks external validation and individual lawyer recognition", "the submission does not yet include external validation or individual lawyer profile sections"),
    
    # ═══ v15.0: GENERIC PHRASE ELIMINATION (RC-9) ═══
    # These are empty filler phrases the LLM produces repeatedly
    ("played a pivotal role", "led the firm's work on"),
    ("plays a pivotal role", "leads the firm's work on"),
    ("pivotal role in", "central contribution to"),
    ("a pivotal role", "a central contribution"),
    ("robust framework", "operational framework"),
    ("robust compliance framework", "compliance framework"),
    ("comprehensive advice", "advice on"),
    ("comprehensive advisory", "advisory on"),
    ("enhanced compliance posture", "strengthened compliance operations"),
    ("complex regulatory landscape", "regulatory environment"),
    ("navigate complex", "address"),
    ("strategic advisory", "advisory"),
    ("sustainable operational practices", "operational practices"),
    ("fortifying", "strengthening"),
    ("fortified", "strengthened"),
    ("instrumental in", "contributed to"),
    ("demonstrating commitment", "demonstrating"),
    ("demonstrating a commitment", "demonstrating"),
    ("meticulously", ""),
    ("meticulous", "detailed"),
    ("ensuring long-term", "supporting sustained"),
    
    # v16.0: EXTERNAL VALIDATION — COMPLETE ELIMINATION (RC-5 Enforced)
    # Owner: "Eliminar completamente ese concepto del motor. RankPilot no evalua referees; evalua submissions."
    ("external validation", "submission-based evidence"),
    ("External validation", "Submission-based evidence"),
    ("external endorsement", "evidence presented in the submission"),
    ("External endorsement", "Evidence presented in the submission"),
    ("external endorsements", "evidence presented in the submission"),
    ("External endorsements", "Evidence presented in the submission"),
    ("secure external", "present additional"),
    ("Secure external", "Present additional"),
    ("client testimonials", "client evidence in the submission"),
    ("Client testimonials", "Client evidence in the submission"),
    ("referee support", "evidence depth"),
    ("Referee support", "Evidence depth"),
    ("referee strategy", "evidence strategy"),
    ("Referee strategy", "Evidence strategy"),
    ("referee feedback", "submission evidence"),
    ("Referee feedback", "Submission evidence"),
    ("market recognition", "editorial positioning"),
    ("Market recognition", "Editorial positioning"),
    ("without external", "within the submission evidence"),
    ("Without external", "Within the submission evidence"),
    ("absence of external", "absence of documented"),
    ("Absence of external", "Absence of documented"),
    
    # v16.0: BUSINESS CONSULTING PHRASES — Owner Feedback Points 3, 5
    # Owner: "RankPilot no pretende decirle a una firma como desarrollar su practica"
    ("Secure client testimonials", "Present additional evidence of client impact already in the submission"),
    ("secure client testimonials", "present additional evidence of client impact already in the submission"),
    ("Diversify client outcomes", "Present a broader range of outcomes already evidenced in the submission"),
    ("diversify client outcomes", "present a broader range of outcomes already evidenced in the submission"),
    ("Diversify Client Outcomes", "Present a broader range of outcomes already evidenced in the submission"),
    ("Expand cross-border capabilities", "Strengthen presentation of any cross-border work already documented"),
    ("expand cross-border capabilities", "strengthen presentation of any cross-border work already documented"),
    ("Expand Cross-Border Capabilities", "Strengthen presentation of any cross-border work already documented"),
    ("Secure external validation", "Strengthen evidence depth in the submission"),
    ("secure external validation", "strengthen evidence depth in the submission"),
    ("Obtain market recognition", "Present evidence that supports editorial recognition"),
    ("obtain market recognition", "present evidence that supports editorial recognition"),
    ("Build client relationships", "Present evidence of existing client relationships"),
    ("build client relationships", "present evidence of existing client relationships"),
    ("Grow your practice", "Strengthen the editorial narrative of the practice"),
    ("grow your practice", "strengthen the editorial narrative of the practice"),
    ("Invest in marketing", "Strengthen evidence presentation"),
    ("invest in marketing", "strengthen evidence presentation"),
    
    # v16.0: SPECULATIVE FIRM COMPARISONS — Owner Feedback Point 2, 4
    # Owner: "Band 5 como nivel de firmas no existe en esta categoria"
    ("Band 5 firms", "practices at this level"),
    ("Band 4 firms", "practices at this level"),
    ("Band 3 firms", "practices at this level"),
    ("Band 2 firms", "practices at this level"),
    ("Band 1 firms", "leading practices"),
    ("entry-level firms", "practices seeking initial recognition"),
    ("Entry-level firms", "Practices seeking initial recognition"),
    ("peer firms in this category", "practices in this area"),
    ("Peer firms in this category", "Practices in this area"),
    ("peer firms typically", "practices in this area generally"),
    ("Peer firms typically", "Practices in this area generally"),
    ("firms currently positioned in Band", "practices currently recognised at"),
    ("Firms currently positioned in Band", "Practices currently recognised at"),
    ("firms ranked in Band", "practices recognised at"),
    ("Firms ranked in Band", "Practices recognised at"),
]


# ─────────────────────────────────────────────
# SUBMISSION VOICE SANITIZER (v22.0)
# Removes meta-evaluative commentary and audit voice from Chambers submission texts
# ─────────────────────────────────────────────

SUBMISSION_VOICE_REPLACEMENTS = [
    # Meta-evaluative framing
    ("For ranking purposes, the matter provides", "The engagement provides"),
    ("for ranking purposes, the matter provides", "the engagement provides"),
    ("For ranking purposes, ", ""),
    ("for ranking purposes, ", ""),
    ("For ranking purposes", ""),
    ("for ranking purposes", ""),
    
    # Audit voice in matter opening / significance
    ("This is important ranking evidence because", "The mandate addressed critical operational requirements, as"),
    ("this is important ranking evidence because", "the mandate addressed critical operational requirements, as"),
    ("is important ranking evidence because", "addressed critical operational requirements, as"),
    ("is important ranking evidence", "represents significant operational work"),
    ("Is important ranking evidence", "Represents significant operational work"),
    
    ("The defining significance of this mandate lies in", "The mandate centered on"),
    ("the defining significance of this mandate lies in", "the mandate centered on"),
    ("is the defining significance of", "is a central feature of"),
    ("The defining significance of", "The core scope of"),
    ("the defining significance of", "the core scope of"),
    
    # Meta-evidence claims
    ("This is the submission's clearest matter-led evidence", "A key demonstration of our practice"),
    ("this is the submission's clearest matter-led evidence", "a key demonstration of our practice"),
    ("This is the submission's clearest evidence", "A key demonstration of our practice"),
    ("this is the submission's clearest evidence", "a key demonstration of our practice"),
    
    ("The evidenced mandates for", "Our mandates for"),
    ("the evidenced mandates for", "our mandates for"),
    ("The evidenced mandates", "Our mandates"),
    ("the evidenced mandates", "our mandates"),
    
    ("This matter demonstrates", "The engagement involved"),
    ("this matter demonstrates", "the engagement involved"),
    ("The matter demonstrates", "The engagement involved"),
    ("the matter demonstrates", "the engagement involved"),
    
    ("provides the submission with concrete evidence", "provides documented experience"),
    ("provides the submission with evidence", "provides documented experience"),
    ("provides the submission with", "provides"),
    ("Provides the submission with", "Provides"),
    
    ("reinforces the practice's identity", "reinforces our operational focus"),
    ("reinforces the practice's operational-governance identity", "reinforces our operational governance advisory"),
    ("The submitted work connects", "Our work connects"),
    ("the submitted work connects", "our work connects"),
    ("is significant to the submission narrative because", "is significant because"),
    ("Is significant to the submission narrative because", "Is significant because"),
    
    ("provides concrete evidence of institutional change", "established meaningful institutional governance"),
    ("Provides concrete evidence of institutional change", "Established meaningful institutional governance"),
]


def sanitize_submission_voice(text: str) -> str:
    """v22.0: Strip all meta-evaluative, audit-voice artifacts from submission text.
    
    Guarantees that phrases like 'for ranking purposes', 'this matter demonstrates',
    or 'on the present three-matter record' never reach the final Chambers DOCX.
    """
    if not isinstance(text, str) or not text:
        return text
    
    result = text
    
    # Regex cleans for dynamic patterns like 'on the present X-matter record'
    result = re.sub(
        r'(?i)\bOn the present\s+(?:\w+|\d+)-matter record,?\s*(?:however,?\s*)?',
        '',
        result
    )
    result = re.sub(
        r'(?i)\bon the present\s+(?:\w+|\d+)-matter record,?\s*(?:however,?\s*)?',
        '',
        result
    )
    
    # Static string replacements
    for forbidden, replacement in SUBMISSION_VOICE_REPLACEMENTS:
        result = result.replace(forbidden, replacement)
    
    # Clean up double spaces or awkward leading commas resulting from removals
    result = re.sub(r'  +', ' ', result)
    result = re.sub(r'\(\s*,', '(', result)
    result = re.sub(r'^\s*,\s*', '', result)
    result = re.sub(r'\.\s*,\s*', '. ', result)
    
    return result.strip()


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
    
    Also sanitizes submission fields (matters, B7, B10, C2) with sanitize_submission_voice.
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
    
    # v22.0: Sanitize submission-facing outputs with submission voice sanitizer
    if "enhanced_b7" in filtered and filtered["enhanced_b7"]:
        filtered["enhanced_b7"] = sanitize_submission_voice(filtered["enhanced_b7"])
    if "enhanced_b10" in filtered and filtered["enhanced_b10"]:
        filtered["enhanced_b10"] = sanitize_submission_voice(filtered["enhanced_b10"])
    if "optimized_matters" in filtered and filtered["optimized_matters"]:
        for m in filtered["optimized_matters"]:
            if isinstance(m, dict):
                for k in ["summary", "significance", "optimized_text"]:
                    if k in m and m[k]:
                        m[k] = sanitize_submission_voice(m[k])
    
    return filtered
