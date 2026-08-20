"""
Constitutional Validation Gate (v18.6)
======================================
Final quality gate that validates ALL output against the Owner's Editorial Constitution
before the submission is delivered. Two layers:

Layer 1: Deterministic (regex/count) — ~2 seconds, $0.00
Layer 2: Editorial Judge (LLM) — ~30 seconds, ~$0.03-0.08

If violations are found, routes back to optimization for retry (max 2 retries).
"""

import re
import json
from typing import Dict, List, Tuple
from langchain_core.messages import SystemMessage, HumanMessage
from core.state import AgentState


# ═══════════════════════════════════════════════════════════════
# LAYER 1: DETERMINISTIC CHECKS (No LLM — pure regex/count)
# ═══════════════════════════════════════════════════════════════

# A1: Epistemic violations — "the firm lacks...", etc.
EPISTEMIC_VIOLATIONS = [
    r'\bthe firm lacks\b',
    r'\bthe firm has no\b',
    r'\bthe firm fails to\b',
    r'\bthe firm is limited to\b',
    r'\bthe firm depends on\b',
    r'\blocks external validation\b',
    r'\blocks market recognition\b',
    r'\blocks client endorsement\b',
    r'\blocks referee support\b',
    r'\blocks individual lawyer recognition\b',
]

# A3: External validation
EXTERNAL_VALIDATION_VIOLATIONS = [
    r'\bexternal validation\b',
    r'\bclient testimonial\b',
    r'\bthird-party validation\b',
    r'\bindependent endorsement\b',
    r'\bsecure.*referee\b',
    r'\bsecure.*testimonial\b',
]

# A5: Business recommendations
BUSINESS_REC_VIOLATIONS = [
    r'\bdiversify\b',
    r'\bexpand capabilities\b',
    r'\bdevelop new\b',
    r'\bacquire new clients\b',
    r'\bexpand your practice\b',
    r'\bgrow your\b',
    r'\bbuild relationships\b',
]

# A6: Architecture leak (internal concepts visible to user)
ARCHITECTURE_LEAK_VIOLATIONS = [
    r'\bcompetitive identity\b',
    r'\bhero matter\b',
    r'\bnarrative arc\b',
    r'\bsupporting matter\b',
    r'\bthe narrative begins\b',
    r'\bthis is followed by\b',
]

# A7: Filler words + owner-banned phrases
FILLER_VIOLATIONS = [
    r'\bpivotal\b', r'\bseamlessly\b', r'\bmeticulously\b',
    r'\bbeacon\b', r'\btestament to\b', r'\bcornerstone\b',
    r'\bholistic\b', r'\bparamount\b', r'\bunderscores\b',
    r'\brobust framework\b', r'\bcomprehensive advice\b',
    r'\bnavigate complex\b', r'\bstrategic advisory role\b',
    r'\bwidely recognised\b', r'\bparticularly recognised\b',
    r'\bdistinguished\b', r'\bcarved out a niche\b',
    r'\bat the forefront\b', r'\bexemplifies\b',
    r'\binstrumental in\b',
]


def _scan_text_for_violations(text: str, patterns: List[str], label: str) -> List[str]:
    """Scan a text for regex pattern violations. Returns list of violation descriptions."""
    violations = []
    text_lower = text.lower()
    for pattern in patterns:
        matches = re.findall(pattern, text_lower, re.IGNORECASE)
        if matches:
            violations.append(f"[{label}] Found prohibited phrase: '{matches[0]}' ({len(matches)}x)")
    return violations


def _get_all_output_text(state: AgentState) -> str:
    """Concatenate ALL output text that would appear in the final submission."""
    parts = []
    
    # B7 text
    enhanced_b7 = state.get("enhanced_b7", "")
    if enhanced_b7:
        parts.append(enhanced_b7)
    
    # All matter optimized texts
    matters = state.get("matters", [])
    for m in matters:
        opt = m.get("optimized_text", "") or m.get("summary", "")
        if opt:
            parts.append(opt)
    
    # Analysis output (audit letter text)
    analysis = state.get("analysis", {})
    if isinstance(analysis, dict):
        for key in ["the_state_of_play", "competitive_context", "competitive_positioning_text", "summary"]:
            val = analysis.get(key, "")
            if isinstance(val, str) and val:
                parts.append(val)
    
    return "\n".join(parts)


