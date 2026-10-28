# 📜 Owner's Editorial Constitution — Single Source of Truth

> **Propósito**: Este documento consolida TODAS las reglas que el owner ha dado en TODOS los feedbacks. Es el documento único para validar cualquier output de RankPilot. Si una regla no está aquí, no existe.
> 
> **Última actualización**: 13 Agosto 2026  
> **Feedbacks incorporados**: Pre-v17, v17 (7 obs), v18 (12 obs), v18.5 (B7/B10 feedback), v20.0 (6 bugs), v20.1 (6 fixes)

---

## A. REGLAS CONSTITUCIONALES (Sistema Completo)

### A1. RankPilot evalúa SUBMISSIONS, no firmas
- **Origen**: Owner feedback pre-v17, reforzado en v17-OBS4
- **Regla**: Nunca decir "the firm lacks..." Solo "the submission does not yet demonstrate..."
- **Status**: ✅ Implementado — `EDITORIAL_CONSTITUTION` Art. I-II + `EPISTEMIC_GUARDRAILS`
- **Código**: [prompts.py L21-53](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/prompts.py#L21-L53)

### A2. Ausencia de evidencia ≠ evidencia de ausencia
- **Origen**: Owner feedback pre-v17, constitucional
- **Regla**: Si el submission no menciona algo, NO significa que la firma no lo tiene
- **Status**: ✅ Implementado — Art. II + guardrails
- **Código**: [prompts.py L59-92](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/prompts.py#L59-L92)

### A3. External Validation NO se evalúa
- **Origen**: Owner v17-OBS1 (RC-5)
- **Regla**: Referees, testimonials, endorsements están FUERA del scope. Si no hay referees, esa dimensión NO EXISTE.
- **Status**: ✅ Implementado
- **Código**: [prompts.py L167-179](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/prompts.py#L167-L179)

### A4. Cross-border respetar `cross_border_relevant`
- **Origen**: Owner v17-OBS6
- **Regla**: Si la práctica no tiene componente cross-border (ej: Data Protection México), NUNCA mencionarlo. 3-layer defense.
- **Status**: ✅ Implementado — L1 system prompt injection + L2 post-validator + L3 validation gate
- **Código**: [nodes.py L1092-1144](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py#L1092-L1144)

### A5. NO dar recomendaciones de negocio
- **Origen**: Owner v17-OBS3 + OBS5
- **Regla**: RankPilot es editor, no consultor. Jerarquía: (1) Editorial improvements, (2) Structural improvements, (3) Information mining, (4) Targeted questions, (5) Business recommendations (último recurso)
- **Status**: ✅ Implementado
- **Código**: [prompts.py L940-951](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/prompts.py#L940-L951)

### A6. La arquitectura interna es INVISIBLE
- **Origen**: Owner v18-OBS3
- **Regla**: "Competitive Identity", "Hero Matter", "Narrative Arc", "Supporting Matters" son para que RankPilot PIENSE. El researcher de Chambers debe sentir la narrativa, no ver el andamiaje.
- **Status**: ✅ Implementado v18.5b — Headers renombrados
- **Código**: [route.ts L377-413](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/src/app/api/generate-docx/route.ts#L377-L413)

### A7. Frases genéricas PROHIBIDAS (hard block)
- **Origen**: Owner v17-OBS7, reforzado en v18-OBS7 y v18.5
- **Lista completa**:
  - Token-banned (logit_bias -100): `pivotal`, `seamlessly`, `meticulously`, `beacon`, `testament`, `cornerstone`, `holistic`, `paramount`, `underscores`
  - Prompt-banned: `robust framework`, `comprehensive advice`, `navigate complex`, `strategic advisory role`, `widely recognised`, `particularly recognised`, `distinguished`, `carved out a niche`, `at the forefront`, `exemplifies`, `instrumental in`
  - Post-process stripped: 31 regex patterns en `strip_fillers()`
- **Status**: ✅ Implementado — 3-layer defense
- **Código**: [nodes.py get_model()](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py) (logit_bias), [prompts.py](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/prompts.py) (prompt), [nodes.py strip_fillers()](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py) (regex)

---

## B. REGLAS DE B7 ("What is this department best known for?")

### B1. B7 = PROPOSICIÓN ESTRATÉGICA, matters = EVIDENCIA
- **Origen**: Owner v18-OBS10, reforzado v18.5
- **Regla**: B7 no es una lista de clientes ni un dump de matters. Es la proposición de por qué esta práctica merece reconocimiento. Los matters son la prueba.
- **Status**: ✅ Implementado v18.5
- **Código**: [nodes.py L2328-2400](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py#L2328-L2400)

### B2. Densidad estratégica > volumen de palabras
- **Origen**: Owner v18.5 feedback directo: "The objective is NOT to produce more words but more STRATEGIC DENSITY per word"
- **Regla**: 400 palabras de alta densidad > 500 palabras con relleno. No inflar.
- **Status**: ✅ Implementado v18.5
- **Código**: [nodes.py B7 prompt](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py#L2328-L2400)

### B3. INTERPRETAR la práctica, no DECORARLA
- **Origen**: Owner v18.5 — "GPT-5.6 me gusta porque INTERPRETA la práctica"
- **Regla**: Explicar POR QUÉ privacy funciona como operational/governance issue, no solo decir que lo hace. Usar "the team positions privacy as an operational and governance issue that affects..." NO "the practice is widely recognised for..."
- **Status**: ✅ Implementado v18.5 — System message: "editorial analyst who reveals why a practice is differentiated"
- **Código**: [nodes.py system message](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py#L2396-L2400)

### B4. 2-3 client names como EJEMPLOS de patrones
- **Origen**: Owner v18-OBS10, v18.5
- **Regla**: No listar 7 clientes. Usar 2-3 como EJEMPLOS que ilustren patterns (governance integration, recurring advisory, sector diversity).
- **Status**: ✅ Implementado v18.5
- **Código**: [nodes.py B7 prompt](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py#L2340-L2380)

### B5. Preservar la tesis del original
- **Origen**: Owner v18-OBS1 + OBS2
- **Regla**: "Correct diagnosis does not automatically justify rewriting." Si el original tiene una tesis fuerte ("data protection integrated into governance"), PRESERVARLA. Reescribir solo donde agrega valor medible.
- **Status**: ✅ Implementado v18.5 — "preserve its strategic thesis — this is YOUR BASE"
- **Código**: [nodes.py B7 prompt](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py#L2328-L2335)

### B6. Nunca shorter que el original
- **Origen**: Owner v17-OBS7
- **Regla**: B7 output MUST be ≥ original word count AND ≤ 500 words (Chambers hard limit)
- **Status**: ✅ Implementado
- **Código**: [nodes.py B7 prompt word count rules](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py#L2375-L2380)

### B7. Mencionar lead partner BY NAME
- **Origen**: Owner v18.4 (partner visibility)
- **Regla**: B7 debe abrir o incluir "Led by [Name], the practice..."
- **Status**: ✅ Implementado v18.4+
- **Código**: [nodes.py dept_heads extraction](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py#L2265-L2290)

### B8. Cada claim del B7 debe ser rastreable a evidencia en matters
- **Origen**: Owner v18-OBS10
- **Regla**: "Every material positioning claim in B7 should be traceable to evidence contained in the submitted matters."
- **Status**: ⚠️ PARCIAL — El prompt lo pide pero no hay verificación programática post-LLM
- **Acción pendiente**: Verificador automático B7↔matters (futuro)

---

## C. REGLAS DE MATTERS (Optimización de Casos)

### C1. KEEP → EXPAND → STRENGTHEN — nunca resumir
- **Origen**: Owner v17-OBS7, constitucional
- **Regla**: "RankPilot does not summarize. It takes existing evidence and makes it MORE CONVINCING." Output siempre ≥ original word count.
- **Status**: ✅ Implementado — Re-optimization si ratio < 0.75
- **Código**: [prompts.py L1094-1100](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/prompts.py#L1094-L1100), [nodes.py optimization_node](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py#L2002-L2180)

### C2. Cada matter ABRE con WHY, no con mandate genérico
- **Origen**: Owner v18-OBS6
- **Regla**: ❌ "[Client] instructed the firm to implement a framework." → ✅ "The firm has defended the viability of databases as critical business assets." Abrir con significancia estratégica.
- **Status**: ✅ Implementado v18.5b
- **Código**: [prompts.py MATTER NARRATIVE STRUCTURE](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/prompts.py#L1179-L1230)

### C3. Anti-homogenización — cada matter cuenta historia DIFERENTE
- **Origen**: Owner v18-OBS5
- **Regla**: "Competitive Identity should unify the portfolio without flattening matter-level differentiation." Si 3 matters abren con "design and implement a framework", FALLASTE. Pharma=sensitive data, retail=scaling, industrial=risk management, litigation=database defence, restructuring=org change.
- **Status**: ✅ Implementado v18.5b
- **Código**: [prompts.py ANTI-HOMOGENIZATION RULE](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/prompts.py#L1209-L1230)

### C4. Evidence strength tiers: Strong > Moderate > Weak
- **Origen**: Owner v18-OBS7
- **Regla**: 
  - **Strong**: Quantified/verifiable → "100% ARCO compliance, zero sanctions"
  - **Moderate**: Concrete institutional change → "established a Data Protection Department"
  - **Weak (EVITAR)**: Generic benefit → "strengthened compliance posture", "reduced regulatory exposure"
  - Si solo puedes escribir WEAK, escribe MODERATE describiendo el cambio concreto. NUNCA manufactures métricas.
- **Status**: ✅ Implementado v18.5b en prompt + Evidence Strengthening Requests en audit
- **Código**: [prompts.py EVIDENCE STRENGTH](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/prompts.py#L1197-L1208), [route.ts §6b](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/src/app/api/generate-docx/route.ts#L532-L585)

### C5. Client descriptor verbatim — NUNCA reemplazar
- **Origen**: Owner v17.5.2
- **Regla**: "Grupo Excelsior, one of Mexico's leading dairy producers" → COPIAR EXACTO y luego AGREGAR contexto. NUNCA reemplazar con "a prominent client."
- **Status**: ✅ Implementado — 4th layer `verify_client_descriptors()`
- **Código**: [nodes.py verify_client_descriptors()](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py) + [prompts.py L1147-1162](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/prompts.py#L1147-L1162)

### C6. Proteger riqueza del original — NUNCA condensar evidencia
- **Origen**: Owner v18-OBS11
- **Regla**: "Never reduce evidentiary richness in pursuit of narrative clarity." Se puede condensar palabras pero NO evidencia. "16 years", "100% ARCO", "department creation", "store openings" — cada pieza es competitiva.
- **Status**: ✅ Implementado — Rule 103 probative shield + entity-loss detection
- **Código**: [nodes.py optimization_node re-optimization logic](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py#L2050-L2145)

### C7. Hero Matter EVALUADO por scoring, no por orden
- **Origen**: Owner v18-OBS9
- **Regla**: El primer matter del documento NO es automáticamente el hero. Evaluar: sophistication + significance + differentiation + evidence + client profile + recency + relevance.
- **Status**: ✅ Implementado — `submission_blueprint_node` scoring
- **Código**: [editorial_nodes.py L857-943](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/editorial_nodes.py#L857-L943)

### C8. Nunca inventar sofisticación — pedir información
- **Origen**: Owner v18-OBS8
- **Regla**: Si un claim carece de evidencia cuantificable, generar un INFORMATION REQUEST en vez de manufacturar prose más fuerte. "When a strategically valuable claim lacks supporting evidence, RankPilot should generate an information request."
- **Status**: ✅ Implementado v18.5b — "Evidence Strengthening Requests" section en audit
- **Código**: [route.ts §6b](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/src/app/api/generate-docx/route.ts#L532-L585)

### C9. Descubrir la narrativa MÁS PROFUNDA
- **Origen**: Owner v18-OBS4
- **Regla**: No solo detectar "integration of data protection into governance" (explícito). Ir un nivel más abajo: los matters revelan el patrón `diagnose → design → implement → institutionalise → monitor`. La tesis real: "helps clients build data protection as institutional capability."
- **Status**: ✅ Implementado v18.5 — "Extract PATTERNS from matters: governance integration, recurring advisory, sector diversity, measurable outcomes"
- **Código**: [nodes.py B7 strategic_matter_context](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py#L2297-L2320)

### C10. Splice Prevention — zero contaminación entre matters
- **Origen**: Bug v20.0 — M5 (Excelsior) contenía texto de M6 (Modelquipo)
- **Regla**: Cada matter SOLO contiene información de SU cliente y SU mandato. Cero artefactos de tabla DOCX (`| No. 6 |`), cero nombres de clientes de otros matters en el texto.
- **Status**: ✅ Implementado v20.1
- **Código**: [nodes.py sanitize_descriptor_source()](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py), [nodes.py find_foreign_client_mentions()](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py)

### C11. Opening Diversity — 7/7 first words ÚNICOS
- **Origen**: Bug v20.0 — 3+ matters abrían con "The..."
- **Regla**: El primer word de cada matter DEBE ser diferente de todos los demás. Banned defaults: "the", "this", "our", "it", "we". Enforcement determinístico post-LLM con `force_opening_diversity()`.
- **Status**: ✅ Implementado v20.1
- **Código**: [opening_diversity.py](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/utils/opening_diversity.py), [nodes.py Final Diversity Enforcement](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py)

### C12. Grammar Repair — no "Client's, descriptor" pattern
- **Origen**: Bug v20.0 — LLM generaba "Biocodex's, a global pharmaceutical..."
- **Regla**: `"Client's, appositive"` es incorrecto. Solo válido cuando el poseído sigue inmediatamente: `"Client's mandate"`. Soporte Unicode curvos (', ').
- **Status**: ✅ Implementado v20.1
- **Código**: [nodes.py repair_possessive_appositive()](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py)

### C13. Foreign Client Validator — zero cross-matter names
- **Origen**: Bug v20.0 — GPT insertaba nombres de otros clientes
- **Regla**: Post-generation check: si el texto de M5 menciona "Grupo Modelquipo", la oración contaminada se elimina.
- **Status**: ✅ Implementado v20.1
- **Código**: [nodes.py find_foreign_client_mentions()](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py)

### C14. Minimum Word Floor (175w)
- **Origen**: Bug v20.0 — M5 tenía solo 153w
- **Regla**: Cada matter optimizado debe tener ≥ 175 palabras. Warning log si está por debajo.
- **Status**: ✅ Implementado v20.1
- **Código**: [nodes.py word floor check](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py)

### C15. Descriptor Capitalization — lowercase mid-sentence
- **Origen**: Bug v20.1 — "MEGA DIRECT, Customer experience, call center..."
- **Regla**: Cuando un descriptor de E1 se inserta mid-sentence, la primera letra se convierte a lowercase si es un industry word.
- **Status**: ✅ Implementado v20.1
- **Código**: [nodes.py DESCRIPTOR CAPITALIZATION FIX](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/ai-engine/agents/nodes.py)

---

## D. REGLAS DEL AUDIT (Strategic Audit Letter)

### D1. Labels sin arquitectura interna
- **Origen**: Owner v18-OBS3
- **Cambios**: "Competitive Identity" → "Practice Positioning", "Hero Matter" → "Lead Engagement"
- **Status**: ✅ Implementado v18.5b
- **Código**: [route.ts L377-413](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/src/app/api/generate-docx/route.ts#L377-L413)

### D2. Evidence Strengthening Requests
- **Origen**: Owner v18-OBS8
- **Regla**: El audit debe incluir sección de preguntas para claims débiles. No criticar — preguntar qué información falta para fortalecer.
- **Status**: ✅ Implementado v18.5b
- **Código**: [route.ts §6b](file:///Users/jonathanpalacios/Downloads/Rankpilot-2026/rankpilot-new-repo/src/app/api/generate-docx/route.ts#L532-L585)

### D3. Reality Check = consistencia INTERNA
- **Origen**: Owner v17-OBS4
- **Regla**: "¿Dónde el submission contradice o debilita su PROPIA tesis?" NO comparación especulativa con otras firmas.
- **Status**: ✅ Implementado

---

## E. REGLAS FUTURAS (Aprobadas pero no implementadas)

### E1. Diagnose vs Rewrite mode
- **Origen**: Owner v18-OBS1 + OBS12
- **Regla**: RankPilot debería poder terminar diciendo: PRESERVE / ENHANCE / RESTRUCTURE / REQUEST INFORMATION / DO NOT REWRITE. "The output ideal is not always a rewrite."
- **Status**: ❌ NO IMPLEMENTADO — Requiere nodo "editorial triage"
- **Prioridad**: BAJA (roadmap)

### E2. Verificación B7 ↔ matters trazable
- **Origen**: Owner v18-OBS10
- **Regla**: Cada claim del B7 debe poder rastrearse a evidencia en 1+ matters.
- **Status**: ❌ NO IMPLEMENTADO
- **Prioridad**: MEDIA (post-MVP)

---

## 🔎 CHECKLIST DE VALIDACIÓN (36 puntos)

> Usar esta checklist para auditar CUALQUIER output de RankPilot antes de entregarlo al owner.

### Sistema (7 checks)
- [ ] **A1**: Zero "the firm lacks...", "the firm has no...", "the firm fails to..."
- [ ] **A3**: Zero "external validation", "referee", "client testimonial"
- [ ] **A4**: Si cross_border_relevant=false → Zero "cross-border" en texto AI
- [ ] **A5**: Zero "diversify", "expand capabilities", "develop new business"
- [ ] **A6**: Zero "competitive identity", "hero matter", "narrative arc" en texto visible
- [ ] **A7**: Zero filler words: "pivotal", "beacon", "testament", "cornerstone", "seamlessly", "meticulously", "holistic", "robust framework", "navigate complex"
- [ ] **A7+**: Zero "widely recognised", "particularly recognised", "strategic advisory role"

### B7 (7 checks)
- [ ] **B1**: B7 lee como proposición estratégica, NO como lista de clientes/matters
- [ ] **B2**: Densidad estratégica alta — ¿cada frase agrega inteligencia editorial?
- [ ] **B3**: ¿INTERPRETA la práctica o solo la DESCRIBE/DECORA?
- [ ] **B4**: Menciona 2-3 clientes como EJEMPLOS de patrones (no lista de 7)
- [ ] **B5**: La tesis del original está PRESERVADA (no reemplazada)
- [ ] **B6**: Word count ≥ original AND ≤ 500
- [ ] **B7**: Lead partner mencionado BY NAME

### Matters (16 checks)
- [ ] **C1**: Cada matter ≥ original word count (EXPANDIDO, no resumido)
- [ ] **C2**: Cada matter ABRE con WHY (significancia estratégica), no con mandate genérico
- [ ] **C3**: Los 7 openings son DIFERENTES entre sí (no homogeneizados)
- [ ] **C4**: Outcomes son STRONG o MODERATE (zero "strengthened compliance posture" genérico)
- [ ] **C5**: Client descriptors VERBATIM del original (no reemplazados con genéricos)
- [ ] **C6**: Evidencia clave preservada (años, %, nombres, regulaciones, datos duros)
- [ ] **C7**: Hero Matter seleccionado por scoring (no por orden del documento)
- [ ] **C8**: Claims débiles tienen Information Request en audit (no prose manufacturada)
- [ ] **C9**: Se descubrieron PATRONES más profundos (no solo la tesis explícita del original)
- [ ] **C10**: 7/7 matters evaluados (zero matters dropped/ignored)
- [ ] **C11**: Zero splice/contaminación entre matters (zero artefactos de tabla DOCX)
- [ ] **C12**: 7/7 first words ÚNICOS (opening diversity)
- [ ] **C13**: Zero errores gramaticales "Client's, descriptor" (possessive-appositive)
- [ ] **C14**: Zero nombres de clientes ajenos en cada matter (foreign client validation)
- [ ] **C15**: Cada matter ≥ 175 palabras (word floor)
- [ ] **C16**: Descriptors en lowercase mid-sentence (no "Customer experience" capitalizado)

### Audit (6 checks)
- [ ] **D1**: Headers sin arquitectura interna ("Practice Positioning", "Lead Engagement")
- [ ] **D2**: Sección "Evidence Strengthening Requests" presente si hay claims débiles
- [ ] **D3**: Reality Check = consistencia interna (zero comparaciones especulativas)
- [ ] **Score**: Score derivado correctamente de editorial_confidence
- [ ] **Jurisdiction**: A3 muestra jurisdiction correcta (país, no región)
- [ ] **Pipeline**: Todos los nodos ejecutados sin error
