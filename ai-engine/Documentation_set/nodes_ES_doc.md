## Descripción general
Este archivo implementa un *pipeline* con estado y basado en nodos para procesar documentos de bufetes de abogados. Orquesta un flujo de trabajo desde la ingesta del documento hasta la extracción de datos, análisis estratégico, interrogación opcional al usuario y generación final de informes LaTeX/PDF. Cada nodo actualiza un diccionario `AgentState` compartido para avanzar en el flujo de trabajo.

## Clases
Ninguna

## Funciones y Métodos
| Nombre | Parámetros | Responsabilidad |
|------|------------|----------------|
| `ingestion_node` | `state: AgentState` | Analiza un archivo de documento a texto plano, valida la existencia de la ruta del archivo y cambia el estado al paso de extracción. |
| `extraction_node` | `state: AgentState` | Invoca una cadena de extracción resistente para convertir texto sin procesar en datos JSON estructurados (metadatos de la firma, asuntos, narrativa). |
| `analysis_node` | `state: AgentState` | Realiza un análisis estratégico de alto nivel usando GPT-4o, calcula una puntuación de confianza y enruta hacia la generación de informes o la interrogación al usuario según un umbral (≥65%). |
| `interrogator_node` | `state: AgentState` | Genera preguntas para el usuario conscientes del contexto para abordar lagunas en el análisis usando una persona Editorial, luego pausa el flujo de trabajo para la entrada del usuario. |
| `writer_node` | `state: dict` | Construye un documento LaTeX con una portada estandarizada y contenido generado por IA, luego lo compila a un archivo PDF. |