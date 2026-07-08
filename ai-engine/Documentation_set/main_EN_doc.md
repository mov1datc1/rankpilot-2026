## Overview
This module provides the `run_rankpilot` function, which serves as the main entry point for the RankPilot Multi-Agent System. It handles two distinct workflow modes: initial document ingestion (via file path) and subsequent conversational turns (via user messages). The function manages state persistence using thread identifiers (simulating Laravel session IDs) and interfaces with a stateful LangGraph application (`app`) to coordinate multi-agent processing.

## Classes
*(No classes defined in this file)*

## Functions & Methods
| Name | Parameters | Responsibility |
|------|------------|-----------------|
| run_rankpilot | user_input: str, thread_id: str, is_file: bool = False | Main execution wrapper for the RankPilot Multi-Agent System. Determines workflow mode based on `is_file` flag: if True, initiates a new case by ingesting a file path; if False, resumes an existing case with a user message. Uses `thread_id` for state persistence across calls and returns the final state from the graph execution. Handles logging of workflow transitions. |