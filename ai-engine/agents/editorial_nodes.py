"""
Editorial Reasoning Engine — Node Implementations
Based on Volume 0 (First Principles) and Volume II (Editorial Reasoning Engine)

These 9 nodes transform RankPilot from a descriptive writer into an editorial 
intelligence system that thinks like a senior rankings consultant.

Pipeline: practice_intelligence → comprehension → identity_discovery → 
          hypothesis_construction → refutation_engine → comparative_analysis → 
          editorial_confidence → submission_blueprint → narrative_architecture
"""

import json
import os
import time
from typing import Dict
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate

from core.state import AgentState
from core.schema import (
    ComprehensionOutput,
    CompetitiveIdentityOutput,
    HypothesisSetOutput,
    RefutationSetOutput,
    ComparativeAnalysisOutput,
    EditorialConfidenceOutput,
    SubmissionBlueprintOutput,
    NarrativeArchitectureOutput,
    PracticeIntelligenceOutput,
    PracticeIntelligenceLite,
)
from agents.prompts import (
    PRACTICE_INTELLIGENCE_PROMPT,
    COMPREHENSION_PROMPT,
    IDENTITY_DISCOVERY_PROMPT,
    HYPOTHESIS_CONSTRUCTION_PROMPT,
    REFUTATION_ENGINE_PROMPT,
    COMPARATIVE_ANALYSIS_PROMPT,
    EDITORIAL_CONFIDENCE_PROMPT,
    SUBMISSION_BLUEPRINT_PROMPT,
    NARRATIVE_ARCHITECTURE_PROMPT,
    FIRST_RECOGNITION_DIRECTIVE,
    OBJECTIVE_DIRECTIVES,
)
from utils.rag_router import RAGRouter
from utils.model_factory import create_chat_model
from utils.objective_alignment import (
    build_objective_aligned_thesis,
    select_objective_aligned_hero,
    validate_thesis_objective,
)

# v7.0: Import editorial memory for continuous learning
try:
    from utils.editorial_memory import load_memory, format_memory_for_prompt
except ImportError:
    load_memory = None
    format_memory_for_prompt = None

load_dotenv()


def get_model():
    """v18.0: GPT-5.6-terra with reasoning_effort=high for editorial depth.
    
    Editorial nodes require deep reasoning (hypothesis construction, refutation,
    comparative analysis). Uses 'high' reasoning_effort by default.
    
    CRITICAL FIX: Added request_timeout=300 and max_tokens=16384.
    These were MISSING in the original, causing indefinite hangs with
    unstable internet connections (root cause of the 18-min pipeline freeze).
    """
    return create_chat_model("editorial")


def invoke_with_retry(chain, input_data, max_retries=3, base_delay=5):
    """v18.0: Retry wrapper for unstable connections (shared with nodes.py)."""
    for attempt in range(max_retries):
        try:
            return chain.invoke(input_data)
        except Exception as e:
            err_str = str(e).lower()
            is_retriable = any(kw in err_str for kw in [
                "timeout", "connection", "reset by peer", "broken pipe",
                "eof", "timed out", "network", "ssl", "connectionerror",
                "server_error", "502", "503", "529"
            ])
            if not is_retriable or attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt)
            print(f"[RETRY v18.0] Editorial node attempt {attempt+1}/{max_retries} failed: {type(e).__name__}")
            print(f"[RETRY v18.0] Retrying in {delay}s...")
            time.sleep(delay)


def _safe_dump(obj) -> dict:
    """Convert Pydantic model or dict to dict safely."""
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if isinstance(obj, dict):
        return obj
    return {}


def _build_trace_entry(stage: str, decision: str, evidence: list, 
                       confidence: float, principle: str = "") -> dict:
    """Build a reasoning trace entry for Principle 13 transparency."""
    return {
        "stage": stage,
        "decision": decision,
        "evidence_used": evidence,
        "alternatives_considered": [],
        "confidence": confidence,
        "principle_applied": principle,
    }


