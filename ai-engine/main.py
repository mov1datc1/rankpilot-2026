import os
import uuid
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from core.graph import app as graph_app 
from langchain_core.messages import HumanMessage
from agents.nodes import writer_node

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
async def process_request(request: Request):
    """
    Recibe JSON con user_input, thread_id e is_file.
    Retorna el estado de la generación y el link al recurso si está listo.
    """
    data = await request.json()
    
    user_input = data.get("user_input")
    thread_id = data.get("thread_id", str(uuid.uuid4()))
    is_file = data.get("is_file", False)
    
    result = run_rankpilot(user_input, thread_id, is_file)
    
    return {
        "status": "completed" if result.get("is_complete") else "interrogating",
        "thread_id": thread_id,
        "data": {
            "pdf_url": result.get("pdf_url"),
            "is_complete": result.get("is_complete", False),
            "response": result["messages"][-1].content if result.get("messages") else "No response generated."
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

@api.get("/download")
async def download_pdf(filepath: str):
    """
    Permite descargar el archivo PDF generado físicamente.
    """
    if os.path.exists(filepath) and filepath.endswith('.pdf'):
        return FileResponse(filepath, media_type='application/pdf', filename=os.path.basename(filepath))
    return {"error": "File not found"}