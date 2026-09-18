# Plan Estratégico: Arquitectura de Extracción en Dos Fases + AI Ingestion Auditor
**Documento Técnico y Hoja de Ruta de Producto**  
**Fecha:** Septiembre 2026  
**Estado:** Propuesta Aprobada conceptualmente por Jonathan Palacios — En espera de retroalimentación de Ángela Castillo (DeForest / Araquereyna).

---

## 1. Contexto y Motivación

En la automatización de submissions legales para directorios como Chambers & Partners y Legal 500, la calidad del output final depende críticamente de la pureza de los datos ingeridos (*garbage in, garbage out*).

Históricamente se presentaron dos enfoques polares con sus respectivas fallas:

1. **Extracción 100% Determinística (Regex / Código Rígido):**
   - **Falla:** Los despachos no utilizan un formato único. Unos usan plantillas oficiales de Chambers con tablas, otros formularios tipo *Leaders League* (donde en una sola celda se concatenan campos con `|`), otros envían textos libres o PDFs. Las regexes tienden a romperse ante celdas vacías (tragándose encabezados del siguiente campo, como ocurrió con Schaeffler) o al asumir que campos en blanco significan datos públicos.
2. **Extracción 100% LLM en un solo prompt (Single-shot Generative):**
   - **Falla:** En documentos masivos (ej. DeForest con 32 asuntos y 15,000 palabras), los LLMs sufren del fenómeno *Lost in the Middle*, saltándose asuntos intermedios, inventando datos cuando una celda está vacía ("alucinación servicial"), o "limpiando" silenciosamente contradicciones de origen.

### La Intuición del Usuario (Jonathan Palacios)
> *"¿Por qué la IA no es capaz de leer y entender qué se quiere extraer y simplemente colocarlo en cada campo correspondiente sin todavía optimizarlo? Sin editar, cambiar, crear o alucinar... simplemente ver el doc de entrada y validar que la info, montos, etc. están bien."*

Esta intuición define la arquitectura óptima: **separar completamente la Ingestión Fiel Auditada del proceso de Optimización Narrativa**.

---

## 2. Estado Actual Inmediato (v26.43)

Previo a la implementación de este nuevo diseño, el sistema se estabilizó de raíz con el parche `6dc9d7f`:
- Corrección de regexes multilínea a `:[ \t]*([^\r\n]*)$` (evita tragar saltos de línea en celdas vacías).
- Detección agnóstica a tuberías `|` para formularios tipo *Leaders League*.
- Clasificación estricta de 3 estados de confidencialidad (`confidential`, `publishable`, `confirmation_required`).
- Detección de discrepancias de divisas y magnitud (ej. Cinemex USD $553k vs MXN $60.5M).
- 98/98 tests unitarios pasando en Python y 100% de la suite de regresión en TypeScript (Ramos Castillo, DeForest, Araquereyna).

**Acuerdo operativo:** Mantener esta versión activa y desplegada en producción para evaluar el feedback de Ángela Castillo sobre DeForest Labour y Araquereyna Tax.

---

## 3. Arquitectura Propuesta: *Two-Stage Faithful Extraction + AI Ingestion Auditor*

```
                    [ DOCUMENTO FUENTE: DOCX / DOC / PDF ]
                                      │
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │ FASE 1: CHUNKING DETERMINÍSTICO (Boundary Slicer) │
             └──────────────────────────────────────────────────┘
             - Código simple sin regexes semánticas.
             - Identifica límites de cada asunto ("Matter 1", "Matter 2", etc.).
             - Genera N fragmentos de texto crudo e inalterado.
                                      │
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │ FASE 2: EXTRACCIÓN VERBATIM POR ASUNTO CON IA    │
             │ (Temperature = 0.0 + Structured Output Pydantic) │
             └──────────────────────────────────────────────────┘
             - Prompt puro de extracción, CERO optimización / CERO redacción.
             - Extrae estrictamente campos literales:
               * client: texto exacto de la entidad
               * matter_value: monto y divisa literal (o "" si no hay)
               * confidentiality_status: 'confidential' | 'publishable' | 'confirmation_required'
               * lead_partner / team: nombres literales
               * raw_summary: texto íntegro sin resumir
                                      │
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │ FASE 3: EL "AI INGESTION AUDITOR" (Pre-Flight)   │
             │ (Micro-agente de validación: gpt-4o-mini / Haiku) │
             └──────────────────────────────────────────────────┘
             - Audita el JSON extraído contra el fragmento fuente:
               ✓ ¿Hay discrepancia entre el valor de tabla y la narrativa? (Caso Cinemex)
               ✓ ¿El cliente es un placeholder o entidad no identificada?
               ✓ ¿La confidencialidad quedó sin confirmación expresa?
               ✓ ¿Faltan datos críticos para Chambers?
                                      │
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │ FASE 4: UI DE REVISIÓN Y CONSUMO DEL OPTIMIZADOR  │
             └──────────────────────────────────────────────────┘
             - Guarda en BD Prisma (`Matter`, `chambersData.matters`).
             - Despliega tarjeta de integridad al usuario antes de procesar:
               "32 asuntos extraídos. 2 avisos: Cinemex (choque de divisas)
                y 10 asuntos con confidencialidad por confirmar."
             - El optimizador LangGraph recibe datos 100% limpios y auditados.
```

