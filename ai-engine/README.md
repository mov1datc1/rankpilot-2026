# RankPilot Core

**An AI-powered multi-agent system for legal firm document analysis, structured data extraction, and automated report generation.**

---

## 1. PROJECT OVERVIEW

RankPilot Core is an orchestrated document processing pipeline built on **LangGraph** that automates the analysis of legal firm practice submissions. The system ingests PDF or DOCX documents, extracts structured metadata and matter details using a GPT-4o-powered extraction chain, performs strategic analysis with confidence scoring, and conditionally engages in a user interrogation loop to resolve ambiguities before generating a final LaTeX/PDF report. It is designed for high-reliability legal workflows where structured output and auditability are paramount.

---

## 2. ARCHITECTURE & DESIGN

### Core Patterns
- **State Machine Workflow**: The system is modeled as a directed acyclic graph (with a controlled loop) using LangGraph's `StateGraph`. Each node represents an atomic processing step (ingestion, extraction, analysis, interrogation, writing) that mutates a shared `AgentState`.
- **Agent-as-Node Pattern**: Each pipeline stage is implemented as a standalone node function (`ingestion_node`, `extraction_node`, etc.), promoting modularity, testability, and isolated responsibility.
- **Confidence-Driven Routing**: After analysis, a `confidence_score` (0-100) determines flow: scores ≥65% proceed directly to report generation; scores <65% trigger an `interrogator_node` to solicit clarifying user input before cycling back for re-analysis.
- **Structured Output Contract**: Data extraction and final report generation rely on **Pydantic schemas** (`SubmissionSchema`) enforced via LangChain's `with_structured_output`, guaranteeing JSON conformance.
- **Persistence via Thread Checkpointing**: State is persisted across conversational turns using `MemorySaver` with a `thread_id` (simulating session isolation), enabling multi-turn interactions on a single case.
- **Separation of Concerns**: Utilities for document parsing (`doc_parser`), LaTeX compilation (`pdf_generator`), and prompt management (`prompts`) are decoupled from the core graph logic.

### Data Flow
1. **Ingestion**: Raw file → plain text.
2. **Extraction**: Unstructured text → structured `SubmissionSchema` (firm, matters, narrative).
3. **Analysis**: Strategic assessment + confidence computation.
4. **Conditional Branch**: High confidence → Writing; Low confidence → Interrogation → Re-analysis loop.
5. **Generation**: LaTeX compilation → PDF.

---

## 3. DIRECTORY GUIDE

```
rankpilot-core/
├── main.py                          # Entry point: `run_rankpilot()` handles dual workflows (file vs. message)
├── agents/
│   ├── nodes.py                     # Node implementations for each pipeline stage
│   └── prompts.py                   # Centralized system prompt templates (extraction, analysis, editorial)
├── chains/
│   └── extraction_chain.py          # Factory for structured extraction chain (LLM + schema)
├── core/
│   ├── graph.py                     # `create_rankpilot_graph()`: assembles and compiles LangGraph state machine
│   ├── schema.py                    # Pydantic models: `Matter`, `SubmissionSchema`
│   └── state.py                     # `AgentState` TypedDict definition
├── Documentation_set/               # (Project documentation assets)
├── templates/                       # (LaTeX/template files for report generation)
├── utils/
│   ├── doc_parser.py                # PDF/DOCX text extraction utility
│   └── pdf_generator.py             # LaTeX → PDF compiler wrapper (requires pdflatex)
└── requirements.txt                 # (Hypothetical: Python dependencies)
```

---

## 4. COMPONENT TABLE

| Module | Responsibility | Key Features |
|--------|----------------|--------------|
| `doc_parser.py` | Multi-format document text extraction | Supports PDF (PyMuPDF) & DOCX; table cell joining; empty-paragraph filtering |
| `extraction_chain.py` | Structured data extraction from text | Configurable LLM (default `gpt-4o`); zero-temperature; Pydantic schema enforcement |
| `graph.py` | LangGraph orchestration | Conditional routing on confidence; loopback edge; `MemorySaver` checkpointing |
| `main.py` | Public API & workflow coordination | Dual-mode handler (file ingestion vs. conversational); thread-based state continuity |
| `nodes.py` | Pipeline stage implementations | Five nodes: ingestion, extraction, analysis, interrogation, writer; state mutation logic |
| `pdf_generator.py` | LaTeX rendering | Two-pass `pdflatex` execution; temporary file handling; success/failure signaling |
| `prompts.py` | Prompt management | Centralized system prompts for extraction, analysis, and editorial persona |
| `schema.py` | Data contract definition | Pydantic models for firm metadata, matters, and full submission structure |
| `state.py` | State schema definition | TypedDict with fields: `messages`, `submission`, `analysis`, `confidence_score`, `questions`, `latex_code` |