def _inject_directives(prompt_template: str, strategic_context: dict) -> str:
    """v17.4: Inject objective, mode-specific, and ranking architecture directives."""
    analysis_mode = strategic_context.get("analysis_mode", "")
    primary_objective = strategic_context.get("primary_objective", "")
    
    injections = []
    
    if analysis_mode == "first_recognition":
        injections.append(FIRST_RECOGNITION_DIRECTIVE)
        
    if primary_objective and primary_objective in OBJECTIVE_DIRECTIVES:
        obj_data = OBJECTIVE_DIRECTIVES[primary_objective]
        # v13.1 FIX: Escape curly braces so LangChain ChatPromptTemplate
        # doesn't interpret JSON braces as template variables.
        # Without this, {"priorities": [...]} crashes ALL nodes with:
        # 'Input to ChatPromptTemplate is missing variables {"priorities"}'
        obj_json = json.dumps(obj_data, indent=2).replace("{", "{{").replace("}", "}}")
        injections.append(f"\n### SUBMISSION OBJECTIVE: {primary_objective}\n" + obj_json)
    
    # ═══════════════════════════════════════════════════════════════
    # v17.4: RANKING ARCHITECTURE GUARD — propagated to ALL editorial nodes
    # Prevents the LLM from inventing firm bands when only individual
    # rankings exist (Scenario B) or no ranking exists (Scenario C/D).
    # ═══════════════════════════════════════════════════════════════
    ravl = strategic_context.get("ranking_architecture", {})
    scenario = ravl.get("scenario", "D")
    firm_bands_exist = ravl.get("firm_bands_exist", False)
    ranking_type = ravl.get("ranking_type", "unknown")
    
    if scenario == "B" or (not firm_bands_exist and ranking_type == "individuals_only"):
        injections.append("""
### RANKING ARCHITECTURE GUARD (SCENARIO B — Individuals Only)
This category has ONLY individual lawyer rankings. NO firm/department rankings exist.
ABSOLUTE PROHIBITION: Do NOT use "Band X firms", "peer firms", "entry-level firm bands",
"firms positioned in Band...", "departmental ranking", or any concept implying firm rankings.
Instead: Analyze whether the evidence supports future departmental recognition.
Contrast the firm's lawyers against individually recognised practitioners.""")
    elif not firm_bands_exist and scenario in ("C", "D"):
        injections.append("""
### RANKING ARCHITECTURE GUARD (NO VERIFIED FIRM RANKING DATA)
No verified firm ranking data exists for this combination.
ABSOLUTE PROHIBITION: Do NOT reference any firm bands, tiers, peer firms, or firm positions.
Evaluate the submission purely on evidence quality.""")
    
    # ═══════════════════════════════════════════════════════════════
    # v17.7: CROSS-BORDER PROHIBITION — propagated to ALL editorial nodes
    # For domestic practices (data protection, compliance, tax, labour),
    # cross-border is NOT relevant. The LLM must not penalize its absence.
    # ═══════════════════════════════════════════════════════════════
    cross_border_relevant = strategic_context.get("cross_border_relevant", True)
    if not cross_border_relevant:
        injections.append("""
### CROSS-BORDER PROHIBITION (CONSTITUTIONAL RULE — v17.7)
This practice area does NOT require cross-border work.
ABSOLUTE PROHIBITIONS:
- Do NOT mention "cross-border" as a weakness, gap, limitation, or missing element
- Do NOT say "lacks cross-border work", "limited cross-border", or "no cross-border evidence"
- Do NOT penalize, downgrade confidence, or lower band alignment because of absent cross-border work
- Do NOT recommend "expand cross-border capabilities" or similar business development advice
- Do NOT use "cross-border" as a factor in any evaluation dimension

WHAT TO DO INSTEAD:
- For domestic regulatory practices (data protection, compliance, tax, labour),
  sophisticated LOCAL mandates are MORE probative than cross-border work
- Focus on: regulatory complexity, client sophistication, market depth, matter significance
- Omit cross-border observations entirely when irrelevant to the practice""")
        
    if injections:
        return prompt_template + "\n\n" + "\n\n".join(injections)
    
    return prompt_template


# ─────────────────────────────────────────────

