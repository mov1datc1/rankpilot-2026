from typing import Annotated, List, Union, Dict
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    file_path: str
    doc_text: str
    # Historial de mensajes (para el chat dialéctico)
    messages: Annotated[list, add_messages]
    # Datos crudos extraídos del documento
    metadata: Dict[str, str] # firm_name, practice_area, etc.
    matters: List[Dict]       # Lista de casos detectados
    # Resultados del análisis de Fase 2
    analysis: Dict            # tier, confidence, dominant_model
    # Control de flujo
    latex_code: str  # Added to store the final LaTeX string
    confidence_score: float
    is_complete: bool
    pdf_url: str
    
    # 8-Layer Context Engine Data
    submission_context: Dict  # inputs from Next.js (directory, practice, region, status)
    strategic_context: Dict   # computed outputs from the context engine

    # =====================================================
    # PRACTICE INTELLIGENCE LAYER — v12.0
    # Structured interpretation of practice-specific evidence
    # Generated between context_engine and comprehension
    # =====================================================
    practice_intelligence: Dict  # PracticeIntelligenceOutput from the PIL node

    # =====================================================
    # EDITORIAL REASONING ENGINE — New State Fields
    # Based on Volume 0 (First Principles) and Volume II 
    # (Editorial Reasoning Engine, Chapters 1-9)
    # =====================================================

    # Chapter 1: Comprehension before writing
    # Answers 9 fundamental questions before any analysis begins
    comprehension: Dict

    # Chapter 9: Competitive Identity Discovery
    # Discovered (never assumed) identity from 4-layer convergence:
    # internal evidence + editorial context + competitive market + relative comparison
    competitive_identity: Dict

    # Chapter 6: Editorial Hypothesis Construction
    # Multiple ranked hypotheses (positioning, market, band, individual, narrative, risk)
    hypotheses: List[Dict]

    # Chapter 7: Systematic Refutation Results
    # Popper-based falsification — only surviving hypotheses pass through
    refutation_results: Dict

    # Chapter 8: Multi-dimensional Comparative Analysis
    # 13-dimension comparison: quality, complexity, consistency, diversity,
    # specialization, reputation, clients, team, narrative, bench strength,
    # individual recognition, trend, identity
    comparative_analysis: Dict

    # Chapter 4: Editorial Defensibility Test Results
    # 8-question test determining if recommendations are editorially defensible
    editorial_confidence: Dict

    # Vol. VI Ch. 15: Submission Blueprint — the structured planning object
    # Generated BETWEEN editorial_confidence and narrative_architecture
    # "The AI should not start writing. It should start DESIGNING."
    submission_blueprint: Dict

    # Pre-writing blueprint: thesis, hero matter, hierarchy, narrative arc
    narrative_architecture: Dict

    # Cross-referenced evidence tracking linking claims to source evidence
    evidence_map: Dict

    # Principle 13: Complete audit trail of editorial reasoning decisions
    # Every conclusion traces back to evidence, hypotheses, and comparisons
    reasoning_trace: List[Dict]

    # v7.0: Editorial Memory — accumulated intelligence from past submissions
    # Injected as context so the AI learns from previous analyses
    editorial_memory: str

    # Flow control for the new pipeline
    current_step: str

    # =====================================================
    # v14.0 TRUST LAYER — Pipeline Manifest
    # Rule 71: Complete audit trail of what the system read,
    # what it extracted, and what it decided at each stage.
    # =====================================================
    pipeline_manifest: Dict

    # =====================================================
    # v17.3: ORIGINAL B10 — Firm's Department Narrative
    # Extracted from raw doc_text during ingestion.
    # Used by the B7 Enhancement Pipeline to EXPAND (never summarize).
    # =====================================================
    original_b10: str
    
    # v17.3: ENHANCED B7 — AI-expanded version of B10
    # Produced by optimization_node's B7 Enhancement Pipeline.
    # Used by submission-builder.ts as the primary B7 source.
    enhanced_b7: str

    # =====================================================
    # v18.6: CONSTITUTIONAL VALIDATION GATE
    # Final quality gate that validates ALL output against
    # the Owner's Editorial Constitution before delivery.
    # =====================================================
    constitutional_validation: Dict    # Layer 1 + Layer 2 results
    constitutional_retry_count: int    # How many retries so far (max 2)
    constitutional_route: str          # "end" | "optimization" | "writing"
    constitutional_violation_feedback: str  # Injected into retry prompts