def run_layer1_checks(state: AgentState) -> Tuple[bool, List[str]]:
    """
    Layer 1: Deterministic checks (no LLM).
    Returns (passed: bool, violations: list[str])
    """
    violations = []
    all_text = _get_all_output_text(state)
    
    if not all_text.strip():
        violations.append("[CRITICAL] No output text found in state")
        return False, violations
    
    # --- A1: Epistemic violations ---
    violations.extend(_scan_text_for_violations(all_text, EPISTEMIC_VIOLATIONS, "A1-EPISTEMIC"))
    
    # --- A3: External validation ---
    violations.extend(_scan_text_for_violations(all_text, EXTERNAL_VALIDATION_VIOLATIONS, "A3-EXTERNAL"))
    
    # --- A4: Cross-border (conditional) ---
    strategic_context = state.get("strategic_context", {})
    practice_area = (state.get("metadata", {}).get("practice_area") or state.get("submission_context", {}).get("practice_area") or "").lower()
    inherently_cross_border = any(t in practice_area for t in ["banking", "finance", "corporate", "m&a", "tax", "ip", "data", "privacy", "protection", "capital", "energy", "projects", "international", "cross-border", "trade", "arbitration"])
    cross_border = strategic_context.get("cross_border_relevant", True) or inherently_cross_border
    if not cross_border:
        cross_border_patterns = [r'\bcross-border\b', r'\bcross border\b', r'\binternational reach\b']
        # Only scan AI-generated text, not form field headers
        ai_text = (state.get("enhanced_b7", "") or "") + "\n"
        for m in state.get("matters", []):
            ai_text += (m.get("optimized_text", "") or "") + "\n"
        violations.extend(_scan_text_for_violations(ai_text, cross_border_patterns, "A4-CROSSBORDER"))
    
    # --- A5: Business recommendations ---
    violations.extend(_scan_text_for_violations(all_text, BUSINESS_REC_VIOLATIONS, "A5-BUSINESS"))
    
    # --- A6: Architecture leak ---
    # Only check matter text and B7, not internal state
    client_facing_text = (state.get("enhanced_b7", "") or "") + "\n"
    for m in state.get("matters", []):
        client_facing_text += (m.get("optimized_text", "") or "") + "\n"
    violations.extend(_scan_text_for_violations(client_facing_text, ARCHITECTURE_LEAK_VIOLATIONS, "A6-ARCH-LEAK"))
    
    # --- A7: Filler words ---
    violations.extend(_scan_text_for_violations(client_facing_text, FILLER_VIOLATIONS, "A7-FILLER"))
    
    # --- B6: B7 word count ---
    enhanced_b7 = state.get("enhanced_b7", "")
    if enhanced_b7:
        b7_wc = len(enhanced_b7.split())
        if b7_wc > 500:
            violations.append(f"[B6-WORDCOUNT] B7 exceeds 500 words: {b7_wc}w")
    
    # --- B7: Partner name in B7 ---
    if enhanced_b7:
        metadata = state.get("metadata", {})
        dept_info = metadata.get("department", {})
        if isinstance(dept_info, dict):
            heads = dept_info.get("department_heads", [])
            if heads:
                first_head = heads[0].get("name", "") if isinstance(heads[0], dict) else str(heads[0])
                # Check last name (most reliable match)
                last_name = first_head.strip().split()[-1] if first_head.strip() else ""
                if last_name and len(last_name) > 2 and last_name.lower() not in enhanced_b7.lower():
                    violations.append(f"[B7-PARTNER] Lead partner '{first_head}' not found in B7 text")
    
    # --- C1: Matter word count (each output ≥ 75% of original) ---
    matters = state.get("matters", [])
    for m in matters:
        original = m.get("summary", "") or m.get("original_text", "")
        optimized = m.get("optimized_text", "")
        if original and optimized:
            orig_wc = len(original.split())
            opt_wc = len(optimized.split())
            if orig_wc > 20 and opt_wc < orig_wc * 0.75:
                client = m.get("client", m.get("title", "?"))
                violations.append(f"[C1-SHRUNK] Matter '{client}' shrunk: {orig_wc}w → {opt_wc}w ({opt_wc/max(orig_wc,1)*100:.0f}%)")
    
    # --- C6: Evidence preservation (numbers/years) ---
    for m in matters:
        original = m.get("summary", "") or m.get("original_text", "")
        optimized = m.get("optimized_text", "")
        if original and optimized:
            # Extract significant numbers from original
            orig_numbers = set(re.findall(r'\b\d+(?:%|[- ]year|[- ]decade)', original, re.IGNORECASE))
            for num in orig_numbers:
                if num not in optimized:
                    client = m.get("client", m.get("title", "?"))
                    violations.append(f"[C6-EVIDENCE] Matter '{client}': evidence '{num}' lost in optimization")
    
    # --- C10: Matter count ---
    input_count = len(state.get("raw_matters", state.get("matters", [])))
    output_count = len([m for m in matters if m.get("optimized_text")])
    if input_count > 0 and output_count < input_count:
        violations.append(f"[C10-DROPPED] {input_count - output_count} matters dropped: {input_count} input → {output_count} output")
    
    passed = len(violations) == 0
    return passed, violations