# NODE 0: PRACTICE INTELLIGENCE LAYER (v12.0)
# ─────────────────────────────────────────────
def practice_intelligence_node(state: AgentState) -> Dict:
    """v12.0: Interprets practice-specific evidence BEFORE comprehension begins.
    Generates a structured Practice Interpretation Object containing:
    - Signal Map (10 types A-J)
    - Pattern Map (dominant/secondary/emerging/anecdotal)
    - Centre of Gravity classification
    - Practice Fit Test (8 dimensions)
    - Tension Detection (8 types)
    - Team Classification (dependent/functional/robust)
    - Narrative Coherence Label (overclaim/coherent/underpositioned)
    - Practice Hypotheses (primary, alternative, conservative)
    """
    print("--- PRACTICE INTELLIGENCE LAYER: Interpreting practice-specific evidence ---")
    
    llm = get_model()
    structured_llm = llm.with_structured_output(PracticeIntelligenceOutput)
    
    # Load RAG context for this practice area
    submission_context = state.get("submission_context", {})
    router = RAGRouter()
    rag_knowledge = router.get_rag_context(
        submission_context.get("practice_area", ""),
        submission_context.get("directory", "")
    )
    
    input_data = {
        "metadata": state.get("metadata", {}),
        "matters": state.get("matters", []),
        "submission_context": submission_context,
        "strategic_context": state.get("strategic_context", {}),
    }
    
    # Inject RAG context into the prompt template
    prompt_with_rag = PRACTICE_INTELLIGENCE_PROMPT.replace(
        "{rag_context}",
        rag_knowledge if rag_knowledge else "No practice-specific RAG knowledge available."
    )
    
    # v13.0: Inject objective and mode directives
    system_prompt = _inject_directives(prompt_with_rag, state.get("strategic_context", {}))
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "Analyze this submission and generate the Practice Intelligence Layer output: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str, ensure_ascii=True)})
        pil_output = _safe_dump(result)
        print("[PIL v13.1] Full schema succeeded")
    except Exception as e:
        print(f"[PIL v13.1] Full schema failed: {e}")
        print("[PIL v13.1] Retrying with PracticeIntelligenceLite fallback...")
        
        # v13.1 FIX: Retry with simplified lite schema
        try:
            lite_llm = llm.with_structured_output(PracticeIntelligenceLite)
            lite_chain = prompt | lite_llm
            lite_result = lite_chain.invoke({"data": json.dumps(input_data, default=str, ensure_ascii=True)})
            lite = _safe_dump(lite_result)
            print(f"[PIL v13.1] Lite fallback succeeded — CoG: {lite.get('centre_of_gravity', '')}")
            
            # Map lite output into the full PracticeIntelligenceOutput format
            pil_output = {
                "practice_main": lite.get("practice_main", submission_context.get("practice_area", "Unknown")),
                "sub_practices": [],
                "centre_of_gravity": lite.get("centre_of_gravity", "Unable to determine"),
                "centre_of_gravity_type": lite.get("centre_of_gravity_type", "fragmented"),
                "secondary_gravity": "",
                "overlaps": [],
                "category_fit_concerns": [],
                "rags_used": [],
                "rules_applied": [],
                "conflicts_resolved": [],
                # Convert top_signals strings into structured PracticeSignal-like dicts
                "signals": [
                    {"signal_type": "matter", "description": s, "relevance": "medium", "confidence": 0.5}
                    for s in lite.get("top_signals", [])
                ],
                "patterns": [],
                "excessive_dependencies": [],
                "hypothesis_primary": lite.get("hypothesis_primary", "Unable to generate hypothesis"),
                "hypothesis_alternative": lite.get("hypothesis_alternative", ""),
                "hypothesis_conservative": lite.get("hypothesis_conservative", ""),
                "hypothesis_confidence": lite.get("hypothesis_confidence", 0.5),
                "hypothesis_evidence_for": [],
                "hypothesis_evidence_against": [],
                "risks": lite.get("top_risks", []),
                "research_questions": [],
                "fit_test": {
                    "category_fit": True, "category_fit_notes": "Assessed via lite fallback",
                    "matter_fit": True, "matter_fit_notes": "Assessed via lite fallback",
                    "client_fit": True, "client_fit_notes": "Assessed via lite fallback",
                    "role_fit": True, "role_fit_notes": "Assessed via lite fallback",
                    "team_fit": True, "team_fit_notes": "Assessed via lite fallback",
                    "lawyer_fit": True, "lawyer_fit_notes": "Assessed via lite fallback",
                    "directory_fit": True, "directory_fit_notes": "Assessed via lite fallback",
                    "market_fit": True, "market_fit_notes": "Assessed via lite fallback",
                    "overall_fit": lite.get("fit_score", 4) >= 4,
                    "fit_score": lite.get("fit_score", 4),
                },
                "tensions": [],
                "team_classification": lite.get("team_classification", "functional"),
                "team_classification_rationale": lite.get("team_classification_rationale", "Assessed via lite fallback"),
                "narrative_coherence_label": lite.get("narrative_coherence_label", "coherent"),
                "narrative_coherence_rationale": lite.get("narrative_coherence_rationale", "Assessed via lite fallback"),
                "status": lite.get("status", "PROCEED"),
                "stop_reason": "",
            }
        except Exception as e2:
            print(f"[PIL v13.1] Lite fallback also failed: {e2}")
            # Final fallback: hardcoded defaults (same as v13.0)
            pil_output = {
                "practice_main": submission_context.get("practice_area", "Unknown"),
                "sub_practices": [],
                "centre_of_gravity": "Unable to determine from available evidence (fragmented)",
                "centre_of_gravity_type": "fragmented",
                "secondary_gravity": "",
                "overlaps": [],
                "category_fit_concerns": [f"PIL analysis failed: {str(e2)}"],
                "rags_used": [],
                "rules_applied": [],
                "conflicts_resolved": [],
                "signals": [],
                "patterns": [],
                "excessive_dependencies": [],
                "hypothesis_primary": "Unable to generate hypothesis",
                "hypothesis_alternative": "Unable to generate hypothesis",
                "hypothesis_conservative": "Unable to generate hypothesis",
                "hypothesis_confidence": 0.0,
                "hypothesis_evidence_for": [],
                "hypothesis_evidence_against": [],
                "risks": [f"Practice Intelligence Layer failed: {str(e2)}"],
                "research_questions": ["Manual review required — PIL node encountered an error"],
                "fit_test": {
                    "category_fit": False, "category_fit_notes": "Unable to assess",
                    "matter_fit": False, "matter_fit_notes": "Unable to assess",
                    "client_fit": False, "client_fit_notes": "Unable to assess",
                    "role_fit": False, "role_fit_notes": "Unable to assess",
                    "team_fit": False, "team_fit_notes": "Unable to assess",
                    "lawyer_fit": False, "lawyer_fit_notes": "Unable to assess",
                    "directory_fit": False, "directory_fit_notes": "Unable to assess",
                    "market_fit": False, "market_fit_notes": "Unable to assess",
                    "overall_fit": False, "fit_score": 0,
                },
                "tensions": [],
                "team_classification": "dependent",
                "team_classification_rationale": "Unable to assess — PIL failed",
                "narrative_coherence_label": "overclaim",
                "narrative_coherence_rationale": "Unable to assess — PIL failed",
                "status": "PROCEED",
                "stop_reason": "",
            }
    
    # Build reasoning trace
    trace = state.get("reasoning_trace", [])
    signals_count = len(pil_output.get("signals", []))
    patterns_count = len(pil_output.get("patterns", []))
    tensions_count = len(pil_output.get("tensions", []))
    fit_score = pil_output.get("fit_test", {}).get("fit_score", 0)
    
    trace.append(_build_trace_entry(
        stage="practice_intelligence",
        decision=(
            f"Centre of Gravity: {pil_output.get('centre_of_gravity', '')} ({pil_output.get('centre_of_gravity_type', '')}) | "
            f"Signals: {signals_count} | Patterns: {patterns_count} | Tensions: {tensions_count} | "
            f"Fit: {fit_score}/8 | Team: {pil_output.get('team_classification', '')} | "
            f"Narrative: {pil_output.get('narrative_coherence_label', '')} | "
            f"Status: {pil_output.get('status', '')}"
        ),
        evidence=[pil_output.get("hypothesis_primary", "")],
        confidence=pil_output.get("hypothesis_confidence", 0),
        principle="§8: Practice Intelligence Layer — Interpretation before Comprehension"
    ))
    
    print(f"[PIL v12.0] Centre of Gravity: {pil_output.get('centre_of_gravity', '')} ({pil_output.get('centre_of_gravity_type', '')})")
    print(f"[PIL v12.0] Signals: {signals_count} | Patterns: {patterns_count} | Tensions: {tensions_count} | Fit: {fit_score}/8")
    print(f"[PIL v12.0] Team: {pil_output.get('team_classification', '')} | Narrative: {pil_output.get('narrative_coherence_label', '')}")
    print(f"[PIL v12.0] Status: {pil_output.get('status', '')}")
    
    return {
        "practice_intelligence": pil_output,
        "reasoning_trace": trace,
        "current_step": "comprehension" if pil_output.get("status") == "PROCEED" else "interrogation"
    }


