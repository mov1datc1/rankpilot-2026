"""
Constitutional Validation Gate (v18.6)
======================================
Final quality gate that validates ALL output against the Owner's Editorial Constitution
before the submission is delivered. Two layers:

Layer 1: Deterministic (regex/count) — ~2 seconds, $0.00
Layer 2: Editorial Judge (LLM) — ~30 seconds, ~$0.03-0.08

If violations are found, routes back to optimization for retry (max 2 retries),
then blocks delivery. Judge or schema failures block immediately.
"""

import re
import json
from typing import Dict, List, Literal, Tuple
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage
from core.state import AgentState
from utils.evidence_validation import classify_matter_cross_border


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
        if m.get("_source_fallback"):
            continue
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

    contract_checks = (
        ("SOURCE", state.get("source_validation", {})),
        ("EVIDENCE", state.get("evidence_reconciliation", {})),
        ("ARTIFACT", state.get("artifact_validation", {})),
    )
    for label, check in contract_checks:
        if check and not check.get("passed", False):
            details = check.get("errors") or check.get("matter_rollbacks") or []
            violations.append(f"[{label}-CONTRACT] {details or 'validation failed'}")
    artifact = state.get("artifact_validation", {})
    if artifact.get("matter_rollbacks"):
        violations.append(
            f"[ARTIFACT-ROLLBACK] {len(artifact['matter_rollbacks'])} matter(s) failed grounding"
        )
    extraction = state.get("pipeline_manifest", {}).get("extraction", {})
    if extraction and not extraction.get("match", False):
        violations.append("[REGISTER-CONTRACT] Source and extracted matter registers do not match")
    
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
        # Scan only generated B7 insertions. The original B10 is preserved
        # verbatim and cannot become a violation merely because it contains a
        # source-authored phrase.
        enhanced_b7 = state.get("enhanced_b7", "") or ""
        original_b10 = state.get("original_b10", "") or ""
        generated_b7 = enhanced_b7
        if original_b10 and original_b10 in generated_b7:
            generated_b7 = generated_b7.replace(original_b10, "", 1)
        ai_text = generated_b7 + "\n"
        for m in state.get("matters", []):
            if m.get("_source_fallback"):
                continue
            if classify_matter_cross_border(m) is True:
                continue
            ai_text += (m.get("optimized_text", "") or "") + "\n"
        violations.extend(_scan_text_for_violations(ai_text, cross_border_patterns, "A4-CROSSBORDER"))
    
    # --- A5: Business recommendations ---
    violations.extend(_scan_text_for_violations(all_text, BUSINESS_REC_VIOLATIONS, "A5-BUSINESS"))
    
    # --- A6: Architecture leak ---
    # Only check matter text and B7, not internal state
    client_facing_text = (state.get("enhanced_b7", "") or "") + "\n"
    for m in state.get("matters", []):
        if m.get("_source_fallback"):
            continue
        client_facing_text += (m.get("optimized_text", "") or "") + "\n"
    violations.extend(_scan_text_for_violations(client_facing_text, ARCHITECTURE_LEAK_VIOLATIONS, "A6-ARCH-LEAK"))
    
    # --- A7: Filler words ---
    violations.extend(_scan_text_for_violations(client_facing_text, FILLER_VIOLATIONS, "A7-FILLER"))
    
    # --- B6: B10 word count ---
    enhanced_b7 = state.get("enhanced_b7", "")
    if enhanced_b7:
        b7_wc = len(enhanced_b7.split())
        if b7_wc > 500:
            violations.append(f"[B6-WORDCOUNT] B10 exceeds 500 words: {b7_wc}w")
    
    # --- B7: Partner name in B10 narrative ---
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
                    violations.append(f"[B7-PARTNER] Lead partner '{first_head}' not found in B10 text")
    
    # Matter length is evidence-conditioned. Grounding and proposition
    # preservation are enforced by the canonical artifact validator, not by a
    # word-count ratio that could incentivize unsupported expansion.
    matters = state.get("matters", [])
    
    # --- C6: Evidence preservation (numbers/years) ---
    for m in matters:
        original = m.get("summary", "") or m.get("original_text", "")
        optimized = m.get("optimized_text", "")
        if original and optimized:
            # Extract significant numbers from original (e.g. 18%, 18-year, 18 years)
            orig_matches = set(re.findall(r'\b(\d+)\s*(?:%|[- ]years?|[- ]decades?)', original, re.IGNORECASE))
            opt_lower = optimized.lower()
            for num_val in orig_matches:
                # Check if the numeric digit exists flexibly in optimized prose (e.g. "18" in "18-year")
                if not re.search(rf'\b{num_val}\b', opt_lower):
                    client = m.get("client", m.get("title", "?"))
                    violations.append(f"[C6-EVIDENCE] Matter '{client}': evidence '{num_val}' lost in optimization")
    
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

