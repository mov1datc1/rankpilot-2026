from typing import Annotated, List, Union, Dict
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    file_path: str
    doc_text: str
    # Historial de mensajes (para el chat dialéctico)
    messages: Annotated[list, add_messages]
    # Datos crudos extraídos del documento
    metadata: Dict[str, str] # firm_name, practice_area, etc.
    matters: List[Dict]       # Lista de casos detectados
    # Resultados del análisis de Fase 2
    analysis: Dict            # tier, confidence, dominant_model
    # Control de flujo
    latex_code: str  # Added to store the final LaTeX string
    confidence_score: float
    is_complete: bool
    pdf_url: str