# ─────────────────────────────────────────────
# NODE 1: COMPREHENSION (Chapter 1)
# ─────────────────────────────────────────────
def comprehension_node(state: AgentState) -> Dict:
    """Answers 9 fundamental questions before any analysis begins.
    If thesis doesn't exist or evidence is insufficient, routes to interrogation."""
    print("--- COMPREHENSION: Understanding before analyzing ---")
    
    llm = get_model()
    structured_llm = llm.with_structured_output(ComprehensionOutput)
    
    # v13.1 FIX: Enrich comprehension with strategic_context (archetype, identity_adn)
    # so it can extract thesis even when PIL returns empty/default data
    strategic_ctx = state.get("strategic_context", {})
    input_data = {
        "metadata": state.get("metadata", {}),
        "matters": state.get("matters", []),
        "submission_context": state.get("submission_context", {}),
        # v12.0: Include PIL output for practice-aware comprehension
        "practice_intelligence": state.get("practice_intelligence", {}),
        # v13.1: Include context_engine output for thesis resilience
        "context_engine": {
            "archetype": strategic_ctx.get("archetype", ""),
            "identity_adn": strategic_ctx.get("identity_adn", ""),
            "practice_type": strategic_ctx.get("practice_type", ""),
            "complexity_profile": strategic_ctx.get("complexity_profile", ""),
            "client_type": strategic_ctx.get("client_type", ""),
        },
    }
    
    system_prompt = _inject_directives(COMPREHENSION_PROMPT, state.get("strategic_context", {}))
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "Analyze this submission data and answer the 9 comprehension questions: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str, ensure_ascii=True)})
        comprehension = _safe_dump(result)
    except Exception as e:
        print(f"Error in Comprehension Node: {e}")
        comprehension = {
            "firm_thesis": "Unable to determine",
            "practice_evaluated": state.get("submission_context", {}).get("practice_area", "Unknown"),
            "editorial_applicable": state.get("submission_context", {}).get("directory", "Unknown"),
            "jurisdiction": state.get("submission_context", {}).get("jurisdiction", "Unknown"),
            "target_band": "Unknown",
            "apparent_thesis": "Unable to extract thesis from available evidence",
            "thesis_exists": False,
            "evidence_sufficient": False,
            "missing_information": ["Comprehension analysis failed — manual review required"],
            "comprehension_confidence": 0.0,
        }
    
    trace = state.get("reasoning_trace", [])
    trace.append(_build_trace_entry(
        stage="comprehension",
        decision=f"Thesis exists: {comprehension.get('thesis_exists')} | Evidence sufficient: {comprehension.get('evidence_sufficient')}",
        evidence=[comprehension.get("apparent_thesis", "")],
        confidence=comprehension.get("comprehension_confidence", 0),
        principle="P3: Every Submission Is A Hypothesis"
    ))
    
    return {
        "comprehension": comprehension,
        "reasoning_trace": trace,
        "current_step": "identity" if comprehension.get("thesis_exists") and comprehension.get("evidence_sufficient") else "interrogation"
    }


# ─────────────────────────────────────────────
# NODE 2: IDENTITY DISCOVERY (Chapter 9)
# ─────────────────────────────────────────────
def identity_discovery_node(state: AgentState) -> Dict:
    """Discovers competitive identity through pattern detection across ALL evidence."""
    print("--- IDENTITY DISCOVERY: Finding who this firm really is ---")
    
    llm = get_model()
    structured_llm = llm.with_structured_output(CompetitiveIdentityOutput)
    
    input_data = {
        "metadata": state.get("metadata", {}),
        "matters": state.get("matters", []),
        "comprehension": state.get("comprehension", {}),
        "submission_context": state.get("submission_context", {}),
        # v12.0: Include PIL's centre of gravity and signal map
        "practice_intelligence": state.get("practice_intelligence", {}),
    }
    
    # v17.7: Inject cross-border + RAVL directives into system prompt
    system_prompt = _inject_directives(IDENTITY_DISCOVERY_PROMPT, state.get("strategic_context", {}))
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "Discover the competitive identity from this evidence: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str, ensure_ascii=True)})
        identity = _safe_dump(result)
    except Exception as e:
        print(f"Error in Identity Discovery Node: {e}")
        identity = {
            "identity_statement": "Identity could not be determined from available evidence",
            "recurring_patterns": [],
            "dominant_client_type": "Unknown",
            "dominant_matter_type": "Unknown",
            "dominant_industries": [],
            "sophistication_level": "standard",
            "complexity_patterns": [],
            "typical_roles": [],
            "structural_strengths": [],
            "anecdotal_strengths": [],
            "sub_specialization": "",
            "identity_coherence": "fragmented",
        }
    
    trace = state.get("reasoning_trace", [])
    trace.append(_build_trace_entry(
        stage="identity_discovery",
        decision=f"Identity: {identity.get('identity_statement', '')} | Coherence: {identity.get('identity_coherence', '')}",
        evidence=identity.get("recurring_patterns", []),
        confidence=0.7 if identity.get("identity_coherence") == "coherent" else 0.4,
        principle="P6: Editorial Identity Must Be Discovered"
    ))
    
    return {
        "competitive_identity": identity,
        "reasoning_trace": trace,
        "current_step": "hypothesis"
    }


