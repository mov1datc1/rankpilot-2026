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

    # Flow control for the new pipeline
    current_step: str