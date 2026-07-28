from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver 
from agents.nodes import (
    ingestion_node, 
    extraction_node, 
    context_engine_node,
    analysis_node, 
    optimization_node,
    interrogator_node, 
    writer_node
)
from agents.editorial_nodes import (
    practice_intelligence_node,
    comprehension_node,
    identity_discovery_node,
    hypothesis_construction_node,
    refutation_engine_node,
    comparative_analysis_node,
    editorial_confidence_node,
    submission_blueprint_node,
    narrative_architecture_node,
)
from core.state import AgentState

def create_rankpilot_graph():
    """
    Constructs the RankPilot Editorial Reasoning Engine graph.
    
    This is a 16-node pipeline that reproduces the reasoning of a senior 
    rankings consultant before writing a single word.
    
    Pipeline Architecture (Vol. 0-VII + Practice Intelligence Layer v12.0):
    
    ingestion → extraction → context_engine → 🆕 practice_intelligence
                                                    ↓
                                              [stop condition?]
                                              YES → interrogation → END
                                              NO  → comprehension
                                                    ↓
                                              [thesis exists?]
                                              YES → identity_discovery
                                              NO  → interrogation → END
                                                    ↓
                                              hypothesis_construction
                                                    ↓
                                              refutation_engine (+ Decision Rules 5-7, 11)
                                                    ↓
                                              comparative_analysis
                                                    ↓
                                              editorial_confidence (+ Decision Rules 8-10)
                                                    ↓
                                              submission_blueprint (NEW: Vol. VI Ch. 15)
                                                    ↓
                                              narrative_architecture (executes blueprint)
                                                    ↓
                                              analysis (now thesis-driven)
                                                    ↓
                                              optimization
                                                    ↓
                                              writing → END
    """
    
    # 1. Initialize the StateGraph
    workflow = StateGraph(AgentState)

    # 2. Register ALL nodes (original + editorial reasoning + practice intelligence)
    # --- Original pipeline nodes ---
    workflow.add_node("ingestion", ingestion_node)
    workflow.add_node("extraction", extraction_node)
    workflow.add_node("context_engine", context_engine_node)
    workflow.add_node("analysis", analysis_node)
    workflow.add_node("optimization", optimization_node)
    workflow.add_node("interrogation", interrogator_node)
    workflow.add_node("writing", writer_node)
    
    # --- Practice Intelligence Layer (v12.0) ---
    workflow.add_node("practice_intelligence", practice_intelligence_node)
    
    # --- Editorial Reasoning Engine nodes ---
    workflow.add_node("comprehension", comprehension_node)
    workflow.add_node("identity_discovery", identity_discovery_node)
    workflow.add_node("hypothesis_construction", hypothesis_construction_node)
    workflow.add_node("refutation_engine", refutation_engine_node)
    workflow.add_node("comparative_analysis", comparative_analysis_node)
    workflow.add_node("editorial_confidence", editorial_confidence_node)
    workflow.add_node("submission_blueprint", submission_blueprint_node)
    workflow.add_node("narrative_architecture", narrative_architecture_node)

    # 3. Entry sequence (unchanged start)
    workflow.set_entry_point("ingestion")
    workflow.add_edge("ingestion", "extraction")
    workflow.add_edge("extraction", "context_engine")
    
    # 4. After context engine → practice_intelligence (v12.0)
    workflow.add_edge("context_engine", "practice_intelligence")

    # 5. Practice Intelligence Gate: always continue (v13.0 fix)
    # PIL stop conditions are informational warnings, not pipeline halts.
    # A blank report is worse than a degraded analysis.
    def route_after_practice_intelligence(state: AgentState):
        """§20: PIL may flag issues but the pipeline always continues.
        The reasoning trace captures any PIL concerns for the final report."""
        pil = state.get("practice_intelligence", {})
        status = pil.get("status", "PROCEED")
        
        if status != "PROCEED":
            print(f"[PIL GATE] PIL returned status={status}, but pipeline continues to avoid blank report.")
        
        # ALWAYS continue to comprehension — never leave the report blank
        return "comprehension"

    workflow.add_conditional_edges(
        "practice_intelligence",
        route_after_practice_intelligence,
        {
            "comprehension": "comprehension",
        }
    )

    # 6. Comprehension Gate: always continue (v13.0 fix)
    # Even with low confidence, continue — a partial analysis is better than "Pending".
    def route_after_comprehension(state: AgentState):
        """Chapter 1 gate: logs confidence but always continues the pipeline."""
        comprehension = state.get("comprehension", {})
        thesis_exists = comprehension.get("thesis_exists", False)
        evidence_sufficient = comprehension.get("evidence_sufficient", False)
        confidence = comprehension.get("comprehension_confidence", 0)
        
        if not (thesis_exists and evidence_sufficient and confidence >= 0.4):
            print(f"[COMPREHENSION GATE] Low confidence (thesis={thesis_exists}, evidence={evidence_sufficient}, conf={confidence}), but pipeline continues.")
        
        # ALWAYS continue — never leave the report blank
        return "identity_discovery"

    workflow.add_conditional_edges(
        "comprehension",
        route_after_comprehension,
        {
            "identity_discovery": "identity_discovery",
        }
    )

    # 7. Editorial Reasoning chain (sequential)
    workflow.add_edge("identity_discovery", "hypothesis_construction")
    workflow.add_edge("hypothesis_construction", "refutation_engine")
    workflow.add_edge("refutation_engine", "comparative_analysis")
    workflow.add_edge("comparative_analysis", "editorial_confidence")

    # 8. Editorial Confidence → Submission Blueprint → Narrative Architecture
    # ALWAYS proceeds: insufficient confidence is communicated, not hidden.
    workflow.add_edge("editorial_confidence", "submission_blueprint")
    workflow.add_edge("submission_blueprint", "narrative_architecture")

    # 9. Narrative Architecture → Analysis (now thesis-driven) → Optimization → Writing
    workflow.add_edge("narrative_architecture", "analysis")
    workflow.add_edge("analysis", "optimization")
    workflow.add_edge("optimization", "writing")

    # 10. Terminal edges
    workflow.add_edge("interrogation", END)
    workflow.add_edge("writing", END)

    # 11. Persistence Layer
    checkpointer = MemorySaver()

    return workflow.compile(checkpointer=checkpointer)

# Instantiate the application
app = create_rankpilot_graph()