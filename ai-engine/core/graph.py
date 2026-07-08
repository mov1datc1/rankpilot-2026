from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver 
from agents.nodes import (
    ingestion_node, 
    extraction_node, 
    analysis_node, 
    interrogator_node, 
    writer_node
)
from core.state import AgentState

def create_rankpilot_graph():
    """
    Constructs the LangGraph state machine with a persistent dialectic loop.
    The graph ensures a 'Senior Consultant' experience by gating the final
    report behind a 65% structural confidence threshold.
    """
    
    # 1. Initialize the StateGraph with our custom AgentState
    workflow = StateGraph(AgentState)

    # 2. Add the Functional Nodes
    workflow.add_node("ingestion", ingestion_node)
    workflow.add_node("extraction", extraction_node)
    workflow.add_node("analysis", analysis_node)
    workflow.add_node("interrogation", interrogator_node)
    workflow.add_node("writing", writer_node)

    # 3. Define the Fixed Entry Sequence
    # Every new file or first interaction starts here
    workflow.set_entry_point("ingestion")
    workflow.add_edge("ingestion", "extraction")
    workflow.add_edge("extraction", "analysis")

    # 4. Define the Dialectic Gate (Conditional Logic)
    def route_based_on_confidence(state: AgentState):
        """
        Internal router that hides the mathematical threshold from the user.
        If confidence < 65%, we gather more strategic info.
        If confidence >= 65%, we proceed to the Institutional Standard output.
        """
        if state.get("confidence_score", 0) >= 65:
            return "writing"
        return "interrogation"

    workflow.add_conditional_edges(
        "analysis",
        route_based_on_confidence,
        {
            "writing": "writing",
            "interrogation": "interrogation"
        }
    )

    # 5. Define the Loopback
    # After the Interrogator speaks, the graph pauses for user input.
    # Once the user replies, we route back to 'extraction' to update 
    # the structured JSON with the new strategic details.
    workflow.add_edge("interrogation", END) 

# 6. Final Exit
    workflow.add_edge("writing", END)

    # 7. Persistence Layer (The "Memory" for Laravel's session_id)
    # MemorySaver keeps the state in-memory. 
    # For production with multiple workers, swap for SqliteSaver or PostgresSaver.
    checkpointer = MemorySaver()

    return workflow.compile(checkpointer=checkpointer)

# Instantiate the application
app = create_rankpilot_graph()