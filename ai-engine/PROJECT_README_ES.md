# RankPilot Core

**Un sistema multiagente impulsado por IA para el análisis de documentos de firmas legales, extracción de datos estructurados y generación automatizada de informes.**

---

## 1. VISIÓN GENERAL DEL PROYECTO

RankPilot Core es un canal de procesamiento de documentos orquestado construido sobre **LangGraph** que automatiza el análisis de presentaciones de práctica de firmas legales. El sistema ingiere documentos PDF o DOCX, extrae metadatos estructurados y detalles de asuntos utilizando una cadena de extracción impulsada por GPT-4o, realiza análisis estratégico con puntuación de confianza y, de forma condicional, participa en un bucle de interrogación al usuario para resolver ambigüedades antes de generar un informe final LaTeX/PDF. Está diseñado para flujos de trabajo legales de alta fiabilidad donde la salida estructurada y la capacidad de auditoría son primordiales.

---

## 2. ARQUITECTURA Y DISEÑO

### Patrones Centrales
- **Flujo de Máquina de Estados**: El sistema se modela como un grafo acíclico dirigido (con un bucle controlado) usando `StateGraph` de LangGraph. Cada nodo representa un paso de procesamiento atómico (ingestión, extracción, análisis, interrogación, redacción) que muta un `AgentState` compartido.
- **Patrón Agente-como-Nodo**: Cada etapa del canal se implementa como una función de nodo independiente (`ingestion_node`, `extraction_node`, etc.), promoviendo modularidad, capacidad de prueba y responsabilidad aislada.
- **Enrutamiento Impulsado por Confianza**: Después del análisis, una `confidence_score` (0-100) determina el flujo: puntuaciones ≥65% proceden directamente a la generación de informes; puntuaciones <65% activan un `interrogator_node` para solicitar aclaraciones al usuario antes de volver a analizar.
- **Contrato de Salida Estructurada**: La extracción de datos y la generación final de informes se basan en **esquemas Pydantic** (`SubmissionSchema`) aplicados mediante `with_structured_output` de LangChain, garantizando conformidad JSON.
- **Persistencia mediante Puntos de Control de Hilos**: El estado se persiste entre turnos conversacionales usando `MemorySaver` con un `thread_id` (simulando aislamiento de sesión), permitiendo interacciones multi-turno en un solo caso.
- **Separación de Preocupaciones**: Las utilidades para análisis de documentos (`doc_parser`), compilación LaTeX (`pdf_generator`) y gestión de prompts (`prompts`) están desacopladas de la lógica central del grafo.

### Flujo de Datos
1. **Ingestión**: Archivo sin procesar → texto plano.
2. **Extracción**: Texto no estructurado → `SubmissionSchema` estructurado (firma, asuntos, narrativa).
3. **Análisis**: Evaluación estratégica + cálculo de confianza.
4. **Rama Condicional**: Alta confianza → Redacción; Baja confianza → Interrogación → Bucle de re-análisis.
5. **Generación**: Compilación LaTeX → PDF.

---

## 3. GUÍA DE DIRECTORIOS

```
rankpilot-core/
├── main.py                          # Punto de entrada: `run_rankpilot()` maneja flujos duales (archivo vs. mensaje)
├── agents/
│   ├── nodes.py                     # Implementaciones de nodos para cada etapa del canal
│   └── prompts.py                   # Plantillas de prompts del sistema centralizadas (extracción, análisis, editorial)
├── chains/
│   └── extraction_chain.py          # Fábrica para la cadena de extracción estructurada (LLM + esquema)
├── core/
│   ├── graph.py                     # `create_rankpilot_graph()`: ensambla y compila la máquina de estados de LangGraph
│   ├── schema.py                    # Modelos Pydantic: `Matter`, `SubmissionSchema`
│   └── state.py                     # Definición de TypedDict `AgentState`
├── Documentation_set/               # (Recursos de documentación del proyecto)
├── templates/                       # (Archivos de plantilla LaTeX para la generación de informes)
├── utils/
│   ├── doc_parser.py                # Utilidad de extracción de texto de PDF/DOCX
│   └── pdf_generator.py             # Envoltorio del compilador LaTeX → PDF (requiere pdflatex)
└── requirements.txt                 # (Hipotético: dependencias de Python)
```

