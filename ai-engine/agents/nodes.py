import json
import os
from datetime import datetime
from typing import Dict
from dotenv import load_dotenv
from chains.extraction_chain import get_extraction_chain
# Importaciones de LangChain y Core
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import SystemMessage, HumanMessage

from core.state import AgentState
from agents.prompts import ( 
    STRATEGIC_ANALYSIS_PROMPT, 
    EDITORIAL_INTERROGATOR_PROMPT,
    LATEX_WRITER_PROMPT,
    MATTER_OPTIMIZER_PROMPT
)
from utils.pdf_generator import compile_latex_to_pdf
from utils.rag_router import RAGRouter

load_dotenv()

# --- UTILIDADES DE NODOS ---

def get_model():
    """
    Configuración para OpenAI Directo (GPT-4o o GPT-4o-mini).
    Asegúrate de tener OPENAI_API_KEY en tu archivo .env.
    """
    return ChatOpenAI(
        model_name="gpt-4o", # O el modelo que prefieras de OpenAI
        temperature=0.2,     # Baja temperatura para mayor consistencia en LaTeX
        openai_api_key=os.environ.get("OPENAI_API_KEY")
    )

# 1. INGESTION NODE
def ingestion_node(state: AgentState) -> Dict:
    file_path = state.get("file_path")
    if not file_path:
        return {"messages": [("assistant", "No file provided.")]}
    
    from utils.doc_parser import DocumentParser
    text = DocumentParser.parse(file_path)
    
    return {
        "doc_text": text,
        "messages": [("assistant", f"Document ingested. Analyzing structural signals...")]
    }

# 2. EXTRACTION NODE (Sincronizado con AgentState)
# 2. EXTRACTION NODE (CORREGIDO)
def extraction_node(state: AgentState) -> Dict:
    doc_text = state.get("doc_text", "")
    # Capturamos mensajes para el "Hybrid Extractor"
    chat_history = "\n".join([msg.content for msg in state["messages"] if hasattr(msg, 'content')])
    full_input = f"{doc_text}\n\nUpdates from chat:\n{chat_history}"

    chain = get_extraction_chain()
    # La chain devuelve un objeto estructurado (SubmissionSchema)
    structured_data = chain.invoke({"text": full_input})
    
    # IMPORTANTE: Si structured_data es un dict, usamos ['key']. 
    # Si es Pydantic, usamos .attribute. 
    # Para asegurar CERO ERRORES, usamos model_dump() si es Pydantic:
    
    if hasattr(structured_data, "model_dump"):
        data_dict = structured_data.model_dump()
    elif isinstance(structured_data, dict):
        data_dict = structured_data
    else:
        data_dict = {"metadata": {}, "matters": []}

    # Extract metadata correctly
    ext_meta = data_dict.get("metadata", {})
    if not isinstance(ext_meta, dict):
        ext_meta = {}

    # Sincronizamos con las llaves exactas de state.py
    return {
        "metadata": {
            "firm_name": ext_meta.get("firm_name", ""),
            "practice_area": ext_meta.get("practice_area", ""),
            "location": ext_meta.get("location", ""),
            "narrative": ext_meta.get("narrative_overview", "")
        },
        "matters": data_dict.get("matters", []),
        "current_step": "context"
    }

