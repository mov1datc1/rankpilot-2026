## Overview
This file defines the `create_rankpilot_graph` function, which constructs and compiles a LangGraph state machine for a document processing pipeline. The graph orchestrates a sequence of agent nodes with a persistent dialectic loop, gating final report generation behind a 65% structural confidence threshold.

## Classes
- None (no class definitions in this file; only imports and function definitions)

## Functions & Methods
| Name | Parameters | Responsibility |
|------|------------|----------------|
| create_rankpilot_graph | None | Constructs the LangGraph state machine by adding nodes, defining fixed entry sequence, implementing confidence-based conditional routing, setting up a loopback edge, and compiling with a MemorySaver checkpointer. |
| route_based_on_confidence | state: AgentState | Internal router that examines `confidence_score` in the state and returns either `"writing"` (if score ≥ 65) or `"interrogation"` (if score < 65) to control graph flow. |