EDITORIAL_JUDGE_PROMPT = """You are RankPilot's independent final release judge.
Compare the original Chambers source, deterministic manifest, canonical record,
optimized submission and Strategic Audit together. Use the structured response
schema supplied by the API. Return passed=true only if every mandatory check
passes; include one check record for each category below.

REGISTER — No source matter is split, merged, omitted, duplicated, reordered or
reclassified. Publishable/confidential counts and labels match exactly.

FIELD PROVENANCE — Every client, value, jurisdiction, lead lawyer, team member,
other firm and date remains attached to its own source matter. Joint clients
remain joint. No fact, outcome, metric, role or significance was invented.

LAWYERS — Every submitted lawyer and source current-ranking status is preserved.
The Strategic Audit gives each lawyer an evidence-backed proposition or a
specific evidence question when the source cannot support one.

B10 STRATEGY — B10/B7 states a clear, differentiated, source-backed recognition
thesis; it is not generic marketing, a client dump or decorative boilerplate.

MATTER QUALITY — Each optimized matter is accurate, clear, distinct and useful,
opens on a source fact, preserves material evidence and states outcomes only
when the source states them.

STRATEGIC AUDIT — The Audit is decision-useful, objective-aligned and specific
about strengths, vulnerabilities, ranking case, matters and lawyers. It turns
real evidence gaps into precise questions. It never exposes pipeline terms,
pre-flight failures, model profiles, internal diagnostics or architecture.

DETERMINISTIC CONTRACTS — Any failed source, extraction, evidence or artifact
contract is automatically a release failure and cannot be overruled. DOCX/OOXML
packaging is validated separately after your editorial approval.

Set retryable=true only when another optimization pass can correct wording.
Identity, register, provenance, tool/schema and deterministic contract failures
are not retryable. Never treat judge/tool/schema uncertainty as a pass.
For every check, identify its component and list the canonical matter_id values
that require revision. Use an empty list when the check is not matter-specific.
"""


class JudgeCheck(BaseModel):
    check_id: str = Field(description="Stable concise check identifier")
    component: Literal[
        "register",
        "field_provenance",
        "lawyers",
        "b10_strategy",
        "matter_quality",
        "strategic_audit",
        "deterministic_contracts",
    ]
    affected_matter_ids: List[str] = Field(
        description="Canonical matter_id values affected by this check; empty if not matter-specific"
    )
    passed: bool
    reason: str


class FinalJudgeVerdict(BaseModel):
    passed: bool
    retryable: bool = Field(description="True only when optimization can correct the failure")
    summary: str
    violations: List[str]
    checks: List[JudgeCheck]


def build_judge_retry_plan(verdict: Dict) -> Tuple[str, List[str], List[str]]:
    """Route a retry only to the component that owns each failed check."""

    if verdict.get("passed") or not verdict.get("retryable"):
        return "none", [], []

    scopes = set()
    matter_ids = set()
    non_retryable_components = {
        "register", "field_provenance", "deterministic_contracts"
    }
    missing_matter_targets = False
    for check in verdict.get("checks") or []:
        if check.get("passed"):
            continue
        component = str(check.get("component") or check.get("check_id") or "").casefold()
        if any(name in component for name in non_retryable_components):
            return "none", [], []
        if "strategic_audit" in component or "lawyer" in component:
            scopes.add("audit")
        elif "b10" in component:
            scopes.add("b10")
        elif "matter" in component:
            scopes.add("matters")
            check_matter_ids = {
                str(value).strip().casefold()
                for value in check.get("affected_matter_ids") or []
                if str(value).strip()
            }
            if not check_matter_ids:
                missing_matter_targets = True
            matter_ids.update(check_matter_ids)

    # Never turn an imprecise matter-quality observation into a full portfolio
    # rerun. The judge must identify exact canonical IDs before matter prose is
    # sent back to the optimizer.
    if not scopes or missing_matter_targets:
        return "none", [], []
    route = "analysis" if "audit" in scopes else "optimization"
    return route, sorted(scopes), sorted(matter_ids)