# ─────────────────────────────────────────────
# NODE 3: HYPOTHESIS CONSTRUCTION (Chapter 6)
# ─────────────────────────────────────────────
def hypothesis_construction_node(state: AgentState) -> Dict:
    """Generates multiple competing hypotheses and ranks them using 6 criteria."""
    print("--- HYPOTHESIS CONSTRUCTION: Generating competing editorial hypotheses ---")
    
    llm = get_model()
    structured_llm = llm.with_structured_output(HypothesisSetOutput)
    
    # Get RAG context for market knowledge
    submission_context = state.get("submission_context", {})
    router = RAGRouter()
    rag_knowledge = router.get_rag_context(
        submission_context.get("practice_area", ""),
        submission_context.get("directory", "")
    )
    
    # v12.0: Seed hypothesis construction with PIL's practice hypotheses
    pil = state.get("practice_intelligence", {})
    
    input_data = {
        "competitive_identity": state.get("competitive_identity", {}),
        "matters": state.get("matters", []),
        "strategic_context": state.get("strategic_context", {}),
        "comprehension": state.get("comprehension", {}),
        "RAG_KNOWLEDGE": rag_knowledge,
        # v12.0: PIL practice hypotheses as seeds for editorial hypothesis generation
        "practice_hypotheses": {
            "primary": pil.get("hypothesis_primary", ""),
            "alternative": pil.get("hypothesis_alternative", ""),
            "conservative": pil.get("hypothesis_conservative", ""),
            "confidence": pil.get("hypothesis_confidence", 0),
        },
        "centre_of_gravity": pil.get("centre_of_gravity", ""),
        "team_classification": pil.get("team_classification", ""),
    }

    # v7.0: Inject editorial memory for continuous learning
    editorial_memory = state.get("editorial_memory", "")
    if editorial_memory:
        input_data["EDITORIAL_MEMORY"] = editorial_memory
    
    # v17.7: Inject cross-border + RAVL directives into system prompt
    system_prompt = _inject_directives(HYPOTHESIS_CONSTRUCTION_PROMPT, state.get("strategic_context", {}))
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "Generate and rank editorial hypotheses based on this evidence: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str, ensure_ascii=True)})
        hypothesis_set = _safe_dump(result)
    except Exception as e:
        print(f"Error in Hypothesis Construction Node: {e}")
        hypothesis_set = {
            "hypotheses": [],
            "preferred_hypothesis_index": 0,
            "ranking_rationale": f"Hypothesis construction failed: {str(e)}"
        }
    
    trace = state.get("reasoning_trace", [])
    hypotheses = hypothesis_set.get("hypotheses", [])
    preferred_idx = hypothesis_set.get("preferred_hypothesis_index", 0)
    preferred = hypotheses[preferred_idx] if hypotheses else {}
    
    trace.append(_build_trace_entry(
        stage="hypothesis_construction",
        decision=f"Generated {len(hypotheses)} hypotheses. Preferred: {preferred.get('statement', 'None')}",
        evidence=[h.get("statement", "") for h in hypotheses],
        confidence=preferred.get("plausibility_score", 0),
        principle="P8: Every Hypothesis Must Resist Refutation"
    ))
    
    return {
        "hypotheses": hypothesis_set.get("hypotheses", []),
        "reasoning_trace": trace,
        "current_step": "refutation"
    }


# ─────────────────────────────────────────────
# NODE 4: REFUTATION ENGINE (Chapter 7)
# ─────────────────────────────────────────────
def refutation_engine_node(state: AgentState) -> Dict:
    """Systematically attempts to destroy each hypothesis using the Popper Principle."""
    print("--- REFUTATION ENGINE: Attempting to destroy hypotheses ---")
    
    llm = get_model()
    structured_llm = llm.with_structured_output(RefutationSetOutput)
    
    hypotheses = state.get("hypotheses", [])
    # Test the top 3 hypotheses (or all if fewer)
    top_hypotheses = hypotheses[:3] if len(hypotheses) > 3 else hypotheses
    
    input_data = {
        "hypotheses_to_test": top_hypotheses,
        "matters": state.get("matters", []),
        "competitive_identity": state.get("competitive_identity", {}),
        "hypotheses": state.get("hypotheses", {}),
    }
    
    system_prompt = _inject_directives(REFUTATION_ENGINE_PROMPT, state.get("strategic_context", {}))
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "Execute the Refutation Protocol against the hypotheses: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str, ensure_ascii=True)})
        refutation = _safe_dump(result)
    except Exception as e:
        print(f"Error in Refutation Engine Node: {e}")
        refutation = {
            "results": [],
            "surviving_hypotheses": [h.get("statement", "") for h in top_hypotheses],
            "destroyed_hypotheses": [],
            "strongest_surviving": top_hypotheses[0].get("statement", "") if top_hypotheses else ""
        }
    
    trace = state.get("reasoning_trace", [])
    trace.append(_build_trace_entry(
        stage="refutation_engine",
        decision=f"Surviving: {len(refutation.get('surviving_hypotheses', []))} | Destroyed: {len(refutation.get('destroyed_hypotheses', []))}",
        evidence=refutation.get("surviving_hypotheses", []),
        confidence=0.8 if refutation.get("surviving_hypotheses") else 0.2,
        principle="P8: Every Hypothesis Must Resist Refutation"
    ))
    
    return {
        "refutation_results": refutation,
        "reasoning_trace": trace,
        "current_step": "comparison"
    }