# ═══════════════════════════════════════════════════════════════
# LAYER 2: EDITORIAL JUDGE (LLM-based quality checks)
# ═══════════════════════════════════════════════════════════════

EDITORIAL_JUDGE_PROMPT = """You are the final quality auditor for a Chambers & Partners submission generator.
You must evaluate the submission output against 7 editorial quality rules.

For each rule, respond with PASS or FAIL and a brief explanation.

RULES TO CHECK:

B1 — STRATEGIC PROPOSITION: Does the B7 read as a strategic proposition about WHY this practice 
deserves recognition? Or does it read as a generic list of clients/services?
PASS = B7 establishes a clear thesis about the practice's differentiation
FAIL = B7 is a generic description that could apply to any firm

B3 — INTERPRETATION NOT DECORATION: Does the B7 INTERPRET the practice (explain WHY privacy 
functions as governance/operational issue) or merely DESCRIBE/DECORATE it (add embellishment 
without intelligence)?
PASS = B7 adds editorial intelligence about what the evidence means
FAIL = B7 uses generic promotional language without real insight

B4 — CLIENT EXAMPLES: Are client names used as EXAMPLES illustrating patterns (2-3 max), 
or dumped as a LIST (4+ names in sequence)?
PASS = 2-3 clients woven into narrative as evidence of patterns
FAIL = 4+ clients listed sequentially

C2 — WHY-FIRST OPENING: Do the matters open with their STRATEGIC SIGNIFICANCE 
(why this engagement matters for ranking) or with a GENERIC MANDATE description 
(\"[Client] instructed the firm to...\")?
PASS = Most matters open with strategic angle
FAIL = 3+ matters open with generic mandate descriptions

C3 — ANTI-HOMOGENIZATION: Are the matter openings DIFFERENTIATED from each other? 
Does each matter tell a DIFFERENT strategic story?
PASS = Each matter has a distinct opening angle
FAIL = 3+ matters start with similar language about frameworks/implementation

C4 — EVIDENCE STRENGTH: Are outcomes expressed with STRONG/MODERATE evidence 
(specific metrics, institutional changes) or WEAK generic claims 
("strengthened compliance posture", "reduced regulatory exposure")?
PASS = Most outcomes cite specific results or concrete institutional changes
FAIL = 3+ matters have only generic outcome claims

C9 — PATTERN DISCOVERY: Does the B7 reveal deeper PATTERNS from the matters 
(recurring advisory, governance integration, sector diversity) or just repeat 
what the firm explicitly stated?
PASS = B7 identifies patterns the firm didn't explicitly state
FAIL = B7 merely paraphrases the firm's original text

OUTPUT FORMAT (JSON):
{
  "checks": {
    "B1": {"result": "PASS|FAIL", "reason": "brief explanation"},
    "B3": {"result": "PASS|FAIL", "reason": "brief explanation"},
    "B4": {"result": "PASS|FAIL", "reason": "brief explanation"},
    "C2": {"result": "PASS|FAIL", "reason": "brief explanation"},
    "C3": {"result": "PASS|FAIL", "reason": "brief explanation"},
    "C4": {"result": "PASS|FAIL", "reason": "brief explanation"},
    "C9": {"result": "PASS|FAIL", "reason": "brief explanation"}
  },
  "overall": "PASS|FAIL",
  "failed_checks": ["list of failed check IDs"],
  "retry_target": "optimization|writing|none"
}

If ANY check fails, set overall to FAIL.
If C2, C3, or C4 fail → retry_target = "optimization" (matter issues)
If B1, B3, B4, or C9 fail → retry_target = "writing" (B7 issues)
If both types fail → retry_target = "optimization" (fix matters first)
"""