---

## 4. TABLA DE COMPONENTES

| Módulo | Responsabilidad | Características Clave |
|--------|----------------|---------------------|
| `doc_parser.py` | Extracción de texto de documentos multi-formato | Soporta PDF (PyMuPDF) y DOCX; unión de celdas de tabla; filtrado de párrafos vacíos |
| `extraction_chain.py` | Extracción de datos estructurados del texto | LLM configurable (predeterminado `gpt-4o`); temperatura cero; aplicación de esquema Pydantic |
| `graph.py` | Orquestación LangGraph | Enrutamiento condicional por confianza; borde de retroceso; puntos de control `MemorySaver` |
| `main.py` | API pública y coordinación de flujo | Controlador de modo dual (ingestión de archivo vs. conversacional); continuidad de estado basada en hilos |
| `nodes.py` | Implementaciones de etapas del canal | Cinco nodos: ingestión, extracción, análisis, interrogación, redacción; lógica de mutación de estado |
| `pdf_generator.py` | Renderizado LaTeX | Ejecución en dos pasos de `pdflatex`; manejo de archivos temporales; señalización de éxito/fallo |
| `prompts.py` | Gestión de prompts | Prompts del sistema centralizados para extracción, análisis y personalidad editorial |
| `schema.py` | Definición de contrato de datos | Modelos Pydantic para metadatos de firma, asuntos y estructura completa de la presentación |
| `state.py` | Definición de esquema de estado | TypedDict con campos: `messages`, `submission`, `analysis`, `confidence_score`, `questions`, `latex_code` |

---

## 5. PRIMEROS PASOS

### Prerrequisitos
- **Python 3.10+**
- **Sistema LaTeX**: `pdflatex` debe estar instalado y en `PATH` (ej. TeX Live, MacTeX, MiKTeX).
- **Clave API de OpenAI**: Establecer la variable de entorno `OPENAI_API_KEY`.

### Instalación
```bash
# 1. Clonar repositorio
git clone <repository-url>
cd rankpilot-core

# 2. Crear entorno virtual
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# 3. Instalar dependencias
pip install -r requirements.txt
# Dependencias típicas: langchain, langgraph, openai, pymupdf, python-docx, pydantic

# 4. Verificar instalación de LaTeX
pdflatex --version
```

### Uso
```python
from main import run_rankpilot

# Caso inicial: ingestión de un archivo de documento
result = run_rankpilot(
    user_input="/ruta/a/presentacion.pdf",
    thread_id="caso_123",
    is_file=True
)

# Turnos conversacionales posteriores
response = run_rankpilot(
    user_input="La firma tiene 15 años de experiencia en derecho marítimo.",
    thread_id="caso_123",
    is_file=False
)
```

---

**Requisitos del Sistema**:  ```
- SO: Linux/macOS/Windows con soporte LaTeX.  
- Red: Acceso saliente a la API de OpenAI.  
- Memoria: ~2GB+ para procesamiento de LLM y compilación LaTeX.  

**Configuración**:  
Los nombres de modelo (ej. `gpt-4o`) están parametrizados en `extraction_chain.py` y `nodes.py`; modifíquelos según sea necesario para equilibrar costo/rendimiento.

---

*Para profundizar en la arquitectura, consulte `core/graph.py` (flujo de trabajo) y `agents/nodes.py` (lógica de nodos).*

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
  "thread_id": "submission_uuid_999", 
  "file_path": "/path/to/firm/storage/submission.docx",
  "metadata": {
    "firm_id": "101",
    "requested_by": "System_Admin"
  }
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