# ─────────────────────────────────────────────
# NODE 5: COMPARATIVE ANALYSIS (Chapter 8)
# ─────────────────────────────────────────────
def comparative_analysis_node(state: AgentState) -> Dict:
    """Multi-dimensional comparison across 13 dimensions within market context."""
    print("--- COMPARATIVE ANALYSIS: Evaluating within competitive market ---")
    
    llm = get_model()
    structured_llm = llm.with_structured_output(ComparativeAnalysisOutput)
    
    submission_context = state.get("submission_context", {})
    router = RAGRouter()
    rag_knowledge = router.get_rag_context(
        submission_context.get("practice_area", ""),
        submission_context.get("directory", "")
    )
    
    input_data = {
        "refutation_results": state.get("refutation_results", {}),
        "competitive_identity": state.get("competitive_identity", {}),
        "strategic_context": state.get("strategic_context", {}),
        "matters": state.get("matters", []),
        "metadata": state.get("metadata", {}),
        "RAG_KNOWLEDGE": rag_knowledge,
    }

    # v7.0: Inject editorial memory for continuous learning
    editorial_memory = state.get("editorial_memory", "")
    if editorial_memory:
        input_data["EDITORIAL_MEMORY"] = editorial_memory
    
    # v17.7: Inject cross-border + RAVL directives into system prompt
    system_prompt = _inject_directives(COMPARATIVE_ANALYSIS_PROMPT, state.get("strategic_context", {}))
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "Perform a 13-dimension comparative analysis: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str, ensure_ascii=True)})
        comparison = _safe_dump(result)
    except Exception as e:
        print(f"Error in Comparative Analysis Node: {e}")
        comparison = {
            "band_alignment": "Unable to determine",
            "market_position_summary": f"Comparative analysis could not be completed: {str(e)}",
            "temporal_analysis": "Insufficient data for temporal comparison",
        }
    
    trace = state.get("reasoning_trace", [])
    trace.append(_build_trace_entry(
        stage="comparative_analysis",
        decision=f"Band alignment: {comparison.get('band_alignment', 'Unknown')}",
        evidence=[comparison.get("market_position_summary", "")],
        confidence=0.6,
        principle="P1: Rankings Are Comparative Systems"
    ))
    
    return {
        "comparative_analysis": comparison,
        "reasoning_trace": trace,
        "current_step": "confidence"
    }


# ─────────────────────────────────────────────
# NODE 6: EDITORIAL CONFIDENCE (Chapter 4)
# ─────────────────────────────────────────────
def editorial_confidence_node(state: AgentState) -> Dict:
    """Runs the 8-question Editorial Defensibility Test. Gates the pipeline."""
    print("--- EDITORIAL CONFIDENCE: Testing defensibility ---")
    
    llm = get_model()
    structured_llm = llm.with_structured_output(EditorialConfidenceOutput)
    
    input_data = {
        "comparative_analysis": state.get("comparative_analysis", {}),
        "refutation_results": state.get("refutation_results", {}),
        "hypotheses": state.get("hypotheses", []),
        "competitive_identity": state.get("competitive_identity", {}),
        "comprehension": state.get("comprehension", {}),
    }
    
    # v17.7: Inject cross-border + RAVL directives into system prompt
    system_prompt = _inject_directives(EDITORIAL_CONFIDENCE_PROMPT, state.get("strategic_context", {}))
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "Run the Editorial Defensibility Test on these results: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str, ensure_ascii=True)})
        confidence = _safe_dump(result)
    except Exception as e:
        print(f"Error in Editorial Confidence Node: {e}")
        confidence = {
            "passes_defensibility_test": False,
            "overall_confidence": "insufficient",
            "recommendation": "needs_investigation",
            "defensibility_summary": f"Confidence assessment failed: {str(e)}"
        }
    
    trace = state.get("reasoning_trace", [])
    trace.append(_build_trace_entry(
        stage="editorial_confidence",
        decision=f"Defensibility: {confidence.get('passes_defensibility_test')} | Confidence: {confidence.get('overall_confidence')} | Recommendation: {confidence.get('recommendation')}",
        evidence=[confidence.get("defensibility_summary", "")],
        confidence=1.0 if confidence.get('overall_confidence') == "high" else 0.5,
        principle="P10: Editorial Defensibility Is The Final Test"
    ))
    
    # Determine routing: proceed to narrative architecture or interrogation
    passes = confidence.get("passes_defensibility_test", False)
    recommendation = confidence.get("recommendation", "needs_investigation")
    
    next_step = "narrative" if passes or recommendation in ("proceed", "proceed_with_caveats") else "interrogation"
    
    return {
        "editorial_confidence": confidence,
        "confidence_score": 85.0 if next_step == "narrative" else 40.0,
        "reasoning_trace": trace,
        "current_step": next_step
    }