def run_layer2_checks(state: AgentState, llm) -> Tuple[bool, List[str], str, Dict]:
    """Run the independent Sol release judge; every error fails closed."""

    judge_payload = {
        "source_document": state.get("doc_text", ""),
        "source_manifest": state.get("pipeline_manifest", {}).get("document", {}),
        "canonical_submission": state.get("canonical_submission", {}),
        "optimized_submission": state.get("optimized_submission", {}),
        "strategic_audit": state.get("strategic_audit", {}),
        "deterministic_validations": {
            "source": state.get("source_validation", {}),
            "extraction": state.get("pipeline_manifest", {}).get("extraction", {}),
            "evidence": state.get("evidence_reconciliation", {}),
            "artifact": state.get("artifact_validation", {}),
        },
        "objective": state.get("strategic_objective", {}),
    }
    try:
        structured_judge = llm.with_structured_output(
            FinalJudgeVerdict, method="json_schema", strict=True
        )
        result = structured_judge.invoke([
            SystemMessage(content=EDITORIAL_JUDGE_PROMPT),
            HumanMessage(content=(
                "Evaluate this complete release candidate. Return a pass only when both "
                "deliverables are source-faithful and strategically useful.\n\n"
                + json.dumps(judge_payload, ensure_ascii=False, default=str)
            )),
        ])
        verdict = result.model_dump() if hasattr(result, "model_dump") else dict(result)
        violations = list(verdict.get("violations") or [])
        for check in verdict.get("checks") or []:
            if not check.get("passed"):
                violation = f"[{check.get('check_id', 'JUDGE')}] {check.get('reason', '')}"
                if violation not in violations:
                    violations.append(violation)
        if not verdict.get("passed") and not violations:
            violations.append(
                "[JUDGE] " + str(verdict.get("summary") or "Release judge returned FAIL")
            )
        passed = bool(verdict.get("passed")) and not violations
        retry_target, retry_scopes, retry_matter_ids = build_judge_retry_plan(verdict)
        verdict["retry_scopes"] = retry_scopes
        verdict["retry_matter_ids"] = retry_matter_ids
        print(
            f"[CONSTITUTIONAL L2] Sol release judge: "
            f"{'PASS' if passed else 'FAIL'} ({len(violations)} violations)"
        )
        return passed, violations, retry_target, verdict
    except Exception as exc:
        violation = f"[JUDGE-ERROR] Sol release judge failed: {type(exc).__name__}: {exc}"
        print(f"[CONSTITUTIONAL L2] ❌ {violation}")
        return False, [violation], "none", {
            "passed": False,
            "retryable": False,
            "summary": violation,
            "violations": [violation],
            "checks": [],
        }


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
    # One targeted retry is the maximum. Re-running every matter three times can
    # turn a recoverable wording issue into a 40-minute wait. Deterministic and
    # contract failures remain non-retryable and fail immediately.
    max_retries = 1
    
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
    l2_passed = False
    l2_violations = []
    retry_target = "none"
    retry_scopes = []
    retry_matter_ids = []
    judge_verdict = {}
    
    if l1_passed:
        print("\n[CONSTITUTIONAL L2] Running editorial judge...")
        from utils.model_factory import create_chat_model
        llm = create_chat_model("judge")
        l2_passed, l2_violations, retry_target, judge_verdict = run_layer2_checks(state, llm)
        retry_scopes = list(judge_verdict.get("retry_scopes") or [])
        retry_matter_ids = list(judge_verdict.get("retry_matter_ids") or [])
    else:
        # L1 failed — determine retry target from violation types
        # A word-limit defect is deterministic and cannot be repaired by
        # rerunning every matter. B10 partner/architecture wording remains
        # retryable; B6 fails once if upstream source budgeting ever misses it.
        b7_violations = [v for v in l1_violations if any(x in v for x in ["B7-", "A6-"])]
        matter_violations = [v for v in l1_violations if "C6-" in v]
        register_violations = [v for v in l1_violations if "C10-" in v]
        non_retryable_l1 = any(
            marker in violation
            for violation in l1_violations
            for marker in (
                "-CONTRACT]", "ARTIFACT-ROLLBACK", "CRITICAL]",
                "B6-WORDCOUNT", "C10-DROPPED",
            )
        )
        canonical_matters = state.get("canonical_submission", {}).get("matters", [])
        current_matters = state.get("matters", [])
        for index, matter in enumerate(current_matters):
            client = str(matter.get("client") or matter.get("title") or "").strip()
            if not client or not any(f"Matter '{client}':" in v for v in matter_violations):
                continue
            canonical = canonical_matters[index] if index < len(canonical_matters) else {}
            matter_id = str(
                canonical.get("matter_id")
                or matter.get("matter_id")
                or f"matter-{index + 1:02d}"
            ).casefold()
            retry_matter_ids.append(matter_id)
        if non_retryable_l1 or register_violations:
            retry_target = "none"
        elif matter_violations and retry_matter_ids:
            retry_target = "optimization"
            retry_scopes = ["matters"]
            retry_matter_ids = sorted(set(retry_matter_ids))
        elif b7_violations:
            retry_target = "optimization"  # B10 is generated in optimization node
            retry_scopes = ["b10"]
        else:
            retry_target = "none"  # System-level violations cannot be retried
    
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
                "judge": judge_verdict,
            },
            "constitutional_retry_count": retry_count,
            "constitutional_route": "writing",
            "release_verdict": {
                "passed": True,
                "status": "approved",
                "code": "RELEASE_APPROVED",
                "judge": judge_verdict,
            },
        }
    
    # Failed — should we retry?
    if retry_count >= max_retries:
        print(f"\n[CONSTITUTIONAL] ❌ FAILED after {max_retries + 1} attempts — release blocked")
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
                "judge": judge_verdict,
            },
            "constitutional_retry_count": retry_count,
            "constitutional_route": "blocked",
            "release_verdict": {
                "passed": False,
                "status": "blocked",
                "code": "CONSTITUTIONAL_VALIDATION_FAILED",
                "errors": all_violations,
                "judge": judge_verdict,
            },
        }

    if retry_target == "none":
        print("\n[CONSTITUTIONAL] ❌ Non-retryable validation failure — release blocked")
        return {
            "constitutional_validation": {
                "passed": False,
                "violations": all_violations,
                "retry_count": retry_count,
                "layer1_passed": l1_passed,
                "layer2_passed": l2_passed,
                "judge": judge_verdict,
            },
            "constitutional_retry_count": retry_count,
            "constitutional_route": "blocked",
            "release_verdict": {
                "passed": False,
                "status": "blocked",
                "code": "CONSTITUTIONAL_VALIDATION_FAILED",
                "errors": all_violations,
                "judge": judge_verdict,
            },
        }
    
    # Retry
    print(f"\n[CONSTITUTIONAL] ❌ FAILED — routing to '{retry_target}' for retry {retry_count + 1}/{max_retries}")
    print(f"  Violations to fix: {len(all_violations)}")
    for v in all_violations:
        print(f"    → {v}")
    
    # Inject violation feedback into state so the retry node knows what to fix
    violation_feedback = "CONSTITUTIONAL VALIDATION FAILED. You MUST fix these violations:\n"
    violation_feedback += "\n".join(f"- {v}" for v in all_violations)
    
    route = retry_target
    
    return {
        "constitutional_validation": {
            "passed": False,
            "violations": all_violations,
            "retry_count": retry_count + 1,
            "retry_target": route,
            "layer1_passed": l1_passed,
            "layer2_passed": l2_passed,
            "judge": judge_verdict,
        },
        "constitutional_retry_count": retry_count + 1,
        "constitutional_route": route,
        "constitutional_retry_scopes": retry_scopes,
        "constitutional_retry_matter_ids": retry_matter_ids,
        "constitutional_violation_feedback": violation_feedback,
    }
