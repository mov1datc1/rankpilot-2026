# Plan Estratégico: Arquitectura de Extracción en Dos Fases + AI Ingestion Auditor (Drafts Estructurados y Multi-Documentos Dispersos)
**Documento Técnico y Hoja de Ruta de Producto**  
**Fecha:** Septiembre 2026  
**Alineación Estratégica:** Acuerdos entre Jonathan Palacios y Ángela Castillo  
**Estado:** Arquitectura Integral Aprobada — En fase de implementación.

---

## 1. Contexto, Motivación y las Dos Arquetipos de Usuario

En la automatización de submissions legales para directorios de alto nivel (Chambers & Partners, The Legal 500, Leaders League, IFLR1000), la calidad del entregable final depende críticamente de la **pureza y fidelidad fáctica de los datos ingeridos** (*garbage in, garbage out*).

A partir de la sesión de trabajo estratégico con Ángela Castillo, se determinó con claridad que existen **dos perfiles de usuario completamente distintos** que RankPilot debe atender con la misma excelencia:

### 👤 Caso 1 — El Usuario con Borrador Estructurado (Draft User)
- **Situación:** El despacho ya cuenta con una versión preliminar de su submission, habitualmente redactada sobre la plantilla oficial de Chambers, The Legal 500 o Leaders League (en archivo `.docx`, `.doc` o texto copiado de tablas).
- **Características:** El documento ya tiene una estructura reconocible (Secciones A, B9, B10, D0/E0 y división explícita de asuntos como *"Matter 1"*, *"Matter 2"*, *"Published Matter"*, etc.).
- **Reto Técnico:** Extraer el 100% de los asuntos sin omitir ninguno por anomalías de formato (evitar saltos por celdas vacías o tuberías `|`), detectar discrepancias internas entre tablas y narrativas (ej. choque de divisas USD vs MXN en Cinemex), y clasificar la confidencialidad con precisión sin alterar los hechos.

### 👤 Caso 2 — El Usuario con Documentos Desconectados / Desde Cero (Multi-Doc / Scratch User)
- **Situación:** El despacho no tiene un borrador consolidado. La información del año está fragmentada en correos electrónicos de socios, notas de texto libres, presentaciones de credenciales (pitches), contratos o minutas en PDF, y fichas aisladas tipo *Matter Assistant*.
- **Características:** No existen encabezados estructurados de directorio ni numeración formal de asuntos. Varios archivos pueden hacer referencia a un mismo caso (ej. un correo con instrucciones preliminares y un PDF con la resolución judicial).
- **Reto Técnico:** Ingerir un corpus heterogéneo multi-archivo, identificar y agrupar semánticamente los hechos que pertenecen a cada mandato o cliente (*Mandate Clustering*), mapear los datos a los campos canónicos de Chambers, y señalar de inmediato los campos faltantes críticos sin inventar ni alucinar información.

---

## 2. La Regla de Oro de Ingestión: Extracción Verbatim Fiel vs. Optimización

> **Principio Fundacional de Jonathan Palacios & Ángela Castillo:**  
> *"La IA debe leer y comprender qué se quiere extraer y colocarlo con exactitud en cada campo correspondiente SIN todavía optimizarlo. Sin editar, cambiar, adornar o alucinar datos. Primero organizamos y validamos la verdad fáctica del despacho; la optimización literaria y estratégica se realiza después."*

Por esta razón, la arquitectura desacopla estrictamente dos etapas:
1. **Etapa 1 — Ingestión y Extracción Verbatim Fiel (Fase 2 del Builder):**  
   - Temperatura = 0.0.  
   - Extracción estructurada y fáctica directa a los campos de la base de datos (`client`, `matter_value`, `lead_partner`, `summary`, etc.).  
   - El campo `optimizedText` permanece **vacío (`""`)** hasta que el usuario decida optimizar.
2. **Etapa 2 — Optimización Estratégica con Pipeline LangGraph (15 Nodos):**  
   - Se ejecuta únicamente cuando el usuario ha validado sus datos base y hace clic en **"✨ Optimizar Todo el Submission con IA"**.

---

## 3. Arquitectura Dual de Extracción con IA

