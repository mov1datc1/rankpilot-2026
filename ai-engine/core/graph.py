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
    comprehension_node,
    identity_discovery_node,
    hypothesis_construction_node,
    refutation_engine_node,
    comparative_analysis_node,
    editorial_confidence_node,
    narrative_architecture_node,
)
from core.state import AgentState

def create_rankpilot_graph():
    """
    Constructs the RankPilot Editorial Reasoning Engine graph.
    
    This is a 14-node pipeline that reproduces the reasoning of a senior 
    rankings consultant before writing a single word.
    
    Pipeline Architecture:
    
    ingestion → extraction → context_engine → comprehension
                                                    ↓
                                              [thesis exists?]
                                              YES → identity_discovery
                                              NO  → interrogation → END
                                                    ↓
                                              hypothesis_construction
                                                    ↓
                                              refutation_engine
                                                    ↓
                                              comparative_analysis
                                                    ↓
                                              editorial_confidence
                                                    ↓
                                              [defensible?]
                                              YES → narrative_architecture
                                              NO  → interrogation → END
                                                    ↓
                                              analysis (now thesis-driven)
                                                    ↓
                                              optimization
                                                    ↓
                                              writing → END
    """
    
    # 1. Initialize the StateGraph
    workflow = StateGraph(AgentState)

    # 2. Register ALL nodes (original + editorial reasoning)
    # --- Original pipeline nodes ---
    workflow.add_node("ingestion", ingestion_node)
    workflow.add_node("extraction", extraction_node)
    workflow.add_node("context_engine", context_engine_node)
    workflow.add_node("analysis", analysis_node)
    workflow.add_node("optimization", optimization_node)
    workflow.add_node("interrogation", interrogator_node)
    workflow.add_node("writing", writer_node)
    
    # --- Editorial Reasoning Engine nodes (NEW) ---
    workflow.add_node("comprehension", comprehension_node)
    workflow.add_node("identity_discovery", identity_discovery_node)
    workflow.add_node("hypothesis_construction", hypothesis_construction_node)
    workflow.add_node("refutation_engine", refutation_engine_node)
    workflow.add_node("comparative_analysis", comparative_analysis_node)
    workflow.add_node("editorial_confidence", editorial_confidence_node)
    workflow.add_node("narrative_architecture", narrative_architecture_node)

    # 3. Entry sequence (unchanged start)
    workflow.set_entry_point("ingestion")
    workflow.add_edge("ingestion", "extraction")
    workflow.add_edge("extraction", "context_engine")
    
    # 4. After context engine → comprehension (NEW: replaces direct-to-analysis)
    workflow.add_edge("context_engine", "comprehension")

    # 5. Comprehension Gate: Does a thesis exist with sufficient evidence?
    def route_after_comprehension(state: AgentState):
        """Chapter 1 gate: the system must understand before it analyzes."""
        comprehension = state.get("comprehension", {})
        thesis_exists = comprehension.get("thesis_exists", False)
        evidence_sufficient = comprehension.get("evidence_sufficient", False)
        confidence = comprehension.get("comprehension_confidence", 0)
        
        if thesis_exists and evidence_sufficient and confidence >= 0.4:
            return "identity_discovery"
        return "interrogation"

    workflow.add_conditional_edges(
        "comprehension",
        route_after_comprehension,
        {
            "identity_discovery": "identity_discovery",
            "interrogation": "interrogation"
        }
    )

    # 6. Editorial Reasoning chain (sequential)
    workflow.add_edge("identity_discovery", "hypothesis_construction")
    workflow.add_edge("hypothesis_construction", "refutation_engine")
    workflow.add_edge("refutation_engine", "comparative_analysis")
    workflow.add_edge("comparative_analysis", "editorial_confidence")

    # 7. Editorial Confidence Gate: Is the recommendation defensible?
    def route_after_confidence(state: AgentState):
        """Chapter 4 gate: seek the most defensible conclusion, not the most optimistic."""
        confidence = state.get("editorial_confidence", {})
        passes = confidence.get("passes_defensibility_test", False)
        recommendation = confidence.get("recommendation", "needs_investigation")
        
        if passes or recommendation in ("proceed", "proceed_with_caveats"):
            return "narrative_architecture"
        return "interrogation"

    workflow.add_conditional_edges(
        "editorial_confidence",
        route_after_confidence,
        {
            "narrative_architecture": "narrative_architecture",
            "interrogation": "interrogation"
        }
    )

    # 8. Narrative Architecture → Analysis (now thesis-driven) → Optimization → Writing
    workflow.add_edge("narrative_architecture", "analysis")
    workflow.add_edge("analysis", "optimization")
    workflow.add_edge("optimization", "writing")

    # 9. Terminal edges
    workflow.add_edge("interrogation", END)
    workflow.add_edge("writing", END)

    # 10. Persistence Layer
    checkpointer = MemorySaver()

    return workflow.compile(checkpointer=checkpointer)

# Instantiate the application
app = create_rankpilot_graph()