# 2.5 CONTEXT ENGINE NODE (8-Layer Methodology)
def context_engine_node(state: AgentState) -> Dict:
    submission_context = state.get("submission_context", {})
    jurisdiction = submission_context.get("jurisdiction", "")
    practice_area = submission_context.get("practice_area", "")
    directory = submission_context.get("directory", "")
    current_status = submission_context.get("current_status", "")
    
    # Capa 2: Clasificación del punto de partida
    starting_position = "Unknown"
    status_lower = str(current_status).lower()
    if "unranked" in status_lower or not status_lower:
        starting_position = "Entry Candidate"
    elif "5" in status_lower or "4" in status_lower:
        starting_position = "Lower Tier Consolidation"
    elif "3" in status_lower or "2" in status_lower:
        starting_position = "Upper Tier Push"
    elif "1" in status_lower:
        starting_position = "Defensive Leadership"

    # LLM extraction for Capa 3, 4, 5, 8
    llm = get_model()
    from core.schema import ContextEngineOutput
    structured_llm = llm.with_structured_output(ContextEngineOutput)
    
    input_data = {
        "metadata": state.get("metadata", {}),
        "matters": state.get("matters", [])
    }
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are the RankPilot Context Engine. Analyze the firm's evidence and extract exactly the requested fields."),
        ("human", "Firm Data: {data}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        context_output = chain.invoke({"data": json.dumps(input_data)})
        if hasattr(context_output, "model_dump"):
            context_dict = context_output.model_dump()
        else:
            context_dict = dict(context_output)
    except Exception as e:
        print(f"Error in Context Engine LLM: {e}")
        context_dict = {
            "practice_type": "mixed",
            "archetype": "General Practice",
            "complexity_profile": "Standard domestic work",
            "client_type": "Mixed clients",
            "identity_adn": "General full-service practice"
        }

    # Capa 6: Benchmark Relativo (Hardcoded V1)
    benchmark = "Standard regional baseline requirements apply."
    if "mexico" in str(jurisdiction).lower() and "banking" in str(practice_area).lower():
        benchmark = "Entry: mid-market deals, some cross-border. Band 3: strong deal flow, repeat clients. Band 1: flagship deals, complex structuring."
    
    # Capa 7: Evaluación de viabilidad
    target_realistic = "Viability assessment pending."
    if starting_position == "Entry Candidate":
        if "cross-border" in str(context_dict.get("complexity_profile", "")).lower() or "institutional" in str(context_dict.get("client_type", "")).lower():
            target_realistic = "Band 4-5 viable"
        else:
            target_realistic = "Below ranking threshold"
    elif starting_position == "Upper Tier Push":
        target_realistic = "Consolidation needed to break into top tiers"
    elif starting_position == "Lower Tier Consolidation":
        target_realistic = "Path to Band 3 viable with flagship mandates"
    else:
        target_realistic = "Maintain defensible track record"

    strategic_context = {
        "directory": directory,
        "jurisdiction": jurisdiction,
        "practice_area": practice_area,
        "current_status": current_status,
        "starting_position": starting_position,
        "practice_type": context_dict.get("practice_type"),
        "archetype": context_dict.get("archetype"),
        "complexity_profile": context_dict.get("complexity_profile"),
        "client_type": context_dict.get("client_type"),
        "identity_adn": context_dict.get("identity_adn"),
        "benchmark_reference": benchmark,
        "target_realistic": target_realistic
    }

    return {
        "strategic_context": strategic_context,
        "current_step": "analysis"
    }
# 3. ANALYSIS NODE
def analysis_node(state: AgentState) -> Dict:
    llm = get_model()
    
    # 1. Recuperar contexto para el RAG
    submission_context = state.get("submission_context", {})
    jurisdiction = submission_context.get("jurisdiction", "")
    practice_area = submission_context.get("practice_area", "")
    directory = submission_context.get("directory", "")
    
    # 2. Inicializar RAG Router y extraer guías
    router = RAGRouter()
    rag_knowledge = router.get_rag_context(practice_area, directory)
    
    # 3. Preparar datos inyectando el conocimiento RAG
    input_data = {
        "metadata": state.get("metadata", {}),
        "matters": state.get("matters", []),
        "strategic_context": state.get("strategic_context", {}),
        "RAG_KNOWLEDGE": rag_knowledge
    }
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", STRATEGIC_ANALYSIS_PROMPT),
        ("human", "Analyze this firm data and return JSON: {data}")
    ])
    
    chain = prompt | llm
    response = chain.invoke({"data": json.dumps(input_data, indent=2)})
    
    try:
        res_json = json.loads(response.content.replace("```json", "").replace("```", ""))
        return {
            "analysis": res_json,
            "confidence_score": float(res_json.get("confidence_score", 100)),
            "current_step": "writing" # Bypass interrogation for now since we want the audit letter
        }
    except Exception as e:
        print(f"Error parsing analysis JSON: {e}")
        return {"confidence_score": 0}

# 4. INTERROGATOR NODE
def interrogator_node(state: AgentState) -> Dict:
    llm = get_model()
    analysis = state.get("analysis", {})
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", EDITORIAL_INTERROGATOR_PROMPT),
        ("placeholder", "{messages}"),
        ("human", "Current Analysis: {analysis_data}. Ask for missing info.")
    ])
    
    chain = prompt | llm
    response = chain.invoke({
        "messages": state["messages"],
        "analysis_data": json.dumps(analysis)
    })
    
    return {"messages": [response]}