```
                   ┌────────────────────────────────────────────────────────┐
                   │               ENTRADA DE DATOS AL BUILDER              │
                   └───────────────────────────┬────────────────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
     ┌───────────────────────────────────┐           ┌───────────────────────────────────┐
     │      CASO 1: BORRADOR (DRAFT)     │           │   CASO 2: MULTI-DOC / DISPERSO    │
     │   (1 archivo DOCX/DOC de firma)   │           │ (Múltiples PDFs, DOCX, correos)   │
     └─────────────────┬─────────────────┘           └─────────────────┬─────────────────┘
                       │                                               │
                       ▼                                               ▼
     ┌───────────────────────────────────┐           ┌───────────────────────────────────┐
     │   FASE 1A: BOUNDARY SLICER        │           │ FASE 1B: MULTI-CORPUS NORMALIZER  │
     │ - Detección de cortes físicos por │           │ - Conversión de PDFs/DOCX/emails  │
     │   asuntos ("Matter 1", tablas)    │           │   a texto estructurado unificado  │
     │ - Segmentación en N chunks brutos │           │ - Conserva metadatos de archivo   │
     └─────────────────┬─────────────────┘           └─────────────────┬─────────────────┘
                       │                                               │
                       ▼                                               ▼
     ┌───────────────────────────────────┐           ┌───────────────────────────────────┐
     │ FASE 2A: EXTRACCIÓN VERBATIM      │           │ FASE 2B: CLUSTERIZACIÓN SEMÁNTICA │
     │ POR ASUNTO (LLM Temp=0.0)         │           │ Y EXTRACCIÓN DE MANDATOS (LLM)    │
     │ - Mapeo 1:1 de chunk a esquema    │           │ - Agrupación de hechos por cliente│
     │ - Extracción fáctica literal      │           │ - Detección de mandatos distintos │
     │ - CERO reescritura                │           │ - Mapeo a casillas Chambers       │
     └─────────────────┬─────────────────┘           └─────────────────┬─────────────────┘
                       │                                               │
                       └───────────────────────┬───────────────────────┘
                                               │
                                               ▼
                             ┌───────────────────────────────────┐
                             │ FASE 3: AI INGESTION AUDITOR      │
                             │ (Pre-Flight Integrity Agent)      │
                             │ --------------------------------- │
                             │ ✓ Discrepancias cambiarias (FX)   │
                             │ ✓ Confidencialidad sin confirmar  │
                             │ ✓ Vacíos críticos de información  │
                             │ ✓ Contradicciones entre fuentes   │
                             └─────────────────┬─────────────────┘
                                               │
                                               ▼
                             ┌───────────────────────────────────┐
                             │ FASE 4: WIZARD VALIDACIÓN PROGRES.│
                             │ (Modal paso a paso: 2-3 campos    │
                             │  Confirmar / Editar, Paso X de Y) │
                             └─────────────────┬─────────────────┘
                                               │
                                               ▼
                             ┌───────────────────────────────────┐
                             │ SUBMISSION STUDIO + EVIDENCE SCORE│
                             │ - Datos fácticos listos y claros  │
                             │ - Asunto Insignia (Hero Matter)   │
                             │ - Botón: "✨ Optimizar Todo"      │
                             └───────────────────────────────────┘
```

---

## 4. Detalle de Ejecución por Caso

### 4.1. Caso 1: Extracción de Borrador Existente (Draft)

1. **Fase 1A — Boundary Slicer Determinístico:**
   - La función `DocumentParser.extract_numbered_matter_sections` en Python identifica los encabezados oficiales de Chambers / Legal 500 (`Matter 1`, `Matter 2`, `Work Highlight`, `1. General Information`, etc.).
   - Genera una lista ordenada de $N$ bloques de texto crudo sin perder una sola línea o celda.
