import os
import uuid
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from core.graph import app as graph_app 
from langchain_core.messages import HumanMessage
from agents.nodes import writer_node
from utils.docx_generator import generate_docx_report

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
    data = await request.json()
    user_input = data.get("user_input")
    thread_id = data.get("thread_id")
    is_file = data.get("is_file", False)
    context = data.get("context", {})

    if not user_input or not thread_id:
        return {"error": "Missing user_input or thread_id"}

    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "file_path": user_input if is_file else "",
        "doc_text": user_input if not is_file else "",
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
        "evidence_map": {},
        "reasoning_trace": [],
        "current_step": "ingestion",
    }
    
    try:
        result = graph_app.invoke(initial_state, config)
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print("ERROR IN LANGGRAPH:")
        print(error_msg)
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=500, content={"error": "LangGraph execution failed", "traceback": error_msg})
    
    # Safely extract the last message text
    messages = result.get("messages", [])
    response_text = "No response generated."
    if messages:
        last_msg = messages[-1]
        if hasattr(last_msg, "content"):
            response_text = last_msg.content
        elif isinstance(last_msg, tuple) and len(last_msg) > 1:
            response_text = str(last_msg[1])
        else:
            response_text = str(last_msg)
    
    return {
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
            "reasoning_trace": result.get("reasoning_trace", []),
        }
    }

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