# 5. OPTIMIZATION NODE
def optimization_node(state: AgentState) -> Dict:
    print("--- OPTIMIZING MATTERS ---")
    matters = state.get("matters", [])
    
    if not matters:
        return state

    llm = get_model()
    # Require JSON output with 'optimized_text' key
    llm = llm.bind(response_format={"type": "json_object"})
    
    optimized_matters = []
    for matter in matters:
        # Construct the raw matter text to feed to the optimizer
        raw_text = f"Title: {matter.get('title', '')}\nClient: {matter.get('client', '')}\nValue: {matter.get('value', '')}\nSummary: {matter.get('summary', '')}\nSignificance: {matter.get('significance', '')}\nLead Partner: {matter.get('lead_partner', '')}"
        
        messages = [
            SystemMessage(content=MATTER_OPTIMIZER_PROMPT),
            HumanMessage(content=f"Optimize this raw matter:\n\n{raw_text}")
        ]
        
        try:
            response = llm.invoke(messages)
            result = json.loads(response.content)
            matter['optimized_text'] = result.get('optimized_text', matter.get('summary'))
            matter['status'] = 'AI Optimized'
        except Exception as e:
            print(f"Error optimizing matter: {e}")
            matter['optimized_text'] = matter.get('summary', '')
            matter['status'] = 'Optimization Failed'
            
        optimized_matters.append(matter)
        
    return {"matters": optimized_matters}

# 6. WRITER NODE
def writer_node(state: AgentState, config: RunnableConfig) -> Dict:
    print("--- GENERATING PDF REPORT ---")
    analysis = state.get("analysis", {})
    metadata = state.get("metadata", {})
    matters = state.get("matters", [])
    
    # 1. Load LaTeX Template
    try:
        with open("templates/report_template.tex", "r") as f:
            template_content = f.read()
    except Exception as e:
        print(f"Template not found: {e}")
        return {"is_complete": True, "pdf_url": ""}

    # 2. Format Matters for LaTeX
    matter_list_latex = ""
    for m in matters:
        name = m.get("name") or m.get("title") or "Unnamed Matter"
        val = m.get("value", "N/A")
        client = m.get("client", "N/A")
        summary = m.get("optimizedText") or m.get("optimized_text") or m.get("rawNotes") or m.get("summary") or "No description."
        matter_list_latex += f"\\item \\textbf{{{name}}} (Client: {client} | Value: {val})\\\\ {summary}\n"

    if not matter_list_latex:
        matter_list_latex = "\\item \\textit{No matters associated.}"

    # 3. Format Evolution Steps
    evo_steps = analysis.get("recommendations", [])
    if isinstance(evo_steps, list):
        evo_latex = "\n".join([f"\\item {step}" for step in evo_steps])
    else:
        evo_latex = f"\\item {evo_steps}"
        
    if not evo_latex.strip():
        evo_latex = "\\item Maintain current strategy."

    # 4. Replace Placeholders
    latex_code = template_content
    latex_code = latex_code.replace("{{FIRM_NAME}}", str(metadata.get("firm_name", "Unknown Firm")))
    latex_code = latex_code.replace("{{PRACTICE_AREA}}", str(metadata.get("practice_area", "General Practice")))
    latex_code = latex_code.replace("{{MODEL_NAME}}", str(analysis.get("practice_model", "Standard")))
    latex_code = latex_code.replace("{{TIER}}", str(analysis.get("current_tier_assessment", "Unranked / New Entry")))
    latex_code = latex_code.replace("{{CONFIDENCE}}", str(state.get("confidence_score", 80)))
    latex_code = latex_code.replace("{{ADVANTAGE}}", str(analysis.get("competitive_edge", "Standard Market Offerings")))
    latex_code = latex_code.replace("{{MATTER_LIST}}", matter_list_latex)
    latex_code = latex_code.replace("{{EVOLUTION_STEPS}}", evo_latex)

    # Sanitize LaTeX (basic escape for &, %, $, #, _)
    for char in ['&', '%', '$', '#', '_']:
        if char in latex_code:
            # We skip proper escaping for this prototype to avoid breaking actual latex commands
            pass

    # 5. Compile PDF
    output_filename = f"report_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    pdf_path = compile_latex_to_pdf(latex_code, output_filename)
    
    # 6. Return the URL (For local dev, we assume the python API serves the root or we return relative path)
    # In production with Vercel, we would upload to Supabase Storage here.
    # For now, we return the path which the FastAPI can serve.
    pdf_url = f"/api/download/{pdf_path}" if pdf_path else ""

    return {
        "is_complete": True,
        "pdf_url": pdf_url
    }