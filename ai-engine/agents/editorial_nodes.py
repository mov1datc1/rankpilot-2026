"""
Editorial Reasoning Engine — Node Implementations
Based on Volume 0 (First Principles) and Volume II (Editorial Reasoning Engine)

These 7 nodes transform RankPilot from a descriptive writer into an editorial 
intelligence system that thinks like a senior rankings consultant.

Pipeline: comprehension → identity_discovery → hypothesis_construction → 
          refutation_engine → comparative_analysis → editorial_confidence → 
          narrative_architecture
"""

import json
import os
from typing import Dict
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
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
)
from agents.prompts import (
    COMPREHENSION_PROMPT,
    IDENTITY_DISCOVERY_PROMPT,
    HYPOTHESIS_CONSTRUCTION_PROMPT,
    REFUTATION_ENGINE_PROMPT,
    COMPARATIVE_ANALYSIS_PROMPT,
    EDITORIAL_CONFIDENCE_PROMPT,
    SUBMISSION_BLUEPRINT_PROMPT,
    NARRATIVE_ARCHITECTURE_PROMPT,
)
from utils.rag_router import RAGRouter

load_dotenv()


def get_model():
    """Shared model configuration for editorial reasoning nodes."""
    return ChatOpenAI(
        model_name="gpt-4o",
        temperature=0.2,
        openai_api_key=os.environ.get("OPENAI_API_KEY")
    )


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


# ─────────────────────────────────────────────
# NODE 1: COMPREHENSION (Chapter 1)
# ─────────────────────────────────────────────
def comprehension_node(state: AgentState) -> Dict:
    """Answers 9 fundamental questions before any analysis begins.
    If thesis doesn't exist or evidence is insufficient, routes to interrogation."""
    print("--- COMPREHENSION: Understanding before analyzing ---")
    
    llm = get_model()
    structured_llm = llm.with_structured_output(ComprehensionOutput)
    
    input_data = {
        "metadata": state.get("metadata", {}),
        "matters": state.get("matters", []),
        "submission_context": state.get("submission_context", {}),
    }
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", COMPREHENSION_PROMPT),
        ("human", "Analyze this submission data and answer the 9 comprehension questions: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str)})
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
    }
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", IDENTITY_DISCOVERY_PROMPT),
        ("human", "Discover the competitive identity from this evidence: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str)})
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
    
    input_data = {
        "competitive_identity": state.get("competitive_identity", {}),
        "matters": state.get("matters", []),
        "strategic_context": state.get("strategic_context", {}),
        "comprehension": state.get("comprehension", {}),
        "RAG_KNOWLEDGE": rag_knowledge,
    }
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", HYPOTHESIS_CONSTRUCTION_PROMPT),
        ("human", "Generate and rank editorial hypotheses based on this evidence: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str)})
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
        "metadata": state.get("metadata", {}),
    }
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", REFUTATION_ENGINE_PROMPT),
        ("human", "Attempt to refute these hypotheses: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str)})
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
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", COMPARATIVE_ANALYSIS_PROMPT),
        ("human", "Perform a 13-dimension comparative analysis: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str)})
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
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", EDITORIAL_CONFIDENCE_PROMPT),
        ("human", "Run the Editorial Defensibility Test on these results: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str)})
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
        confidence=1.0 if confidence.get("overall_confidence") == "high" else 0.5,
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
    
    input_data = {
        "comprehension": state.get("comprehension", {}),
        "competitive_identity": state.get("competitive_identity", {}),
        "surviving_hypotheses": state.get("refutation_results", {}).get("surviving_hypotheses", []),
        "strongest_hypothesis": state.get("refutation_results", {}).get("strongest_surviving", ""),
        "comparative_analysis": state.get("comparative_analysis", {}),
        "editorial_confidence": state.get("editorial_confidence", {}),
        "matters": state.get("matters", []),
        "metadata": state.get("metadata", {}),
        "strategic_context": state.get("strategic_context", {}),
    }
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", SUBMISSION_BLUEPRINT_PROMPT),
        ("human", "Design the complete Submission Blueprint for this submission: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str)})
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
    
    trace = state.get("reasoning_trace", [])
    trace.append(_build_trace_entry(
        stage="submission_blueprint",
        decision=f"Thesis: {blueprint.get('thesis', '')} | Hero: {blueprint.get('hero_matter', '')} | Confidence: {blueprint.get('confidence_level', '')}",
        evidence=blueprint.get("three_key_messages", []),
        confidence=0.85 if blueprint.get("confidence_level") == "high" else 0.5,
        principle="Vol. VI Ch. 15: Design Before Writing"
    ))
    
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
        "submission_blueprint": state.get("submission_blueprint", {}),
        "comprehension": state.get("comprehension", {}),
        "competitive_identity": state.get("competitive_identity", {}),
        "surviving_hypotheses": state.get("refutation_results", {}).get("surviving_hypotheses", []),
        "strongest_hypothesis": state.get("refutation_results", {}).get("strongest_surviving", ""),
        "comparative_analysis": state.get("comparative_analysis", {}),
        "editorial_confidence": state.get("editorial_confidence", {}),
        "matters": state.get("matters", []),
        "metadata": state.get("metadata", {}),
    }
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", NARRATIVE_ARCHITECTURE_PROMPT),
        ("human", "Execute the Submission Blueprint into a narrative architecture: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"data": json.dumps(input_data, default=str)})
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
