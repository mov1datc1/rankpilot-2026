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

from core.state import AgentState
from agents.prompts import ( 
    STRATEGIC_ANALYSIS_PROMPT, 
    EDITORIAL_INTERROGATOR_PROMPT,
    LATEX_WRITER_PROMPT
)
from utils.pdf_generator import compile_latex_to_pdf

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
    else:
        data_dict = structured_data # Ya es un dict

    # Sincronizamos con las llaves exactas de state.py
    return {
        "metadata": {
            "firm_name": data_dict.get("firm_name"),
            "practice_area": data_dict.get("practice_area"),
            "location": data_dict.get("location"),
            "narrative": data_dict.get("narrative_overview")
        },
        "matters": data_dict.get("matters", []),
        "current_step": "analysis"
    }
# 3. ANALYSIS NODE
def analysis_node(state: AgentState) -> Dict:
    llm = get_model()
    
    # Preparamos los datos para el analista
    input_data = {
    "metadata": state.get("metadata", {}),
    "matters": state.get("matters", [])
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
            "confidence_score": float(res_json.get("confidence_score", 0))
        }
    except:
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

# 5. WRITER NODE
def writer_node(state: AgentState, config: RunnableConfig) -> Dict:
    """
    Generates a professional LaTeX report and compiles it to PDF.
    Aligned with IBM-grade error handling and state management.
    """
# 1. EXTRAER EL ID DE LA CONVERSACIÓN
    # Accedemos a la configuración para obtener el identificador único del hilo
    thread_id = config.get("configurable", {}).get("thread_id", "UNKNOWN")

    # 2. CREAR EL IDENTIFICADOR DEL REPORTE
    # Usamos el thread_id + la fecha para el nombre del archivo
    date_str = datetime.now().strftime('%Y%m%d')
    report_id = f"RP-{thread_id}-{date_str}"
    # 1. INITIALIZATION & DATA NORMALIZATION
    # Recuperamos el modelo configurado en tu archivo de nodos
    llm = get_model() 
    
    # Sincronizamos con las llaves reales de tu AgentState
    metadata = state.get("metadata", {})
    matters = state.get("matters", [])
    analysis_results = state.get("analysis", {})

    structured_data = {
        "firm_metadata": metadata,
        "matters": matters
    }

    # Valores por defecto para evitar que el string interpolation falle
    firm_name = metadata.get('firm_name', 'Professional Law Firm')
    practice_area = metadata.get('practice_area', 'General Practice')
    
    # 2. LATEX ARCHITECTURE: PREAMBLE & FRONT PAGE
    # Usamos f-strings para limpieza, pero escapamos las llaves de LaTeX {{ }}
    PREAMBLE_AND_FRONT_PAGE = r"""
    \documentclass[11pt,a4paper]{article}
    \usepackage[utf8]{inputenc}
    \usepackage[margin=1in]{geometry}
    \usepackage{xcolor}
    \usepackage{titlesec}
    \usepackage{tcolorbox}
    \usepackage{tikz}
    \usepackage{helvet}
    \renewcommand{\familydefault}{\sfdefault}
    \usepackage{fancyhdr}
    \pagestyle{fancy}
    \fancyhf{}
    \renewcommand{\headrulewidth}{0pt}
    \fancyfoot[L]{\color{gray}\small """ + firm_name + r""" | Confidential}
    \fancyfoot[R]{\color{gray}\small Page \thepage}

    \definecolor{brandnavy}{HTML}{1A237E}
    \definecolor{lightgray}{HTML}{F5F5F5}

    \begin{document}

    \begin{titlepage}
        \begin{tikzpicture}[remember picture,overlay]
            \fill[brandnavy] (current page.north west) rectangle ([yshift=-8cm]current page.north east);
        \end{tikzpicture}
        
        \vspace*{1cm}
        \begin{center}
            \color{white}
            {\huge \textbf{RANKPILOT INTELLIGENCE}} \\[0.5cm]
            {\Large \textbf{STRATEGIC DIAGNOSTIC SNAPSHOT™}} \\[2.5cm]
            
            \begin{tcolorbox}[colback=white, colframe=brandnavy, arc=5pt, width=0.8\textwidth, center]
                \centering
                \color{brandnavy}
                \vspace{0.3cm}
                {\Large \textbf{FIRM: """ + firm_name + r"""}} \\[0.4cm]
                {\large Practice Area: """ + practice_area + r"""}
                \vspace{0.3cm}
            \end{tcolorbox}
        \end{center}
        
        \vfill
        \begin{center}
            \color{brandnavy}
            \textbf{CONFIDENTIAL STRATEGIC ASSESSMENT} \\
            \small Generated on: \today
        \end{center}
    \end{titlepage}
    \newpage
    """

    CONTENT_HEADER = r"""
    \begin{center}
        {\color{brandnavy}\rule{\linewidth}{2pt}} \\
        \vspace{0.2cm}
        {\Large \textbf{""" + firm_name + r"""}} \\
        {\large \textit{Diagnostic Report | """ + practice_area + r"""}} \\
        \vspace{0.1cm}
        {\color{brandnavy}\rule{\linewidth}{0.8pt}}
    \end{center}
    \vspace{0.5cm}
    """

    # 3. AI GENERATION (The "Dynamic" Body)
    prompt = ChatPromptTemplate.from_messages([
        ("system", LATEX_WRITER_PROMPT),
        ("human", "Generate the report using this Data: {data} and this Analysis: {analysis}")
    ])
    
    chain = prompt | llm
    # Enviamos los datos reales al LLM
    response = chain.invoke({
        "data": json.dumps(structured_data, indent=2), # Esto llena {data}
        "analysis": json.dumps(analysis_results, indent=2) # Esto llena {analysis}
    })
    
    content = response.content.replace("```latex", "").replace("```", "").strip()
    
    # Sanitización: Evitar duplicación de preámbulos si el LLM se excede
    if r"\begin{document}" in content:
        content = content.split(r"\begin{document}")[1]
    if r"\end{document}" in content:
        content = content.split(r"\end{document}")[0]

    # 4. FINAL ASSEMBLY & COMPILATION
    final_latex = PREAMBLE_AND_FRONT_PAGE + CONTENT_HEADER + content + r"\end{document}"

    # Creamos el nombre del archivo sanitizado
    safe_name = state.get("metadata", {}).get('firm_name', 'Firm').replace(" ", "_").replace("/", "-")
    
    try:
        # 1. Generamos el nombre del archivo
        filename_to_save = f"report_{safe_name}_{report_id}"
        
        # 2. Llamada a la utilidad (Asegúrate de que devuelva el string de la ruta)
        generated_path = compile_latex_to_pdf(final_latex, filename_to_save)
        
        # DEBUG LOCAL: Si esto imprime None, el fallo está dentro de compile_latex_to_pdf
        print(f"DEBUG NODES: Path generado es -> {generated_path}")

        # 3. Retorno explícito al AgentState
        return {
            "latex_code": final_latex,
            "pdf_url": str(generated_path) if generated_path else f"outputs/{filename_to_save}.pdf",
            "is_complete": True
        }
    except Exception as e:
        print(f"Error en compilación: {e}")
        return {"is_complete": False, "messages": [("assistant", "Fallo la generación del PDF.")]}