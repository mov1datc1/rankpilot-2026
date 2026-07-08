import os
import uuid
from fastapi import FastAPI, Request
from core.graph import app as graph_app 
from langchain_core.messages import HumanMessage

# 1. Instancia de la API para comunicación con el Backend (Laravel)
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
    # Configuración de persistencia y contexto de sesión
    config = {"configurable": {"thread_id": thread_id}}
    
    # Determinación del punto de entrada al grafo
    if is_file:
        initial_state = {"file_path": user_input, "messages": []}
        output = graph_app.invoke(initial_state, config)
    else:
        output = graph_app.invoke(
            {"messages": [HumanMessage(content=user_input)]}, 
            config
        )
    
    # Resolución de activos generados (PDFs)
    if output.get("is_complete"):
        raw_path = output.get("pdf_url")
        if raw_path and os.path.exists(raw_path):
            # Convertimos a path absoluto para garantizar acceso desde el backend
            output["pdf_url"] = os.path.abspath(raw_path)
            
    return output

# 2. Endpoint de Procesamiento Sincrónico
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
    
    # Ejecución del núcleo de IA
    result = run_rankpilot(user_input, thread_id, is_file)
    
    # Respuesta estandarizada para el cliente API
    return {
        "status": "completed" if result.get("is_complete") else "interrogating",
        "thread_id": thread_id,
        "data": {
            "pdf_url": result.get("pdf_url"),
            "is_complete": result.get("is_complete", False),
            "response": result["messages"][-1].content if result.get("messages") else "No response generated."
        }
    }