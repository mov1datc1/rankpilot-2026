## Overview
This file implements a stateful, node-based pipeline for processing legal firm documents. It orchestrates a workflow from document ingestion through data extraction, strategic analysis, optional user interrogation, and final LaTeX/PDF report generation. Each node updates a shared `AgentState` dictionary to progress the workflow.

## Classes
None

## Functions & Methods
| Name | Parameters | Responsibility |
|------|------------|----------------|
| ingestion_node | state: AgentState | Parses a document file into plain text, validates file path existence, and transitions state to the extraction step. |
| extraction_node | state: AgentState | Invokes a resilient extraction chain to convert raw text into structured JSON data (firm metadata, matters, narrative). |
| analysis_node | state: AgentState | Performs high-level strategic analysis using GPT-4o, computes a confidence score, and routes to report generation or user interrogation based on a threshold (≥65%). |
| interrogator_node | state: AgentState | Generates context-aware user prompts to address analysis gaps using an editorial persona, then pauses workflow for user input. |
| writer_node | state: dict | Constructs a LaTeX document with a standardized front page and AI-generated content, then compiles it to a PDF file. |