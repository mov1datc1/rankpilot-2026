import os
import re
import uuid
import json
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from core.graph import app as graph_app 
from langchain_core.messages import HumanMessage
from agents.nodes import writer_node
from utils.docx_generator import generate_docx_report
from utils.language_guard import filter_pipeline_output
from utils.editorial_memory import (
    load_memory, save_memory, extract_lessons_from_result, format_memory_for_prompt
)


def sanitize_unicode(text: str) -> str:
    """Remove or replace problematic Unicode escape sequences and control characters."""
    if not isinstance(text, str):
        return str(text) if text is not None else ""
    # Remove null bytes
    text = text.replace('\x00', '')
    # Remove other control characters (except newline, tab, carriage return)
    text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    # Fix invalid Unicode escape sequences like \uD800-\uDFFF (surrogates)
    text = text.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
    return text


def safe_json_dumps(obj) -> str:
    """JSON serialize with Unicode safety."""
    try:
        return json.dumps(obj, indent=2, default=str, ensure_ascii=False)
    except (TypeError, ValueError):
        return json.dumps(obj, indent=2, default=str, ensure_ascii=True)

# 1. Instancia de la API para comunicación con el Backend
api = FastAPI(title="RankPilot AI Core", version="1.0.0")

@api.get("/health")
async def health_check():
    """
    Verifica que el servidor FastAPI está corriendo correctamente.
    """
    return {
        "status": "online",
        "message": "Hola Mundo - RankPilot Core is alive",
        "version": "1.0.0",
        "environment": "Ubuntu/Docker"
    }

def run_rankpilot(user_input: str, thread_id: str, is_file: bool = False):
    """
    Orquestador del Grafo. Procesa la entrada y devuelve el estado final.
    """
    config = {"configurable": {"thread_id": thread_id}}
    
    if is_file:
        initial_state = {"file_path": user_input, "messages": []}
        output = graph_app.invoke(initial_state, config)
    else:
        output = graph_app.invoke(
            {"messages": [HumanMessage(content=user_input)]}, 
            config
        )
    
    if output.get("is_complete"):
        raw_path = output.get("pdf_url")
        if raw_path and os.path.exists(raw_path):
            output["pdf_url"] = os.path.abspath(raw_path)
            
    return output