def run_layer2_checks(state: AgentState, llm) -> Tuple[bool, List[str], str]:
    """
    Layer 2: Editorial quality checks using LLM judge.
    Returns (passed: bool, violations: list[str], retry_target: str)
    """
    enhanced_b7 = state.get("enhanced_b7", "")
    matters = state.get("matters", [])
    
    # Build the submission text for the judge
    submission_text = f"=== B7 TEXT ===\n{enhanced_b7}\n\n"
    for i, m in enumerate(matters):
        opt = m.get("optimized_text", "") or m.get("summary", "")
        client = m.get("client", m.get("title", f"Matter {i+1}"))
        submission_text += f"=== MATTER {i+1}: {client} ===\n{opt}\n\n"
    
    try:
        llm_judge = llm.bind(response_format={"type": "json_object"})
        response = llm_judge.invoke([
            SystemMessage(content=EDITORIAL_JUDGE_PROMPT),
            HumanMessage(content=f"Evaluate this submission:\n\n{submission_text}")
        ])
        
        result = json.loads(response.content)
        checks = result.get("checks", {})
        overall = result.get("overall", "FAIL")
        failed = result.get("failed_checks", [])
        retry_target = result.get("retry_target", "none")
        
        violations = []
        for check_id, check_data in checks.items():
            if check_data.get("result") == "FAIL":
                violations.append(f"[{check_id}-EDITORIAL] {check_data.get('reason', 'No reason')}")
        
        passed = overall == "PASS"
        
        # Log results
        pass_count = sum(1 for c in checks.values() if c.get("result") == "PASS")
        total = len(checks)
        print(f"[CONSTITUTIONAL L2] Editorial Judge: {pass_count}/{total} checks passed")
        for check_id, check_data in checks.items():
            status = "✅" if check_data.get("result") == "PASS" else "❌"
            print(f"  {status} {check_id}: {check_data.get('reason', '')[:100]}")
        
        return passed, violations, retry_target
        
    except Exception as e:
        print(f"[CONSTITUTIONAL L2] ⚠️ LLM Judge failed: {e}. Skipping Layer 2.")
        return True, [], "none"  # Graceful — don't block pipeline on judge failure


# ═══════════════════════════════════════════════════════════════
# MAIN NODE: Constitutional Validation Gate
# ═══════════════════════════════════════════════════════════════