# ─────────────────────────────────────────────
# NODE 7: SUBMISSION BLUEPRINT (Vol. VI, Ch. 15)
# "The AI does not start writing. It starts DESIGNING."
# ─────────────────────────────────────────────
def submission_blueprint_node(state: AgentState) -> Dict:
    """Generates the Submission Blueprint Object — the complete design of the
    submission before any writing begins. This is the bridge between reasoning
    and execution, introduced by Vol. VI Chapter 15."""
    print("--- SUBMISSION BLUEPRINT: Designing before writing ---")
    
    llm = get_model()
    structured_llm = llm.with_structured_output(SubmissionBlueprintOutput)
    
    # v12.0: Include PIL data for practice-aware blueprint design
    pil = state.get("practice_intelligence", {})
    
    input_data = {
        "comprehension": state.get("comprehension", {}),
        "competitive_identity": state.get("competitive_identity", {}),
        "surviving_hypotheses": state.get("refutation_results", {}).get("surviving_hypotheses", []),
        "strongest_hypothesis": state.get("refutation_results", {}).get("strongest_surviving", ""),
        "comparative_analysis": state.get("comparative_analysis", {}),
        "matters": state.get("matters", []),
        "metadata": state.get("metadata", {}),
        "strategic_context": state.get("strategic_context", {}),
        # v12.0: Practice Intelligence Layer enrichment
        "team_classification": pil.get("team_classification", ""),
        "team_classification_rationale": pil.get("team_classification_rationale", ""),
        "narrative_coherence_label": pil.get("narrative_coherence_label", ""),
        "narrative_coherence_rationale": pil.get("narrative_coherence_rationale", ""),
        "centre_of_gravity": pil.get("centre_of_gravity", ""),
        "practice_fit_score": pil.get("fit_test", {}).get("fit_score", 0),
        "practice_tensions": [t.get("description", "") for t in pil.get("tensions", []) if isinstance(t, dict)],
        "editorial_confidence": state.get("editorial_confidence", {}),
    }
    
    system_prompt = _inject_directives(SUBMISSION_BLUEPRINT_PROMPT, state.get("strategic_context", {}))
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "Design the Submission Blueprint: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str, ensure_ascii=True)})
        blueprint = _safe_dump(result)
    except Exception as e:
        print(f"Error in Submission Blueprint Node: {e}")
        blueprint = {
            "thesis": state.get("comprehension", {}).get("apparent_thesis", "Unable to construct thesis"),
            "hero_matter": "",
            "hero_rationale": "",
            "supporting_matters": [],
            "matters_to_exclude": [],
            "editorial_risks": [f"Blueprint generation failed: {str(e)}"],
            "primary_pattern": "",
            "practice_identity": "",
            "target_impression": "",
            "three_key_messages": [],
            "evidence_hierarchy": [],
            "narrative_sequence": [],
            "lawyer_distribution": [],
            "bench_strength_signals": [],
            "client_diversity": [],
            "sector_distribution": [],
            "complexity_distribution": [],
            "closing_message": "",
            "open_questions": [],
            "confidence_level": "low",
            "coherence_check": {"passes_coherence": False, "redesign_notes": str(e)},
            "positioning_change_recommended": False,
            "promotion_not_recommended": False,
            "practice_change_recommended": "",
        }

    alignment_errors = validate_thesis_objective(
        blueprint.get("thesis", ""), state.get("strategic_context", {})
    )
    aligned_hero, hero_notes = select_objective_aligned_hero(
        state.get("matters", []),
        state.get("strategic_context", {}).get("practice_area", ""),
        state.get("strategic_context", {}).get("analysis_mode", ""),
        blueprint.get("hero_matter", ""),
    )
    if aligned_hero and aligned_hero != blueprint.get("hero_matter"):
        blueprint["hero_matter"] = aligned_hero
        blueprint["hero_selection_reasoning"] = " ".join(hero_notes)
    if alignment_errors:
        blueprint["thesis"] = build_objective_aligned_thesis(
            state.get("matters", []),
            state.get("strategic_context", {}).get("practice_area", ""),
            state.get("strategic_objective", {}).get("ranking_unit")
            or state.get("strategic_context", {}).get("ranking_unit", ""),
        )
        blueprint.setdefault("editorial_risks", []).extend(alignment_errors)
        blueprint["coherence_check"] = {
            "passes_coherence": False,
            "redesign_notes": " ".join(alignment_errors),
        }
    
    trace = state.get("reasoning_trace", [])
    trace.append(_build_trace_entry(
        stage="submission_blueprint",
        decision=f"Thesis: {blueprint.get('thesis', '')} | Hero: {blueprint.get('hero_matter', '')} | Confidence: {blueprint.get('confidence_level', '')}",
        evidence=blueprint.get("three_key_messages", []),
        confidence=0.85 if blueprint.get('confidence_level') == "high" else 0.5,
        principle="Vol. VI Ch. 15: Design Before Writing"
    ))

    # v7.0 + v13.1: Matter accountability validation with auto-fill
    input_matters = state.get("matters", [])
    input_count = len(input_matters)
    disposition_count = len(blueprint.get("all_matter_dispositions", []))
    
    # v13.1 FIX: If LLM left all_matter_dispositions empty, auto-generate them
    if input_count > 0 and disposition_count < input_count:
        print(f"[v13.1] Auto-filling matter dispositions: {input_count} matters, {disposition_count} tracked by LLM")
        hero_title = blueprint.get("hero_matter", "").strip().lower()
        supporting_titles = [s.strip().lower() for s in blueprint.get("supporting_matters", [])]
        exclude_titles = []
        for exc in blueprint.get("matters_to_exclude", []):
            if isinstance(exc, dict):
                exclude_titles.append(exc.get("matter_title", "").strip().lower())
            elif isinstance(exc, str):
                exclude_titles.append(exc.strip().lower())
        
        auto_dispositions = []
        for m in input_matters:
            m_title = ""
            if isinstance(m, dict):
                m_title = m.get("title", m.get("name", "")).strip()
            elif isinstance(m, str):
                m_title = m.strip()
            
            m_lower = m_title.lower()
            
            if m_lower == hero_title or (hero_title and hero_title in m_lower):
                role = "lead"
                rationale = "Selected as lead matter by editorial analysis"
            elif m_lower in supporting_titles or any(s in m_lower for s in supporting_titles if s):
                role = "supporting"
                rationale = "Supporting evidence for the thesis"
            elif m_lower in exclude_titles or any(e in m_lower for e in exclude_titles if e):
                role = "de_emphasize"
                rationale = "De-emphasized — does not strengthen core thesis"
            else:
                role = "supporting"
                rationale = "Included as supporting evidence (auto-assigned)"
            
            auto_dispositions.append({
                "matter_title": m_title,
                "disposition": role,
                "rationale": rationale,
            })
        
        blueprint["all_matter_dispositions"] = auto_dispositions
        disposition_count = len(auto_dispositions)
        print(f"[v13.1] Auto-filled {disposition_count} matter dispositions")
    
    supporting_count = len(blueprint.get("supporting_matters", []))
    hero = 1 if blueprint.get("hero_matter") else 0
    accounted = disposition_count or (supporting_count + hero)
    
    if input_count > 0 and accounted < input_count:
        print(f"\u26a0\ufe0f MATTER ACCOUNTABILITY WARNING: {input_count} matters received, only {accounted} accounted for")
        trace.append(_build_trace_entry(
            stage="submission_blueprint_validation",
            decision=f"MATTER ACCOUNTABILITY VIOLATION: {input_count} in, {accounted} tracked. {input_count - accounted} matters unaccounted.",
            evidence=[f"Input: {input_count}", f"Dispositions: {disposition_count}", f"Supporting: {supporting_count}"],
            confidence=0.3,
            principle="v7.0: Zero-Loss Rule"
        ))
    else:
        print(f"\u2705 MATTER ACCOUNTABILITY PASSES: {input_count} in, {accounted} accounted for")
    
    return {
        "submission_blueprint": blueprint,
        "reasoning_trace": trace,
        "current_step": "narrative"
    }