---

## 4. Ventajas Comparativas de la Nueva Arquitectura

| Dimensión | Enfoque Anterior | Nueva Arquitectura (2 Fases + AI Auditor) |
| :--- | :--- | :--- |
| **Resistencia a formatos desconocidos** | Baja / Media (requería parches por cada nuevo despacho) | **Total** (la IA comprende la semántica sin importar la disposición visual) |
| **Riesgo de pérdida de asuntos** | Presente si la regex fallaba en numeraciones raras | **Nulo** (Chunking por límites físicos garantiza N asuntos exactos) |
| **Riesgo de alucinación** | Nulo | **Nulo** (Temperature=0 + prompts que prohíben inferencias o completados) |
| **Detección de errores humanos en el source** | Limitada a reglas fijas | **Inteligente** (detecta contradicciones entre tablas y narrativas) |
| **Experiencia del usuario / Ángela** | Esperar 15 min de optimización para ver errores de origen | **Feedback inmediato en 20 segundos** al subir el archivo |

---

## 5. Estimación de Costos y Rendimiento

- **Llamadas a API:** 
  - 1 llamada de extracción por cada asunto en paralelo (ej. 32 llamadas con `gpt-4o-mini` o `claude-3-5-haiku`).
  - 1 llamada para el consolidado de auditoría.
- **Costo por documento:** ~$0.10 a $0.25 USD por subida completa de 30 asuntos.
- **Latencia:** 15 a 25 segundos en total (ejecución concurrente de chunks con `asyncio.gather`).

---

## 6. Plan de Implementación Técnica (Cuando se dé la orden)

### Archivos a intervenir:
1. `ai-engine/utils/doc_parser.py`:
   - Simplificar `extract_numbered_matter_sections` para enfocarse exclusivamente en cortar los textos por asunto (*clean boundary segmentation*).
2. `ai-engine/agents/ingestion_auditor.py` (Nuevo):
   - Definir esquema Pydantic `RawMatterExtraction` y `IngestionAuditReport`.
   - Implementar función asíncrona de extracción y auditoría cruzada (JSON vs fuente).
3. `ai-engine/main.py`:
   - Actualizar el endpoint `/extract` para orquestar la extracción en dos pasos y retornar las banderas de auditoría.
4. `src/app/api/extract-document/route.ts`:
   - Persistir las banderas de advertencia estructuradas (`valueConflict`, `confidentialityUnconfirmed`, `missingFields`) para consumo directo de la UI en Next.js.
5. UI / Dynamic Studio (`src/app/builder/page.tsx` o similar):
   - Modal o banner de "Resumen de Ingestión" antes de habilitar el botón de optimización completa.

---

## 7. Criterios de Aceptación para el Pase a Producción

- [ ] Extracción idéntica del 100% de los 32 asuntos en DeForest Labour (cero asuntos omitidos o duplicados).
- [ ] Detección automática y precisa del conflicto FX de Cinemex sin intervención humana.
- [ ] Detección y clasificación automática de los 10 asuntos no confirmados de DeForest.
- [ ] Cero alucinaciones en campos vacíos (respetar `""` cuando el source no aporte valor).
- [ ] Tiempo de extracción total < 30 segundos por documento de 30 asuntos.
- [ ] Suite de regresión pasando al 100% en Ramos Castillo (Chambers México) y Araquereyna (Chambers Venezuela).