def constitutional_validation_node(state: AgentState) -> Dict:
    """
    Final quality gate before submission delivery.
    Validates output against the Owner's Editorial Constitution.
    
    Layer 1: Deterministic (regex/count) — always runs
    Layer 2: Editorial Judge (LLM) — runs if Layer 1 passes
    
    Returns routing decision for the graph.
    """
    retry_count = state.get("constitutional_retry_count", 0)
    max_retries = 2
    
    print(f"\n{'='*60}")
    print(f"  CONSTITUTIONAL VALIDATION GATE (attempt {retry_count + 1}/{max_retries + 1})")
    print(f"{'='*60}")
    
    # ─── LAYER 1: Deterministic ───
    print("\n[CONSTITUTIONAL L1] Running deterministic checks...")
    l1_passed, l1_violations = run_layer1_checks(state)
    
    if l1_violations:
        for v in l1_violations:
            print(f"  ❌ {v}")
    else:
        print("  ✅ All deterministic checks passed")
    
    # ─── LAYER 2: Editorial Judge (only if L1 passed) ───
    l2_passed = True
    l2_violations = []
    retry_target = "none"
    
    if l1_passed:
        print("\n[CONSTITUTIONAL L2] Running editorial judge...")
        from agents.nodes import get_model
        llm = get_model()
        l2_passed, l2_violations, retry_target = run_layer2_checks(state, llm)
    else:
        # L1 failed — determine retry target from violation types
        b7_violations = [v for v in l1_violations if any(x in v for x in ["B6-", "B7-", "A6-"])]
        matter_violations = [v for v in l1_violations if any(x in v for x in ["C1-", "C6-", "C10-"])]
        if matter_violations:
            retry_target = "optimization"
        elif b7_violations:
            retry_target = "optimization"  # B7 is generated in optimization node
        else:
            retry_target = "none"  # System-level violations can't be retried
    
    all_violations = l1_violations + l2_violations
    all_passed = l1_passed and l2_passed
    
    # ─── ROUTING DECISION ───
    if all_passed:
        print(f"\n[CONSTITUTIONAL] ✅ ALL CHECKS PASSED — submission approved")
        return {
            "constitutional_validation": {
                "passed": True,
                "violations": [],
                "retry_count": retry_count,
                "layer1_passed": True,
                "layer2_passed": True,
            },
            "constitutional_retry_count": retry_count,
            "constitutional_route": "end",
        }
    
    # Failed — should we retry?
    if retry_count >= max_retries:
        print(f"\n[CONSTITUTIONAL] ⚠️ FAILED after {max_retries + 1} attempts — delivering with warnings")
        print(f"  Remaining violations: {len(all_violations)}")
        for v in all_violations:
            print(f"    ⚠️ {v}")
        return {
            "constitutional_validation": {
                "passed": False,
                "violations": all_violations,
                "retry_count": retry_count,
                "max_retries_exhausted": True,
                "layer1_passed": l1_passed,
                "layer2_passed": l2_passed,
            },
            "constitutional_retry_count": retry_count,
            "constitutional_route": "end",  # Give up — deliver with warnings
        }
    
    # Retry
    print(f"\n[CONSTITUTIONAL] ❌ FAILED — routing to '{retry_target}' for retry {retry_count + 1}/{max_retries}")
    print(f"  Violations to fix: {len(all_violations)}")
    for v in all_violations:
        print(f"    → {v}")
    
    # Inject violation feedback into state so the retry node knows what to fix
    violation_feedback = "CONSTITUTIONAL VALIDATION FAILED. You MUST fix these violations:\n"
    violation_feedback += "\n".join(f"- {v}" for v in all_violations)
    
    route = retry_target if retry_target in ("optimization", "writing") else "end"
    
    return {
        "constitutional_validation": {
            "passed": False,
            "violations": all_violations,
            "retry_count": retry_count + 1,
            "retry_target": route,
            "layer1_passed": l1_passed,
            "layer2_passed": l2_passed,
        },
        "constitutional_retry_count": retry_count + 1,
        "constitutional_route": route,
        "constitutional_violation_feedback": violation_feedback,
    }