---

## 5. GETTING STARTED

### Prerequisites
- **Python 3.10+**
- **System LaTeX**: `pdflatex` must be installed and in `PATH` (e.g., TeX Live, MacTeX, MiKTeX).
- **OpenAI API Key**: Set environment variable `OPENAI_API_KEY`.

### Installation
```bash
# 1. Clone repository
git clone <repository-url>
cd rankpilot-core

# 2. Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# 3. Install dependencies
pip install -r requirements.txt
# Typical dependencies: langchain, langgraph, openai, pymupdf, python-docx, pydantic

# 4. Verify LaTeX installation
pdflatex --version
```

### Usage
```python
from main import run_rankpilot

# Initial case: ingest a document file
result = run_rankpilot(
    user_input="/path/to/submission.pdf",
    thread_id="case_123",
    is_file=True
)

# Subsequent conversational turns
response = run_rankpilot(
    user_input="The firm has 15 years of experience in maritime law.",
    thread_id="case_123",
    is_file=False
)
```

---

**System Requirements**:  
- OS: Linux/macOS/Windows with LaTeX support.  
- Network: Outbound access to OpenAI API.  
- Memory: ~2GB+ for LLM processing and LaTeX compilation.  

**Configuration**:  
Model names (e.g., `gpt-4o`) are parameterized in `extraction_chain.py` and `nodes.py`; override as needed for cost/performance trade-offs.

---

*For architectural deep dives, see `core/graph.py` (workflow) and `agents/nodes.py` (node logic).*

## 🔌 4. API INTEGRATION GUIDE (Laravel ↔ RankPilot)

Para conectar el ecosistema PHP/Laravel con el motor multi-agente de Python, se utiliza una arquitectura de microservicios mediante una **API RESTful**. El backend de Python actúa como un procesador asíncrono de documentos legales.

### A. Especificación del Endpoint
* **Protocolo**: HTTP/1.1
* **Método**: `POST`
* **Endpoint**: `/api/v1/analyze`
* **Autenticación**: `Bearer Token` (Configurado en el `.env` de Python)

### B. Estructura del Payload (Input de Laravel)
Laravel debe enviar el `thread_id` (para persistencia de memoria) y los datos de la firma para inicializar el grafo.

```json
{
  "thread_id": "case_uuid_123",    // ID único para mantener la memoria del proceso
  "is_file": true,               // true = procesar documento, false = mensaje de texto
  "user_input": "path/to/file.pdf" // Ruta del archivo o aclaración del usuario
}
```

### C. Esquema de Salida (Output del Sistema de Nodos)

Esta es la respuesta JSON que Laravel recibirá tras la ejecución exitosa del grafo. Los campos están sincronizados con AgentState y nodes.py:


```json
{
  "status": "success",
  "data": {
    "structured_data": {
      "firm_metadata": {
        "id": "101",
        "name": "Pérez Correa",
        "practice_area": "Corporate/M&A",
        "location": "Mexico City"
      },
      "matters": [
        {
          "title": "Project X Acquisition",
          "significance": "High-impact cross-border transaction..."
        }
      ]
    },
    "analysis_results": {
      "tier_detected": "Tier 2",
      "confidence_score": 88,
      "dominant_model": "Institutional"
    },
    "output_assets": {
      "pdf_url": "https://api.rankpilot.ai/exports/Perez_Correa_Snapshot.pdf",
      "latex_source_code": "\\documentclass{article}..."
    },
    "flow_control": {
      "is_complete": true,
      "next_step": "report_ready"
    }
  }
}
```
### D. Lógica de Implementación en Laravel (Guzzle/Http)

El controlador de Laravel debe manejar la respuesta asíncrona o esperar el PDF generado:

``` PHP
$response = Http::withToken(env('PYTHON_API_KEY'))
    ->post('https://python-service/api/v1/analyze', [
        'thread_id' => $submission->uuid,
        'file_path' => $submission->file_path
    ]);

if ($response->json('data.flow_control.is_complete')) {
    // El sistema de nodos terminó con éxito: Descargar PDF
    $pdfUrl = $response->json('data.output_assets.pdf_url');
    $submission->update(['status' => 'analyzed', 'report_url' => $pdfUrl]);
}
```
### 🧠 Notas Técnicas para el README

    Manejo de Estados: El thread_id es crítico. Laravel debe persistir este ID para permitir que el interrogator_node mantenga el contexto si la confianza es baja (<65%).

    Compilación de PDF: El README debe advertir que el nodo de salida (writer_node) bloquea el hilo mientras pdflatex realiza las dos pasadas necesarias para renderizar la portada.

    Seguridad: Todas las llamadas entre sistemas deben estar firmadas mediante un X-API-KEY configurado en el .env de Python.
```