@api.post("/process")
async def process_document(request: Request):
    """
    Endpoint principal para procesar documentos de submissions y pasarlos por el pipeline completo.
    Ahora recibe un 'context' obligatorio con: directory, jurisdiction, practice_area, current_status.
    """
    try:
        data = await request.json()
    except Exception as e:
        return JSONResponse(status_code=400, content={
            "error": "Invalid JSON in request body",
            "error_code": "INVALID_REQUEST",
            "details": str(e)
        })

    user_input = data.get("user_input")
    thread_id = data.get("thread_id")
    is_file = data.get("is_file", False)
    context = data.get("context", {})

    if not user_input or not thread_id:
        return JSONResponse(status_code=400, content={
            "error": "Missing user_input or thread_id",
            "error_code": "MISSING_PARAMS"
        })

    config = {"configurable": {"thread_id": thread_id}}

    # Sanitize user input text to prevent Unicode issues downstream
    sanitized_input = sanitize_unicode(user_input) if not is_file else user_input

    initial_state = {
        "file_path": user_input if is_file else "",
        "doc_text": sanitized_input if not is_file else "",
        "messages": [HumanMessage(content="Please process this submission document.")],
        "metadata": {},
        "matters": [],
        "analysis": {},
        "latex_code": "",
        "confidence_score": 0.0,
        "is_complete": False,
        "pdf_url": "",
        "submission_context": context,
        "strategic_context": {},
        # Editorial Reasoning Engine — initial empty state
        "comprehension": {},
        "competitive_identity": {},
        "hypotheses": [],
        "refutation_results": {},
        "comparative_analysis": {},
        "editorial_confidence": {},
        "narrative_architecture": {},
        "submission_blueprint": {},
        "evidence_map": {},
        "reasoning_trace": [],
        "current_step": "ingestion",
    }

    # v7.0: Load editorial memory for this practice area + jurisdiction
    editorial_memory_context = ""
    try:
        practice_area = context.get("practice_area", "")
        jurisdiction = context.get("jurisdiction", "")
        if practice_area and jurisdiction:
            memory_bank = load_memory(practice_area, jurisdiction)
            editorial_memory_context = format_memory_for_prompt(memory_bank)
            if editorial_memory_context:
                initial_state["editorial_memory"] = editorial_memory_context
                print(f"[EDITORIAL MEMORY] Loaded {memory_bank.total_submissions_processed} past submissions for {practice_area}/{jurisdiction}")
    except Exception as e:
        print(f"[EDITORIAL MEMORY] Warning: Could not load memory: {e}")
    
    try:
        result = graph_app.invoke(initial_state, config)
    except Exception as e:
        error_msg = traceback.format_exc()
        print(f"[PIPELINE ERROR] LangGraph execution failed for thread {thread_id}:")
        print(error_msg)
        return JSONResponse(status_code=500, content={
            "error": "El motor de IA encontró un error al procesar tu documento. Por favor, intenta de nuevo o contacta soporte.",
            "error_code": "PIPELINE_EXECUTION_ERROR",
            "details": str(e),
            "thread_id": thread_id
        })
    
    # Safely extract the last message text
    try:
        messages = result.get("messages", [])
        response_text = "No response generated."
        if messages:
            last_msg = messages[-1]
            if hasattr(last_msg, "content"):
                response_text = sanitize_unicode(last_msg.content)
            elif isinstance(last_msg, tuple) and len(last_msg) > 1:
                response_text = sanitize_unicode(str(last_msg[1]))
            else:
                response_text = sanitize_unicode(str(last_msg))
    except Exception as e:
        print(f"[RESPONSE PARSE ERROR] Failed to extract messages: {e}")
        response_text = "Processing completed but response extraction failed."
    
    # Build response with safe serialization
    try:
        response_data = {
            "status": "completed" if result.get("is_complete") else "interrogating",
            "thread_id": thread_id,
            "data": {
                "pdf_url": result.get("pdf_url"),
                "is_complete": result.get("is_complete", False),
                "response": response_text,
                "metadata": result.get("metadata", {}),
                "matters": result.get("matters", []),
                "analysis": result.get("analysis", {}),
                "strategic_context": result.get("strategic_context", {}),
                # Editorial Reasoning Engine outputs
                "comprehension": result.get("comprehension", {}),
                "competitive_identity": result.get("competitive_identity", {}),
                "hypotheses": result.get("hypotheses", []),
                "refutation_results": result.get("refutation_results", {}),
                "comparative_analysis": result.get("comparative_analysis", {}),
                "editorial_confidence": result.get("editorial_confidence", {}),
                "narrative_architecture": result.get("narrative_architecture", {}),
                "submission_blueprint": result.get("submission_blueprint", {}),
                "reasoning_trace": result.get("reasoning_trace", []),
            }
        }

        # v7.0: Apply epistemic language guard to ALL AI output
        response_data["data"] = filter_pipeline_output(response_data["data"])

        # v7.0: Save editorial memory (lessons learned from this submission)
        try:
            practice_area = context.get("practice_area", "")
            jurisdiction = context.get("jurisdiction", "")
            if practice_area and jurisdiction:
                lessons = extract_lessons_from_result(response_data["data"], practice_area, jurisdiction)
                if lessons:
                    save_memory(practice_area, jurisdiction, lessons)
        except Exception as mem_err:
            print(f"[EDITORIAL MEMORY] Warning: Could not save memory: {mem_err}")

        # Validate serialization before returning
        json.dumps(response_data, default=str, ensure_ascii=False)
        return response_data
    except (TypeError, ValueError, UnicodeError) as e:
        print(f"[SERIALIZATION ERROR] Failed to serialize response: {e}")
        # Fallback: force ASCII serialization
        safe_response = json.loads(json.dumps(response_data, default=str, ensure_ascii=True))
        return safe_response

@api.post("/generate-report")
async def generate_report_endpoint(request: Request):
    """
    Genera un PDF compilado recibiendo el array de matters ya optimizados desde Next.js
    """
    data = await request.json()
    thread_id = data.get("submission_id", str(uuid.uuid4()))
    
    # Construimos un state manual para el writer_node
    state = {
        "metadata": data.get("metadata", {}),
        "matters": data.get("matters", []),
        "analysis": data.get("analysis", {"confidence_score": 100})
    }
    config = {"configurable": {"thread_id": thread_id}}
    
    # Llamamos directamente al writer_node
    result = writer_node(state, config)
    
    return {
        "success": result.get("is_complete", False),
        "pdf_url": os.path.abspath(result.get("pdf_url")) if result.get("pdf_url") else None,
        "latex_code": result.get("latex_code")
    }

@api.post("/generate-docx")
async def generate_docx_endpoint(request: Request):
    """
    Genera un archivo DOCX directamente usando python-docx.
    """
    data = await request.json()
    thread_id = data.get("submission_id", str(uuid.uuid4()))
    
    structured_data = {
        "firm_metadata": data.get("metadata", {}),
        "matters": data.get("matters", []),
        "chambersData": data.get("chambersData", {})
    }
    
    doc_type = data.get("doc_type", "audit")
    
    # Generate the docx
    filename = f"report_{thread_id}_{doc_type}"
    try:
        file_path = generate_docx_report(structured_data, filename, doc_type)
        return {
            "success": True,
            "docx_url": os.path.abspath(file_path)
        }
    except Exception as e:
        print(f"Error generating DOCX: {e}")
        return {"success": False, "error": str(e)}

@api.get("/download")
async def download_file(filepath: str):
    """
    Permite descargar el archivo PDF o DOCX generado físicamente.
    """
    if os.path.exists(filepath):
        if filepath.endswith('.pdf'):
            return FileResponse(filepath, media_type='application/pdf', filename=os.path.basename(filepath))
        elif filepath.endswith('.docx'):
            return FileResponse(filepath, media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename=os.path.basename(filepath))
    return {"error": "File not found"}