# ─────────────────────────────────────────────
# NODE 8: NARRATIVE ARCHITECTURE (Pre-writing)
# Now EXECUTES the Submission Blueprint
# ─────────────────────────────────────────────
def narrative_architecture_node(state: AgentState) -> Dict:
    """Executes the Submission Blueprint into a concrete editorial plan.
    This is the bridge between the design (blueprint) and the writing."""
    print("--- NARRATIVE ARCHITECTURE: Executing the blueprint ---")
    
    llm = get_model()
    structured_llm = llm.with_structured_output(NarrativeArchitectureOutput)
    
    input_data = {
        "comprehension": state.get("comprehension", {}),
        "competitive_identity": state.get("competitive_identity", {}),
        "surviving_hypotheses": state.get("refutation_results", {}).get("surviving_hypotheses", []),
        "strongest_hypothesis": state.get("refutation_results", {}).get("strongest_surviving", ""),
        "comparative_analysis": state.get("comparative_analysis", {}),
        "editorial_confidence": state.get("editorial_confidence", {}),
        "matters": state.get("matters", []),
        "metadata": state.get("metadata", {}),
        "submission_blueprint": state.get("submission_blueprint", {}),
    }
    
    system_prompt = _inject_directives(NARRATIVE_ARCHITECTURE_PROMPT, state.get("strategic_context", {}))
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "Design the Narrative Architecture: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str, ensure_ascii=True)})
        architecture = _safe_dump(result)
    except Exception as e:
        print(f"Error in Narrative Architecture Node: {e}")
        architecture = {
            "thesis_statement": "Unable to construct thesis",
            "hero_matter": "",
            "hero_matter_rationale": "",
            "matter_hierarchy": [],
            "narrative_arc": "",
            "positioning_statement": "",
            "key_differentiators": [],
            "evidence_to_amplify": [],
            "evidence_to_minimize": [],
            "target_researcher_perception": "",
            "editorial_tone": "institutional",
            "bench_strength_narrative": "",
        }

    architecture_errors = validate_thesis_objective(
        architecture.get("thesis_statement", ""), state.get("strategic_context", {})
    )
    if architecture_errors:
        blueprint_thesis = state.get("submission_blueprint", {}).get("thesis", "")
        if validate_thesis_objective(
            blueprint_thesis, state.get("strategic_context", {})
        ):
            blueprint_thesis = ""
        architecture["thesis_statement"] = blueprint_thesis or build_objective_aligned_thesis(
            state.get("matters", []),
            state.get("strategic_context", {}).get("practice_area", ""),
            state.get("strategic_objective", {}).get("ranking_unit")
            or state.get("strategic_context", {}).get("ranking_unit", ""),
        )
    aligned_hero, _ = select_objective_aligned_hero(
        state.get("matters", []),
        state.get("strategic_context", {}).get("practice_area", ""),
        state.get("strategic_context", {}).get("analysis_mode", ""),
        architecture.get("hero_matter", ""),
    )
    if aligned_hero:
        architecture["hero_matter"] = aligned_hero
    
    trace = state.get("reasoning_trace", [])
    trace.append(_build_trace_entry(
        stage="narrative_architecture",
        decision=f"Thesis: {architecture.get('thesis_statement', '')} | Hero: {architecture.get('hero_matter', '')}",
        evidence=architecture.get("key_differentiators", []),
        confidence=0.8,
        principle="All 15 Principles Converge"
    ))
    
    return {
        "narrative_architecture": architecture,
        "reasoning_trace": trace,
        "current_step": "analysis"
    }