2. **Fase 2A — Extracción Verbatim por Asunto (LLM Temp=0.0):**
   - Cada fragmento es procesado concurrentemente mediante llamadas asíncronas con esquema Pydantic estricto:
     ```python
     class RawMatterExtraction(BaseModel):
         client_name: str = Field(description="Nombre literal del cliente. Si no se menciona o es anónimo, indicar 'Confidential Client'")
         is_confidential: str = Field(description="'confidential' | 'publishable' | 'confirmation_required'")
         matter_value: str = Field(description="Monto y divisa literal, ej. 'USD $50M' o 'MXN $60.5M'. Cadena vacía si no existe")
         narrative_value: str = Field(description="Monto mencionado dentro del texto narrativo, si difiere del campo principal")
         lead_partner: str = Field(description="Nombre del socio a cargo tal como aparece en el texto")
         other_lawyers: list[str] = Field(description="Lista de otros abogados participantes")
         summary_facts: str = Field(description="Texto íntegro literal de los hechos sin resumir ni embellecer")
         industry_sector: str = Field(description="Sector económico literal si se menciona")
     ```
   - **Garantía:** Se prohíbe taxativamente al LLM inventar valores o corregir faltantes. Si un campo no existe en el fragmento fuente, se retorna `""`.

### 4.2. Caso 2: Extracción desde Documentos Dispersos / Multi-Doc (Scratch)

1. **Fase 1B — Ingestor Multi-Fuente y Normalizador de Corpus:**
   - Recibe la lista de fuentes (`sources`): múltiples archivos `.docx`, `.pdf`, hilos de correo `.eml`/`.txt`, o texto pegado libremente.
   - Extrae el texto íntegro de cada archivo utilizando `DocumentParser.parse` (para DOCX/DOC) y extractores PDF robustos (PyMuPDF/pdfplumber).
   - Concatena los contenidos con delimitadores de origen:
     `=== INICIO FUENTE: [Contrato_Venta.pdf] === ... === FIN FUENTE ===`
2. **Fase 2B — Mandate Semantic Clustering & Extraction (LLM Temp=0.0):**
   - Debido a que los documentos no vienen divididos en "Matter 1, Matter 2", un micro-agente de clusterización semántica analiza el corpus consolidado para:
     a) Identificar los **mandatos o transacciones independientes** (agrupando, por ejemplo, el correo que discute la compra de una planta con el memorando que detalla el cierre de la transacción).
     b) Extraer la **información institucional** para el departamento (número de abogados detectados para B9 y contexto del despacho para B10 preliminar).
     c) Mapear cada mandato detectado al mismo esquema canónico `RawMatterExtraction`.
   - Si un documento aporta el cliente y los hechos, pero no contiene el monto ni los abogados participantes, el sistema extrae lo existente y marca los campos faltantes como `missing_fields: ["matter_value", "lead_partner"]`.

---

## 5. El "AI Ingestion Auditor": Validación Pre-Flight de Integridad

Tanto para el Caso 1 como para el Caso 2, los asuntos extraídos pasan por un agente de auditoría que evalúa la concordancia y los riesgos de directorio antes de mostrárselos al usuario:

| Tipo de Chequeo | Ejemplo Real Detectado | Acción del Auditor |
| :--- | :--- | :--- |
| **Conflicto de Divisa / Magnitud (FX)** | Caso Cinemex en DeForest: Tabla indica `USD $553,000`, narrativa dice `MXN $60,500,000`. | Genera bandera: `value_conflict: true` con nota explicativa para resolución en el Wizard. |
| **Confidencialidad No Confirmada** | Asuntos sin check expreso de publicación (10 asuntos en DeForest). | Asigna `confirmation_required` y añade bandera: `requires_confidentiality_review`. |
| **Contradicción Sectorial** | Caso GeNI: Clasificado como automotriz en tabla pero la narrativa describe streaming digital. | Genera bandera: `sector_mismatch`. |
| **Faltante de Campo Crítico** | Asunto sin socio líder o sin hechos suficientes (< 30 palabras). | Marca `missing_critical_fields` para advertencia visual prioritaria. |

---

## 6. Wizard de Validación Progresiva (UX Anti-Fricción)

Para erradicar la fricción de enfrentarse a más de 50 campos en una matriz densa y evitar que el usuario pulse "Optimizar Todo" a ciegas:

