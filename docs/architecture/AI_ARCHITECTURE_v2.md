# RankPilot AI Engine Architecture (v2)

This document illustrates the complete end-to-end flow of the RankPilot AI Engine, incorporating the Next.js Frontend, the FastAPI Backend, the LangGraph State Machine, and the new RAG (Retrieval-Augmented Generation) system.

![RankPilot AI Engine Architecture](/Users/jonathanpalacios/.gemini/antigravity/brain/b7b2aa3a-9103-4367-b996-edae89ba5168/ai_architecture_diagram_1783613561047.png)

## High-Level Architecture Diagram

```mermaid
sequenceDiagram
    participant U as User (Builder)
    participant N as Next.js (Server Actions)
    participant DB as Prisma (PostgreSQL)
    participant API as Python (FastAPI)
    participant G as LangGraph (State Machine)
    participant RAG as RAG Router
    participant LLM as OpenAI (GPT-4o)

    U->>N: 1. Submits Firm Data & Matters
    N->>DB: 2. Saves raw Submission (Draft)
    N->>API: 3. POST /process (Submission Context)
    
    rect rgb(240, 248, 255)
        Note over API, LLM: RankPilot AI Engine (LangGraph)
        API->>G: 4. Initialize AgentState
        
        %% Ingestion & Extraction
        G->>LLM: 5. Ingestion & Extraction Node
        LLM-->>G: Structured JSON (Matters)
        
        %% Context Engine
        G->>LLM: 6. Context Engine (8-Layer Logic)
        LLM-->>G: Strategic Context (Archetype, Risk)
        
        %% RAG Integration
        G->>RAG: 7. Analysis Node requests RAG Knowledge
        Note right of RAG: Matches Practice Area & Directory<br>(e.g. Legal 500 + Labour)
        RAG-->>G: Injects Specific Rules & Universal Framework
        
        %% Strategic Analysis
        G->>LLM: 8. Analyst runs Prompt + RAG + Context
        LLM-->>G: Strategic Audit Letter JSON
        
        %% Writer bypass
        G->>G: 9. Writer Node (Bypass / Mark Complete)
    end
    
    G-->>API: 10. Return Final State
    API-->>N: 11. JSON Response (Audit + Context)
    
    N->>DB: 12. Update chambersData JSON
    DB-->>N: Success
    N-->>U: 13. UI renders Strategic Audit Letter
```

## Internal LangGraph Flow

This represents the internal state machine flow (`ai-engine/core/graph.py`).

```mermaid
graph TD
    A[Start: Next.js Payload] --> B(Ingestion Node)
    
    B -->|Extracts raw text| C(Extraction Node)
    
    C -->|Structures Matters into JSON| D{Context Engine Node}
    
    D -->|8-Layer Logic| E[Strategic Context Generated]
    
    subgraph Analysis Phase
        E --> F[Analysis Node]
        R[(RAG Knowledge Base)] -.->|Injects Directory/Practice Rules| F
        F --> G{Confidence Score >= 65%}
    end
    
    G -->|Yes| H(Writer Node)
    G -->|No| I(Interrogation Node)
    
    I -.->|Requires Human Input| A
    
    H -->|Graph Complete| J[Return Final JSON]
```

## Data Persistence Strategy

The Python backend is completely stateless. It acts purely as a processing engine. All data is managed by **Next.js** and stored in **Prisma (PostgreSQL)**.

- **`TargetDirectory`, `PracticeArea`, `Region`**: Stored as native Prisma columns on the `Submission` model.
- **Matters**: Stored as related records in the `Matter` model.
- **AI Analytics (`StrategicContext`, `AuditLetter`, `Score`)**: Stored entirely within the `chambersData` JSON column in the `Submission` model, allowing maximum flexibility for future AI additions without needing constant database migrations.