1. **Lanzamiento Inmediato:** Tras hacer clic en *"Construir"* en el Builder y completarse la extracción (< 25 seg), se abre un **Modal Flotante Enfocado**.
2. **Chunking Visual (2 a 3 campos por pantalla):**
   - **Paso 1:** Metadatos Institucionales (Firma, Práctica y Jurisdicción).
   - **Paso 2:** Departamento y B10 Preliminar (Conteo de abogados y narrativa institucional en borrador).
   - **Paso 3:** Roster de Abogados B9 (Socios y asociados extraídos con rol sugerido).
   - **Pasos 4 a $N$:** Validación de Asuntos Clave (1 o 2 asuntos por vista con su cliente, confidencialidad, monto y hechos extraídos).
3. **Botones de Decisión Inmediata:**
   - **`✓ Confirmar`**: Valida y avanza al siguiente paso en 1 clic.
   - **`✏️ Editar y Confirmar`**: Despliega inputs rápidos para corregir montos o nombres de inmediato.
   - **`Saltar validación e ir al Studio completo`**: Acceso directo para usuarios que prefieran la vista completa.
4. **Indicador de Progreso en Pie de Pantalla:** Barra de progreso con indicador textual inequívoco: **`Paso 1 de 8`**, **`Paso 2 de 8`**, etc.

---

## 7. Arquitectura Técnica de Implementación

### 7.1. Backend Python (`ai-engine`)
- **`ai-engine/agents/ingestion_auditor.py` (Nuevo):**
  - Implementa la extracción verbatim y la auditoría pre-flight con Pydantic.
  - Soporta modo `chunked_draft` (Caso 1) y modo `multi_corpus_cluster` (Caso 2).
- **`ai-engine/main.py`:**
  - Endpoint `/extract` adaptado para recibir tanto `source_url` (un solo archivo) como `sources` (lista de URLs multi-archivo).
  - Retorna `matters`, `department_overview`, `lawyers_roster` y `audit_flags`.

### 7.2. Backend Next.js (`src/app/api`)
- **`src/app/api/extract-document/route.ts`:**
  - Orquesta la llamada a `/extract` en Python.
  - Guarda en Prisma (`Submission`, `Matter`, `chambersData`) los datos fácticos limpios.
  - Persiste las advertencias de auditoría para renderizado en el Wizard.

### 7.3. Frontend (`src/app/builder` y componentes)
- **`src/app/builder/page.tsx`:**
  - Pantalla principal unificada con selector de modalidad (Borrador vs. Documentos Dispersos).
  - Wizard previo de 7 preguntas de calibración estratégica (Directorio, País, Región, Práctica, Banda, Objetivos).
  - Zona de carga adaptada (1 archivo para borrador; dropzone multi-archivo para dispersos).
  - Botón maestro *"Construir Submission"*.
- **`src/components/PostIngestionWizardModal.tsx`:**
  - Modal interactivo de validación progresiva (2-3 campos por vista, Confirmar / Editar, indicador de progreso inferior).
- **`src/components/SubmissionStudio.tsx`:**
  - Integración del modal al ingresar un nuevo submission y botón de reapertura *"Validar Datos Extraídos"*.
  - Indicador de Evidence Readiness y botón *"✨ Optimizar Todo el Submission con IA"*.

---

## 8. Criterios de Aceptación

- [ ] **Caso 1 (Draft):** Extracción del 100% de los 32 asuntos de DeForest Labour sin omitir ninguno y con detección precisa del conflicto FX de Cinemex.
- [ ] **Caso 2 (Multi-Doc):** Ingestión de 3+ archivos dispersos (PDFs, DOCX, correos) con clusterización correcta por cliente y detección de campos faltantes.
- [ ] **Pureza Fáctica:** En ambos casos, el campo `optimizedText` permanece en `""` durante la extracción. Cero invenciones de montos o clientes.
- [ ] **UX Anti-Fricción:** El Wizard de Validación Progresiva muestra 2-3 campos por vista con indicador claro `Paso X de Y` y opciones de confirmar / editar.
- [ ] **Rendimiento:** Tiempo total de extracción < 30 segundos para documentos de hasta 30 asuntos.
- [ ] **Regresión 100%:** Suite de tests pasando en Ramos Castillo (México), DeForest (México), Araquereyna (Venezuela) y Velasco (Colombia).
