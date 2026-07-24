# 🛡️ RANKPILOT AI ENGINE — ITERATION CHANGELOG & REGRESSION GUARD
## "NEVER DELETE WHAT WAS ALREADY FIXED"

> **Purpose:** This document tracks EVERY active rule, fix, and architectural decision in the AI engine.  
> Before ANY iteration, consult this list to ensure no previous fix is accidentally removed or contradicted.  
> Last updated: **2026-07-24** (v10.1 — Confidentiality Calibration, Cross-Border Enhancement, Audit DOCX Parity)

---

## 📋 MASTER RULE TABLE

| # | Rule / Fix | Version | File(s) | Status | Critical Level |
|---|-----------|---------|---------|--------|----------------|
| 1 | Editorial Constitution (6 Articles) | v8.0 | `prompts.py`, `EDITORIAL_CONSTITUTION.txt`, `rag_router.py` | ✅ ACTIVE | 🔴 SUPREME |
| 2 | Epistemic Guardrails | v7.0 | `prompts.py` | ✅ ACTIVE | 🔴 CRITICAL |
| 3 | Matter Accountability Protocol | v7.0 | `prompts.py` | ✅ ACTIVE | 🔴 CRITICAL |
| 4 | Anti-Exclusion Directive | v7.1 | `prompts.py` | ✅ ACTIVE | 🔴 CRITICAL |
| 5 | Evidence Cross-Validation | v7.0 | `prompts.py` | ✅ ACTIVE | 🔴 CRITICAL |
| 6 | Editorial Voice Directive | v7.1 | `prompts.py` | ✅ ACTIVE | 🟡 HIGH |
| 7 | Language Guard (131 patterns) | v9.0 | `language_guard.py` | ✅ ACTIVE | 🔴 CRITICAL |
| 8 | Probative Preservation Validator | v8.0 | `nodes.py` | ✅ ACTIVE | 🔴 CRITICAL |
| 9 | Reality Check → Editorial Observations | v8.0 | `prompts.py`, `route.ts`, `docx_generator.py` | ✅ ACTIVE | 🟡 HIGH |
| 10 | Benchmark-First Enforcement | v8.0 | `prompts.py` | ✅ ACTIVE | 🟡 HIGH |
| 11 | DOCX DXA Width System | v8.1 | `submission-builder.ts` | ✅ ACTIVE | 🔴 CRITICAL |
| 12 | Unicode Sanitization | v5.0 | `nodes.py` | ✅ ACTIVE | 🟡 HIGH |
| 13 | Pipeline Error Persistence | v5.0 | `nodes.py`, `main.py` | ✅ ACTIVE | 🟡 HIGH |
| 14 | editorial_memory State Field | v7.0 | `state.py` | ✅ ACTIVE | 🔴 CRITICAL |
| 15 | JSON Brace Escaping in f-strings | v7.0 | `prompts.py` | ✅ ACTIVE | 🔴 CRITICAL |
| 16 | Thesis Specificity Enforcement | v7.1 | `prompts.py` | ✅ ACTIVE | 🟡 HIGH |
| 17 | Practice Area Auto-Correction | v7.1 | `prompts.py` | ✅ ACTIVE | 🟡 HIGH |
| 18 | DOCX Export Toggle (AI + Original) | v6.0 | `route.ts`, `submission-builder.ts` | ✅ ACTIVE | 🟡 HIGH |
| 19 | Hero Matter 7-Criteria Selection | v6.0 | `prompts.py` (NARRATIVE_ARCHITECTURE_PROMPT) | ✅ ACTIVE | 🔴 CRITICAL |
| 20 | Never Eliminate Evidence — Absolute Preservation | v6.0 | `prompts.py` (SUBMISSION_BLUEPRINT_PROMPT) | ✅ ACTIVE | 🔴 CRITICAL |
| 21 | Evidence Inference Rule — Don't ask for existing info | v6.0 | `prompts.py` (STRATEGIC_ANALYSIS_PROMPT) | ✅ ACTIVE | 🟡 HIGH |
| 22 | State of Play Diagnostic + Narrative Transformations + Confidence Radar | v6.0 | `prompts.py` (STRATEGIC_ANALYSIS_PROMPT) | ✅ ACTIVE | 🟡 HIGH |
| 23 | Editorial Reasoning Trace Panel | v7.0 | `state.py`, `nodes.py`, frontend components | ✅ ACTIVE | 🟡 HIGH |
| 24 | Strategic Client Relationship Detection | v9.0 | `prompts.py` (shared block), `nodes.py` (SCR detector) | ✅ ACTIVE | 🔴 SUPREME |
| 25 | Evidence vs Prose Classification | v9.0 | `prompts.py` (shared block), `nodes.py` (evidence list detector) | ✅ ACTIVE | 🔴 SUPREME |
| 26 | Benchmark Quantification Enforcement | v9.0 | `prompts.py` (STRATEGIC_ANALYSIS_PROMPT `the_reality_check`) | ✅ ACTIVE | 🔴 CRITICAL |
| 27 | Evidence List Detector (programmatic) | v9.0 | `nodes.py` (optimization_node validator) | ✅ ACTIVE | 🔴 CRITICAL |
| 28 | Expanded Consultant-Speak Guard | v9.0 | `language_guard.py`, `prompts.py` (EDITORIAL_VOICE_DIRECTIVE) | ✅ ACTIVE | 🔴 CRITICAL |
| 29 | Directory Router (Chambers vs Legal 500) | v10.0 | `directory_config.py`, `submission-builder.ts`, `nodes.py`, `prompts.py` | ✅ ACTIVE | 🔴 SUPREME |
| 30 | Confidentiality Guardrail — Immutable Publish Status | v10.0 | `prompts.py` (shared block), `nodes.py` (extraction + analysis), `submission-builder.ts` | ✅ ACTIVE | 🔴 SUPREME |
| 31 | Full Universe Analysis Rule | v10.0 | `prompts.py` (shared block), `nodes.py` (universe counts injection) | ✅ ACTIVE | 🔴 SUPREME |
| 32 | Anti-Self-Referential Diagnosis Rule | v10.0 | `prompts.py` (shared block) | ✅ ACTIVE | 🔴 CRITICAL |
| 33 | Redundancy Detection Fix (multi-dimensional comparison) | v10.0 | `prompts.py` (shared block) | ✅ ACTIVE | 🔴 CRITICAL |
| 34 | Hero Selection Transparency (candidate comparison) | v10.0 | `prompts.py` (shared block + blueprint prompt) | ✅ ACTIVE | 🔴 CRITICAL |
| 35 | Practice Taxonomy (practice-specific evaluation) | v10.0 | `practice_taxonomy.py`, `nodes.py`, `prompts.py` | ✅ ACTIVE | 🔴 CRITICAL |
| 36 | Setup Wizard Filter Pipeline (5-filter context flow) | v10.0 | `submissions/page.tsx`, `process-document/route.ts`, `nodes.py`, `prompts.py`, `submission-builder.ts` | ✅ ACTIVE | 🔴 SUPREME |
| 37 | Confidentiality Guardrail Calibration — No default-to-confidential | v10.1 | `nodes.py` (extraction_node) | ✅ ACTIVE | 🔴 SUPREME |
| 38 | Enhanced Cross-Border & Sector Detection (text scanning + country keywords) | v10.1 | `nodes.py` (analysis_node) | ✅ ACTIVE | 🔴 CRITICAL |
| 39 | MANDATORY_UNIVERSE_FACTS Anti-Self-Referential Injection | v10.1 | `nodes.py` (analysis_node), injected into STRATEGIC_ANALYSIS_PROMPT | ✅ ACTIVE | 🔴 SUPREME |
| 40 | Audit DOCX Parity — 8 missing sections added to match UI report | v10.1 | `route.ts` (buildAuditDoc) | ✅ ACTIVE | 🔴 CRITICAL |

---

## 📚 DETAILED DESCRIPTIONS

### 1. 🏛️ EDITORIAL CONSTITUTION (v8.0) — SUPREME LAW
**Files:** `prompts.py` (lines 17-49), `rag_knowledge/EDITORIAL_CONSTITUTION.txt`, `rag_router.py`

The `EDITORIAL_CONSTITUTION` block is the supreme governing law of the entire pipeline. It contains 6 Constitutional Articles:

| Article | Principle | Key Rule |
|---------|-----------|----------|
| I | SCOPE | RankPilot evaluates SUBMISSIONS, not firms |
| II | EPISTEMIC HUMILITY | Absence of evidence ≠ evidence of absence |
| III | EVIDENCE-BASED | Every conclusion must cite observable evidence FROM the submission |
| IV | BENCHMARK-FIRST | Evidence → Benchmark → Conclusion (never Evidence → Conclusion → Benchmark) |
| V | PROBATIVE PRESERVATION | Optimization = RESTRUCTURING, not REDUCING |
| VI | EXPLAINABILITY | Every editorial decision must be defensible in an editorial meeting |

**⚠️ NEVER REMOVE OR MODIFY without explicit owner approval.**

**Injected into these 8 prompts:** `EXTRACTION_SYSTEM_PROMPT`, `STRATEGIC_ANALYSIS_PROMPT`, `EDITORIAL_INTERROGATOR_PROMPT`, `MATTER_OPTIMIZER_PROMPT`, `CONTEXT_ENGINE_PROMPT`, `COMPREHENSION_PROMPT`, `IDENTITY_DISCOVERY_PROMPT`, `HYPOTHESIS_CONSTRUCTION_PROMPT`.

Also loaded as a RAG file via `rag_router.py` → `global_files` list (first entry: `editorial_constitution.txt`).

---

### 2. 🧠 EPISTEMIC GUARDRAILS (v7.0)
**File:** `prompts.py` (lines 55-82)

Deterministic rules preventing the AI from making claims about "the firm" when it can only evaluate "the submission":

**FORBIDDEN phrases:**
- "The firm lacks..."
- "The firm depends on..."
- "The firm is limited to..."
- "The firm has no..."
- "There is no evidence of..."
- "The firm fails to..."

**REQUIRED alternatives:**
- "The submission does not yet demonstrate..."
- "Based on the presented evidence, the submission concentrates on..."
- "The available evidence does not yet show..."

**⚠️ This block is injected into STRATEGIC_ANALYSIS_PROMPT and MATTER_OPTIMIZER_PROMPT.**

---

### 3. 📦 MATTER ACCOUNTABILITY PROTOCOL (v7.0)
**File:** `prompts.py` (lines 84-111)

**ZERO-LOSS RULE:** `count(input_matters) == count(output_matter_evaluations)`

Every matter submitted by the client MUST be:
1. EVALUATED (score, quality_label, improvement_note)
2. ASSIGNED a role (hero / thesis_reinforcement / differentiation / depth / supporting)
3. NEVER silently dropped, omitted, or ignored

If condensed → state WHICH matter, WHY, and preserve the original probative detail.

**⚠️ This is the most critical rule to prevent matter loss during iterations.**

---

### 4. 🛑 ANTI-EXCLUSION DIRECTIVE (v7.1)
**File:** `prompts.py` (lines 101-111, inside MATTER_ACCOUNTABILITY)

- **Maximum 2 matters** can be assigned "exclude" per submission
- "exclude" means NARRATIVE DE-EMPHASIS, not physical removal from the DOCX
- Sector diversity is a STRENGTH in Corporate/M&A, NOT grounds for exclusion
- Prestigious clients (Tesla, Mercado Libre) are credibility signals regardless of sector
- High-value deals ($100M+) should NEVER be excluded solely for sector mismatch
- **Default disposition is "supporting"** — exclusion must be JUSTIFIED

---

### 5. ✅ EVIDENCE CROSS-VALIDATION PROTOCOL (v7.0)
**File:** `prompts.py` (lines 113-134)

Before EACH conclusion, the AI MUST:
1. STATE the conclusion
2. SEARCH the submission for CONTRADICTING evidence
3. If contradicting evidence exists → REVISE
4. If not → PROCEED but note the basis

**CONCENTRATION ≠ DEPENDENCE rule:**
- If `client_count >= 5, sector_count >= 3, or type_count >= 4` → the submission DEMONSTRATES diversity
- Multiple matters for ONE anchor client = INSTITUTIONAL DEPTH, not dependency

---

### 6. ✍️ EDITORIAL VOICE DIRECTIVE (v7.1)
**File:** `prompts.py` (lines 141-151)

**PROHIBITED terms:** "strategic plan", "diversification", "market expansion", "high-sophistication firm", "operational excellence", "value proposition", "broaden client base", "leverage synergies", "optimize portfolio", "scalable model"

**REQUIRED terms:** "institutional reputation", "market perception", "editorial positioning", "submission narrative", "evidence", "differentiation", "credibility", "demonstrative capacity", "ranking narrative", "editorial identity", "bench strength", "practice trajectory"

---

### 7. 🚨 LANGUAGE GUARD (v8.0 — 85+ patterns)
**File:** `language_guard.py` (227 lines)

The LAST LINE OF DEFENSE — deterministic string replacement applied AFTER the LLM generates output.

**Pattern categories:**
| Category | Count | Examples |
|----------|-------|---------|
| Prohibited editorial terms | ~12 | "high-sophistication firm" → "a sophisticated practice" |
| Firm-wide epistemic violations | ~20 | "The firm lacks" → "The submission does not yet demonstrate" |
| Absolute negative assertions | ~5 | "no cross-border work" → "no cross-border work presented in the submission" |
| v8.0 Indirect negatives | ~11 | "heavily concentrated on" → "evidence is primarily drawn from" |
| v8.0 Consultant-speak | ~14 | "should consider diversifying" → "could strengthen the submission..." |
| v8.0 Spanish equivalents | ~14 | "El despacho carece de" → "El submission no presenta aún evidencia de" |

**Applied to fields:** `analysis`, `comprehension`, `competitive_identity`, `hypotheses`, `refutation_results`, `comparative_analysis`, `editorial_confidence`, `narrative_architecture`, `reasoning_trace`, `submission_blueprint`

**NOT applied to:** `metadata`, `matters` (raw client data), `strategic_context`

**⚠️ When adding new patterns, ALWAYS add the capitalized variant too.**

---

### 8. 📊 PROBATIVE PRESERVATION VALIDATOR (v8.0)
**File:** `nodes.py` (lines 332-391)

Post-optimization validator in `optimization_node` that runs AFTER each matter is optimized:

1. **Word count ratio check:** optimized text must be ≥ 75% of original word count
2. **Client name preservation:** the client name must appear in the optimized text
3. **Monetary value preservation:** numeric values from the matter must survive
4. **Re-optimization trigger:** if validation fails, a corrective prompt explicitly instructs the LLM to preserve all probative elements

**⚠️ This is the programmatic enforcement of Constitutional Article V.**

---

### 9. 📝 REALITY CHECK → EDITORIAL OBSERVATIONS (v8.0)
**Files:** `prompts.py`, `route.ts` (line 222), `docx_generator.py` (line 58)

The section formerly called "VOICE OF TRUTH" was renamed to "EDITORIAL OBSERVATIONS" with mandatory structure:

```
[Observation] → [Evidence] → [Benchmark] → [Recommendation]
```

**Hardcoded intro text** (in both `route.ts` AND `docx_generator.py`):
> "Editorial observations on the submission's competitive positioning"

**⚠️ This text exists in TWO places (TypeScript + Python). Both must stay in sync.**

---

### 10. 🎯 BENCHMARK-FIRST ENFORCEMENT (v8.0)
**File:** `prompts.py` (STRATEGIC_ANALYSIS_PROMPT)

- `the_path_to_dominance` now requires a mandatory `benchmark_anchor` field in every step
- Format: "Firms at Band [X] for [Practice] in [Jurisdiction] typically demonstrate [Y]."
- `matter_evaluations.improvement_note` requires benchmark-anchored format

---

### 11. 📄 DOCX DXA WIDTH SYSTEM (v8.1)
**File:** `submission-builder.ts`

**Root cause fixed:** Google Docs ignores `WidthType.PERCENTAGE`, causing tables to collapse.

**Solution:**
- `PAGE_WIDTH_DXA = 9360` (Letter 8.5" - 2×1" margins)
- ALL tables and cells use `WidthType.DXA`
- ALL tables have `columnWidths` array for explicit `w:tblGrid` generation
- ALL tables use `TableLayoutType.FIXED`
- B6 lawyers table: `[1500, 4260, 1000, 1000, 1600]` = 9360
- **ZERO instances of `WidthType.PERCENTAGE`** in the file

**⚠️ NEVER reintroduce `WidthType.PERCENTAGE` — it breaks Google Docs.**

---

### 12. 🔤 UNICODE SANITIZATION (v5.0)
**File:** `nodes.py` (lines 28-35)

The `sanitize_text()` function removes null bytes, control characters, and replaces invalid UTF-8:
```python
text = text.replace('\x00', '')
text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
text = text.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
```

Applied at: ingestion, extraction, all node inputs.

---

### 13. 💾 PIPELINE ERROR PERSISTENCE (v5.0)
**File:** `nodes.py`, `main.py`

If the pipeline fails at any node:
- Partial data is saved (not discarded)
- Error status is persisted to the database
- The user sees a meaningful error message, not a blank screen

---

### 14. 📋 `editorial_memory` STATE FIELD (v7.0)
**File:** `core/state.py`

**⚠️ CRITICAL:** This field MUST exist in `initial_state` or the pipeline crashes with `PIPELINE_EXECUTION_ERROR`.

```python
"editorial_memory": {}
```

---

### 15. 🔧 JSON BRACE ESCAPING IN F-STRINGS (v7.0)
**File:** `prompts.py`

LangChain treats `{` and `}` as template variables. In Python f-strings that contain JSON examples, braces must be **quadruple-escaped**: `{{{{` and `}}}}`.

**⚠️ If you add JSON examples to any prompt that uses f-string interpolation, remember: `{{{{` not `{{`.**

---

### 16. 🎯 THESIS SPECIFICITY ENFORCEMENT (v7.1)
**File:** `prompts.py` (STRATEGIC_ANALYSIS_PROMPT)

The `firm_thesis` field must be SPECIFIC to the actual practice area and jurisdiction. Generic theses like "leading corporate firm" are rejected.

Required format: "[Firm] is positioned as [specific differentiator] within [specific practice area] in [jurisdiction]."

---

### 17. 🌎 PRACTICE AREA AUTO-CORRECTION (v7.1)
**File:** `prompts.py` (STRATEGIC_ANALYSIS_PROMPT)

If the submission's content clearly indicates a different practice area than what was declared, the AI must:
1. Note the discrepancy
2. Analyze based on the ACTUAL practice area shown in the matters
3. Not blindly follow the declared practice area

---

### 18. 🔀 DOCX EXPORT TOGGLE — AI + Original (v6.0)
**Files:** `route.ts` (line 16), `submission-builder.ts` (lines 104, 113, 156)

Two export modes via `?mode=` URL parameter:
- `optimized` (default): Uses AI-rewritten matter text (`matter.optimizedText`)
- `original`: Uses raw client text as submitted (`matter.rawNotes`)

**Logic in `matterTable()`:**
```typescript
exportMode === 'original'
  ? (matter.rawNotes || matter.optimizedText || '')
  : (matter.optimizedText || matter.rawNotes || '')
```

**⚠️ The AI NEVER rewrites the original submission without permission. Both versions always available.**

---

### 19. 🏆 HERO MATTER 7-CRITERIA SELECTION (v6.0)
**File:** `prompts.py` (lines 901-928, inside SUBMISSION_BLUEPRINT_PROMPT)

Hero matter is selected by **editorial merit**, not word count. The 7 criteria in priority order:

1. **EDITORIAL THESIS EMBODIMENT** — Does it demonstrate the submission's thesis?
2. **CLIENT IMPORTANCE** — Prestige and institutional significance
3. **ECONOMIC IMPACT** — Deal value, market significance, transformative potential
4. **CHAMBERS RELEVANCE** — Relevance to the specific practice area and directory
5. **DEMONSTRATIVE CAPACITY** — Shows the firm's ROLE, not just the transaction
6. **DIFFERENTIATION** — Shows what competitors CANNOT replicate
7. **STRATEGIC POSITION** — Reveals the firm's unique market position

**NEVER select based on:** word count, internal scoring, or deal value alone.

The AI MUST populate `hero_selection_reasoning` explaining WHY it chose the hero.

**⚠️ This prevents the AI from picking the longest matter as the hero.**

---

### 20. 🚫 NEVER ELIMINATE EVIDENCE — Absolute Preservation (v6.0)
**File:** `prompts.py` (lines 930-944, inside SUBMISSION_BLUEPRINT_PROMPT)

**Absolute rule:** The blueprint may CLASSIFY and PRIORITIZE matters, but may **NEVER recommend eliminating them.**

- `matters_to_exclude` = narrative de-emphasis, NOT deletion
- Every matter the client submitted MUST appear in the DOCX export regardless of blueprint
- De-emphasis = reduce narrative prominence, not delete from submission
- Editorial Decision Rule 2: "What should we NOT tell?" — de-emphasize, NEVER delete

**Related rules:** Anti-Exclusion Directive (#4), Matter Accountability (#3).

**⚠️ This is different from #4 (max 2 excludes) — this ensures even "excluded" matters appear in the DOCX.**

---

### 21. 🔍 EVIDENCE INFERENCE RULE — Don't Ask for Existing Info (v6.0)
**File:** `prompts.py` (lines 228-235, inside STRATEGIC_ANALYSIS_PROMPT)

Before generating ANY recommendation, the AI MUST:
1. Check if the information already EXISTS in the submission
2. If the submission demonstrates sector expertise across multiple matters → do NOT recommend "identify sector expertise"
3. If the submission shows cross-border work → do NOT ask for "cross-border evidence"
4. Apply filter: "Has the submission already answered this question?"
   - If YES → acknowledge the strength and suggest how to AMPLIFY it
   - If NO → recommend gathering this information

**Example:** If submission has 10 matters in automotive sector, don't recommend "identify your core sector."

**⚠️ This prevents embarrassing recommendations that contradict the evidence.**

---

### 22. 📊 STATE OF PLAY + NARRATIVE TRANSFORMATIONS + CONFIDENCE RADAR (v6.0)
**File:** `prompts.py` (lines 280-321, inside STRATEGIC_ANALYSIS_PROMPT)

Three interconnected report sections:

**A) Confidence Assessment (item 4 in output schema):**
- `risk_level`: "Low" | "Moderate" | "High"
- `score`: 0-100 based on evidence vs. target band
- `summary`: 3-sentence editorial assessment
- `narrative_strategy`: Array of exactly 3 TRANSFORMATIONS showing **BEFORE → AFTER**
  - Format: "Current narrative: '[X]' → Target narrative: '[Y]'"
  - This is a concrete REWRITING PLAN, not a list of recommendations

**B) State of Play (item 5: `the_state_of_play`):**
- 2-3 paragraphs that DIAGNOSE, not summarize
- Must answer: "Why hasn't Chambers ranked this firm?" or "Why Band X and not Y?"
- Diagnostic focus: evidence gap, market perception, structural barriers, positioning problems

**C) Unfair Advantage (item 6: `the_unfair_advantage`):**
- Title: "THE WEAPON"
- Core differentiator with numbered examples from matters

**⚠️ State of Play must DIAGNOSE, never merely describe. If it reads like a summary, it's wrong.**

---

### 23. 🔬 EDITORIAL REASONING TRACE PANEL (v7.0)
**Files:** `core/state.py` (line 71: `reasoning_trace: List[Dict]`), frontend components

The `reasoning_trace` field captures EVERY editorial decision made by the pipeline:
- Which decision was made
- What evidence was used
- What alternatives were considered
- Why they were rejected
- Which Constitutional Article/editorial principle was applied

This powers the **Reasoning Trace panel** in the frontend report view, which provides full transparency into the AI's editorial reasoning — from hero matter selection to confidence level.

**⚠️ `reasoning_trace` is also filtered by the Language Guard (Rule #7).**

---

### 24. 🏢 STRATEGIC CLIENT RELATIONSHIP DETECTION (v9.0)
**Files:** `prompts.py` (shared block `STRATEGIC_CLIENT_RELATIONSHIP_RULE`), `nodes.py` (SCR detector in optimization_node)

**Owner's Observation 1:** The AI was collapsing multi-matter client relationships (Audi = 17 strategic mandates, VW = 300 contracts over 8 years) into single generic summaries like "managed Audi's production crisis."

**Detection signals:**
- "exclusive external legal department" / "departamento jurídico externo"
- "more than X contracts" / "X+ agreements"
- "Y years of advisory" / "longstanding relationship"
- Multiple named sub-projects/sub-deals within one entry
- Words: "ongoing", "continuous", "retained", "institutional counsel"

**When detected, the AI MUST:**
1. Preserve the FULL multi-dimensional narrative
2. Keep numeric counts explicitly ("17 mandates", "300+ contracts")
3. Preserve duration ("eight-year advisory")
4. Preserve exclusivity signals
5. Preserve breadth indicators ("AML, distribution, logistics, recovery")

**Programmatic enforcement:** `nodes.py` applies 90% word count threshold for SCR entries (vs 75% normal).

**Injected in:** MATTER_OPTIMIZER_PROMPT, STRATEGIC_ANALYSIS_PROMPT, SUBMISSION_BLUEPRINT_PROMPT, NARRATIVE_ARCHITECTURE_PROMPT.

**⚠️ Compressing a Strategic Client Relationship to one sentence = converting a 500-page case file to a tweet.**

---

### 25. 📝 EVIDENCE VS PROSE CLASSIFICATION (v9.0)
**Files:** `prompts.py` (shared block `EVIDENCE_VS_PROSE_RULE`), `nodes.py` (evidence list detector)

**Owner's Observation 6:** The AI doesn't distinguish between narrative text and competitive evidence. When it finds a long paragraph, it tries to summarize it — but many paragraphs are LISTS OF EVIDENCE, not prose.

**Classification test (BEFORE any optimization):**
- **Type A (NARRATIVE PROSE):** Background, firm descriptions, market commentary → CAN be restructured
- **Type B (COMPETITIVE EVIDENCE):** Lists of matters, counts, years, values, jurisdictions, client names → NEVER compress

**Three-question test:**
1. "Is this passage telling a STORY, or proving a FACT?" → Story = A, Fact = B
2. "If I remove this detail, would a Chambers researcher lose a data point?" → Yes = B
3. "Does this passage contain NUMBERS?" → Yes = B (preserve ALL numbers)

**Injected in:** MATTER_OPTIMIZER_PROMPT, STRATEGIC_ANALYSIS_PROMPT, SUBMISSION_BLUEPRINT_PROMPT, NARRATIVE_ARCHITECTURE_PROMPT.

**⚠️ This is the ROOT CAUSE rule. Most evidence compression problems trace back to misclassifying evidence as prose.**

---

### 26. 📊 BENCHMARK QUANTIFICATION ENFORCEMENT (v9.0)
**File:** `prompts.py` (STRATEGIC_ANALYSIS_PROMPT, `the_reality_check` section)

**Owner's Observation 3:** Recommendations say "Diversify your client portfolio" without comparing to any benchmark. No band reference, no numbers.

**Now EVERY observation in `the_reality_check` MUST include:**
1. A specific band/tier reference ("Band 1", "Band 2", "Top Ranked")
2. A specific quantity from the benchmark ("6-8 sectors", "4-6 client relationships")
3. A specific quantity from the submission ("3 sectors", "2 clients")

**Self-check:** If ANY of these three are missing, the observation is INVALID — rewrite it.

**Format:** "Firms ranked in Band [X] for [Practice] in [Jurisdiction] typically demonstrate [NUMBER]. Your submission provides [NUMBER]. Therefore, [recommendation]."

**⚠️ An observation without a quantitative benchmark is a consultant opinion, not an editorial assessment.**

---

### 27. 🔬 EVIDENCE LIST DETECTOR — Programmatic (v9.0)
**File:** `nodes.py` (optimization_node, after probative preservation checks)

**Three programmatic checks added:**

1. **Numeric Evidence Count Preservation:** Detects patterns like "17 matters", "300 contracts", "8 years" in the original and verifies the number appears in the optimized text.

2. **Strategic Client Relationship Detector:** Detects exclusivity signals ("exclusive external", "departamento jurídico externo", "institutional counsel", etc.) and raises the word count threshold to 90% (normally 75%).

3. **Named Entity Preservation:** Counts capitalized multi-word entities in the original. If more than 3 exist and fewer than 70% are preserved in the optimized text, triggers re-optimization.

**If any check fails:** The matter is re-optimized with an enhanced preservation prompt that includes Evidence vs Prose and SCR guidance.

**⚠️ This is the POLICE — prompts are the law, this validator enforces it programmatically.**

---

### 28. 🚫 EXPANDED CONSULTANT-SPEAK GUARD (v9.0)
**Files:** `language_guard.py` (34 new patterns), `prompts.py` (EDITORIAL_VOICE_DIRECTIVE expanded)

**Owner's Observation 4:** Phrases like "Consider broadening your market visibility" and "Improve your positioning" were still leaking through.

**New pattern categories added:**
- **Dependency language (9 patterns):** "appears highly dependent on" → "emphasizes work in"
- **Consultant-speak (18 patterns):** "Consider broadening" → "The submission could present a broader range of"
- **Evidence compression (4 patterns):** "various matters" → "multiple documented matters"

**Also expanded EDITORIAL_VOICE_DIRECTIVE** with 6 new prohibited terms: "consider broadening", "improve your positioning", "enhance your visibility", "expand your reach", "strengthen your brand", "develop a strategy".

**Total Language Guard patterns: 131** (was 85 in v8.0).

**⚠️ Every new consultant-speak variant the owner identifies MUST be added to both language_guard.py AND the EDITORIAL_VOICE_DIRECTIVE.**

---

### 29. 🌐 DIRECTORY ROUTER — Chambers vs Legal 500 (v10.0)
**Files:** `utils/directory_config.py`, `submission-builder.ts`, `nodes.py`, `prompts.py`

**Root cause fixed:** The system was a "Chambers Monolith" — all terminology, templates, sections, and ranking units were hardcoded to Chambers ("Band", "Section D/E", "Chambers & Partners" title page). When a Legal 500 submission was processed, the DOCX output showed Chambers branding, Chambers headers/footers, and used incorrect ranking terminology.

**Solution:**
- `directory_config.py`: Contains configuration for all directories (Chambers LatAm, Chambers Global, Legal 500 LatAm, Legal 500 EMEA). Each config includes: name, short_name, ranking_unit ("Band"/"Tier"), ranking_labels, wrong_unit, quality_labels, lawyer_categories, and export_template.
- `submission-builder.ts`: New `buildSubmissionDoc()` router dispatches to `buildChambersDoc()` or `buildLegal500Doc()` based on `submission.targetDirectory`.
- `buildLegal500Doc()`: Separate template with Legal 500 title page, correct sections ("What sets your practice apart", "Leading Partners", "Next Generation Partners", "Publishable Work Highlights"), and Legal 500 headers/footers.
- `nodes.py`: Injects `dir_config` into `strategic_context` so downstream nodes know the correct directory.

**⚠️ NEVER use hardcoded "Chambers" or "Band" in prompts — use dynamic `{{directory_context_block}}` placeholders.**

---

### 30. 🔒 CONFIDENTIALITY GUARDRAIL — Immutable Publish Status (v10.0)
**Files:** `prompts.py` (shared block `CONFIDENTIALITY_GUARDRAIL_RULE`), `nodes.py` (extraction + analysis), `submission-builder.ts` (validateConfidentiality)

**Root cause fixed:** The AI was reclassifying non-publishable matters as publishable. Matters that the source document placed under "Non-publishable clients" were appearing in Section D (publishable) of the DOCX output.

**Three-layer enforcement:**

1. **Extraction layer (prompts.py):** Rule 6 now REQUIRES extracting `publish_status` and `is_confidential` for every matter, with default-to-non-publishable when uncertain.

2. **Extraction node (nodes.py):** Deterministic lock after extraction:
   - If `is_confidential=True` AND `publish_status="publishable"` → FORCE to `"non_publishable"`
   - If `publish_status` is `"non_publishable"` or `"confidential"` → FORCE `is_confidential=True`
   - Locked matters get `_confidentiality_locked=True` flag

3. **Analysis node (nodes.py):** Post-analysis validator scans `matter_evaluations` and forces `type` to match the locked status from extraction.

4. **DOCX export (submission-builder.ts):** `validateConfidentiality()` function checks `publishStatus`, `publish_status`, and `isConfidential` to deterministically route matters to publishable vs confidential sections.

**⚠️ VIOLATION OF THIS RULE = POTENTIAL LIABILITY. This is the highest-priority rule in the system.**

---

### 31. 📊 FULL UNIVERSE ANALYSIS RULE (v10.0)
**Files:** `prompts.py` (shared block `FULL_UNIVERSE_ANALYSIS_RULE`), `nodes.py` (universe counts computation)

**Root cause fixed:** The AI was diagnosing weaknesses based on a reduced subset of matters (e.g., the 6 selected for the editorial narrative) instead of the full submission. A firm submitting 23 matters across 14 sectors was diagnosed as having "limited sectoral diversity" because only 6 matters were selected for the narrative.

**Solution:**
- `nodes.py` computes full universe counts BEFORE analysis: `total_unique_clients`, `total_unique_sectors`, `total_cross_border_count`, `total_team_members`
- These counts are injected into the analysis prompt as `input_data` fields
- The `FULL_UNIVERSE_ANALYSIS_RULE` instructs the AI to use THESE numbers for diagnostics, not its own subset

**"INSUFFICIENT EVIDENCE" CALIBRATION:**
- NEVER use "Insufficient Evidence" for a submission with 15+ matters, multiple sectors, and quantified results
- Reserve ONLY for submissions with < 5 matters AND no quantified data

**⚠️ The narrative may PRIORITIZE 6 matters, but the DIAGNOSIS must consider ALL submitted matters.**

---

### 32. 🔄 ANTI-SELF-REFERENTIAL DIAGNOSIS RULE (v10.0)
**File:** `prompts.py` (shared block `ANTI_SELF_REFERENTIAL_RULE`)

**Root cause fixed:** The system was creating a self-referential loop: it would eliminate evidence during processing, then observe the evidence was missing, then recommend adding it.

**Pattern detected and rejected:**
```
System eliminates evidence → System observes missing evidence → System recommends adding evidence
```

**Examples of INVALID recommendations this rule prevents:**
- ❌ "Showcase Broader Team Strength" — when the submission lists 4 partners + 23 associates + 7 heads of team
- ❌ "Diversify Matter Portfolio" — when the submission contains 23+ matters across 14 sectors
- ❌ "Enhance Cross-Border Capabilities" — when the submission includes multinational clients

**Correct reformulation:**
- ✅ "The submission provides substantial evidence of bench depth. However, the connection between individual lawyer profiles and the strongest work highlights could be made more explicit."

**⚠️ Before EACH recommendation, the AI must verify: "Does the full submission already contain evidence of this?"**

---

### 33. 🔍 REDUNDANCY DETECTION FIX (v10.0)
**File:** `prompts.py` (shared block `REDUNDANCY_DETECTION_RULE`)

**Root cause fixed:** The AI was declaring matters redundant using superficial criteria (both involve litigation → redundant). True redundancy requires ALL dimensions to overlap: SAME sector + SAME work type + SAME risk + SAME scale + SAME client type.

**6-dimensional comparison required before declaring redundancy:**
1. SECTOR: automotive ≠ security ≠ energy ≠ retail
2. WORK TYPE: litigation ≠ advisory ≠ compliance ≠ restructuring
3. RISK TYPE: strike risk ≠ dismissal risk ≠ regulatory risk
4. SCALE: 50 employees ≠ 5,000 employees
5. GEOGRAPHY: Puebla ≠ national ≠ multi-state
6. UNIQUE DIMENSION: any new dimension = NOT redundant

**Practice-specific value criteria:**
- In Labour: workforce scale, litigation count, and operational risk > monetary value
- In Disputes: precedent value, constitutional dimension, and outcome > claim amount

**⚠️ Overrides Ch. 8 Redundancy Elimination when applied too aggressively.**

---

### 34. 🏆 HERO SELECTION TRANSPARENCY (v10.0)
**File:** `prompts.py` (shared block `HERO_SELECTION_TRANSPARENCY`, also in SUBMISSION_BLUEPRINT_PROMPT)

**Root cause fixed:** The hero_selection_reasoning field was opaque — it stated the chosen matter but didn't explain why alternatives were rejected. The AI was selecting matters based on headline project value (USD 552M) without verifying the firm's actual mandate value (which might be just workforce documentation).

**Now REQUIRED in hero_selection_reasoning:**
1. ALL candidate matters considered (minimum top 5 by score)
2. For each candidate: brief score summary across 7 criteria
3. If project value ≠ mandate value: explicitly state the MANDATE value
4. Explicit rejection reasoning for each non-selected candidate
5. Winner must beat challengers on COMBINED criteria, not just one dimension

**⚠️ Updated Hero Matter Selection Criteria #3 from "Deal value" to "Practice-specific value criteria."**

---

### 35. 🧬 PRACTICE TAXONOMY (v10.0)
**Files:** `utils/practice_taxonomy.py`, `nodes.py` (injection into strategic_context), `prompts.py` (dynamic `{{practice_context_block}}`)

**Root cause fixed:** All practice areas were being evaluated using the same M&A criteria. Labour matters were scored on "deal value" even though Labour's differentiators are workforce scale, litigation volume, and operational risk management. This caused Labour matters with 5,000 employees and 190+ litigations to score lower than M&A matters with a single transaction.

**Taxonomy covers 4+ practice areas:**
- **Labour & Employment:** Value is NOT deal value → Workforce scale, litigation count, operational risk
- **Corporate / M&A:** Value IS deal value → Transaction complexity, cross-border elements, financial magnitude
- **Banking & Finance:** Value IS financial exposure → Loan value, portfolio size, restructuring complexity
- **Disputes / Litigation:** Value is NOT claim amount → Precedent impact, constitutional dimension, multi-jurisdictional scope

**Each taxonomy includes:** hero_criteria, quality_labels, evaluation_dimensions, what_constitutes_flagship

**⚠️ When adding new practice areas, always add them to `practice_taxonomy.py` with practice-specific evaluation criteria.**

---

### 36. 🎛️ SETUP WIZARD FILTER PIPELINE — 5-Filter Context Flow (v10.0)
**Files:** `submissions/page.tsx`, `actions/submissions.ts`, `process-document/route.ts`, `nodes.py` (context_engine_node + analysis_node), `prompts.py` (dynamic placeholders), `submission-builder.ts` (directory router)

**What this documents:** The complete data flow from the 5 UI filter dropdowns in the Setup Wizard to the AI engine and DOCX export. Every filter the user selects in the Builder page ACTIVELY shapes the AI's behavior.

**The 5 filters and their full pipeline:**

| # | UI Filter | State Variable | Prisma Field | Python Context Key | AI Engine Usage |
|---|-----------|---------------|-------------|--------------------|-----------------|
| 1 | **TARGET DIRECTORY** | `targetDirectory` | `submission.targetDirectory` | `context.directory` | → `get_directory_config()` → loads ranking_unit (Band/Tier), terminology, quality_labels, lawyer_categories → `{{directory_context_block}}` injected into analysis + blueprint prompts → DOCX router selects Chambers or Legal 500 template |
| 2 | **GUIDE / REGION** | `guideRegion` | `submission.guideRegion` | `context.jurisdiction` | → `context_engine_node` uses for benchmark_reference ("Band X for [Practice] in [Jurisdiction]") → injected as `jurisdiction` in `strategic_context` → appears in DOCX Section A3 / Firm Information |
| 3 | **PRACTICE AREA** | `practiceArea` | `submission.practiceArea` | `context.practice_area` | → `get_practice_taxonomy()` loads practice-specific evaluation criteria → `{{practice_context_block}}` injected into prompts → RAG Router loads practice-specific knowledge files → DOCX Section A2 / Practice Area field |
| 4 | **CURRENT BAND** | `currentBand` | `submission.currentBand` | `context.current_status` | → `context_engine_node` classifies starting_position (Entry Candidate / Lower Tier / Upper Tier / Established) → determines `target_realistic` → shapes analysis framing ("maintain" vs "push for upgrade") |
| 5 | **DEADLINE** | `deadline` | `submission.deadline` | _(not sent to AI)_ | → Stored for user tracking only (UI shows "For your own tracking — does not affect AI analysis") |

**Detailed flow (lines 63-116 of process-document/route.ts):**
```
UI Dropdown Selection
  → submissions/page.tsx: state variables (targetDirectory, guideRegion, practiceArea, currentBand)
    → createSubmission() → Prisma: submission.targetDirectory, .guideRegion, .practiceArea, .currentBand
      → process-document/route.ts: builds context object:
          {
            directory: submission.targetDirectory,     // "Legal 500"
            jurisdiction: submission.guideRegion,       // "Latin America"
            practice_area: submission.practiceArea,     // "Labour & Employment"
            current_status: submission.currentBand      // "Unranked"
          }
        → Python API /process: receives as submission_context
          → context_engine_node: loads directory_config + practice_taxonomy
          → analysis_node: injects {{directory_context_block}} + {{practice_context_block}}
          → All prompts receive correct terminology dynamically
        → DOCX Export: submission.targetDirectory routes to correct template
```

**How each filter shapes the AI output:**

1. **Directory (Chambers vs Legal 500):** Changes ALL terminology — "Band" vs "Tier", "matter" vs "work highlight", section headers, DOCX template, header/footer branding
2. **Region (Latin America / Global / EMEA):** Changes benchmark references — "Firms at Band 2 for Corporate in Mexico" vs "...in Brazil" vs "...in Global"
3. **Practice Area (Labour / Corporate / Banking / Disputes):** Changes evaluation criteria — Labour uses workforce scale, Corporate uses deal value, Banking uses financial exposure
4. **Current Band (Unranked / Band 5 / Band 1):** Changes strategic framing — "Entry Candidate" gets "path to ranking" advice, "Band 1" gets "maintain dominance" advice

**⚠️ ALL 5 FILTERS ARE ALREADY FUNCTIONAL. If the user selects 'Legal 500' + 'Latin America' + 'Labour & Employment' + 'Unranked', the AI will:**
- Use "Tier" (not "Band")
- Reference Latin America benchmarks
- Evaluate by workforce scale (not deal value)
- Frame as "Entry Candidate"
- Generate Legal 500 DOCX template

**⚠️ NEVER add a new filter without tracing the full pipeline: UI → Prisma → Python context → AI usage → DOCX output.**

---

## 🔒 RAG KNOWLEDGE BASE — Global Files

These files are ALWAYS loaded for every submission (defined in `rag_router.py` → `global_files`):

| File | Purpose |
|------|---------|
| `editorial_constitution.txt` | 6 Constitutional Articles + Editorial Voice |
| `global lawyer leadership framework — rankpilot rag v1.txt` | Lawyer ranking methodology |
| `¿cómo rankeamos abogado_as__.txt` | Chambers ranking criteria (Spanish) |
| `volume_0_first_principles.txt` | 15 First Principles from owner's specification |
| `volume_ii_editorial_reasoning_engine.txt` | Editorial Reasoning Engine chapters |

**⚠️ NEVER remove files from `global_files` — they are the knowledge foundation.**

---

## 🔄 ITERATION CHECKLIST

Before ANY modification to the AI engine, verify:

- [ ] **Matter count preserved?** Input matters == Output matter evaluations
- [ ] **No matter physically removed from DOCX?** "exclude" = de-emphasis only
- [ ] **Epistemic language correct?** No "The firm lacks/depends/fails" in output
- [ ] **Probative validator intact?** Word count ≥ 75%, client names, values preserved
- [ ] **Language guard patterns untouched?** 85+ patterns in `language_guard.py`
- [ ] **Constitution injected in all 8 prompts?** Check `EDITORIAL_CONSTITUTION` references
- [ ] **JSON braces properly escaped?** `{{{{` in f-string prompts
- [ ] **`editorial_memory` field exists?** In `initial_state` in `state.py`
- [ ] **DOCX uses DXA widths?** Zero `WidthType.PERCENTAGE` instances
- [ ] **Reality Check text synced?** Same intro in `route.ts` AND `docx_generator.py`
- [ ] **Global RAG files intact?** 5 files in `rag_router.py` → `global_files`
- [ ] **DOCX Export Toggle intact?** Both `original` and `optimized` modes work via `?mode=` param
- [ ] **Hero Matter 7-Criteria preserved?** Selection uses editorial thesis, not word count
- [ ] **Evidence Inference Rule intact?** AI doesn't ask for info already in the submission
- [ ] **State of Play diagnostic present?** `the_state_of_play` diagnoses, not summarizes
- [ ] **Narrative Transformations format?** Before → After rewriting plan (3 items)
- [ ] **Reasoning Trace flows to frontend?** `reasoning_trace` field in state and response
- [ ] **Strategic Client Relationship rule injected?** `STRATEGIC_CLIENT_RELATIONSHIP_RULE` in 4 prompts
- [ ] **Evidence vs Prose rule injected?** `EVIDENCE_VS_PROSE_RULE` in 4 prompts
- [ ] **Benchmark quantification in reality_check?** Every observation has band + benchmark number + submission number
- [ ] **Evidence List Detector active?** Numeric counts + SCR signals + entity preservation checks in nodes.py
- [ ] **Language Guard at 131+ patterns?** Count tuples in `language_guard.py`
- [ ] **Directory Router intact?** Chambers vs Legal 500 dispatching works in `submission-builder.ts`
- [ ] **Legal 500 template renders correctly?** Title, sections, headers, footers all say "Legal 500"
- [ ] **Confidentiality Guardrail enforced at 3 layers?** Extraction prompt + extraction node lock + analysis node validation
- [ ] **Publish status is immutable?** Non-publishable matters NEVER appear in publishable sections of DOCX
- [ ] **Full universe counts injected?** `total_unique_clients`, `total_unique_sectors`, `total_cross_border_count`, `total_team_members` in analysis input
- [ ] **Anti-self-referential check?** AI doesn't recommend what the submission already demonstrates
- [ ] **Redundancy detection uses 6 dimensions?** Sector + work type + risk + scale + geography + unique dimension
- [ ] **Hero selection shows ALL candidates?** hero_selection_reasoning includes top 5 candidates + rejection reasons
- [ ] **Practice taxonomy loaded?** `get_practice_taxonomy()` returns correct taxonomy for the practice area
- [ ] **Directory context blocks injected?** `{{directory_context_block}}` and `{{practice_context_block}}` replaced in analysis + blueprint prompts

---

## 📅 COMMIT HISTORY (AI Engine changes only)

| Date | Commit | Version | Summary |
|------|--------|---------|---------|
| 2026-07-24 | `pending` | v10.0 | Directory-Aware Architecture: Directory Router, Confidentiality Guardrail, Full Universe Analysis, Anti-Self-Referential Diagnosis, Redundancy Detection, Hero Selection Transparency, Practice Taxonomy, Legal 500 DOCX template |
| 2026-07-24 | `4d675d2` | v9.0 | Owner Observations 24/7/2026: SCR Detection, Evidence vs Prose, Benchmark Quantification, Evidence List Detector, 34 new Language Guard patterns |
| 2026-07-23 | `b2e66df` | v8.1 | DOCX DXA width rewrite for Google Docs compatibility |
| 2026-07-23 | `eb06331` | v8.0 | Editorial Constitution — 6 surgical changes |
| 2026-07-21 | `9188aea` | v7.1 | Anti-Exclusion, Thesis Specificity, Practice Area Auto-Correction |
| 2026-07-21 | `322758d` | v7.0-fix | Quadruple-escape JSON braces in f-string |
| 2026-07-21 | `4eff6d9` | v7.0-fix | Add `editorial_memory` to initial_state |
| 2026-07-21 | `79547d7` | v7.0 | Epistemic Guardrails, Matter Accountability, Continuous Learning |
| 2026-07-20 | `8db70db` | v6.0 | Editorial Intelligence Overhaul — 14 owner feedback items |
| 2026-07-18 | `b6b0598` | v5.0 | Pipeline error persistence + partial data save |
| 2026-07-18 | `3f98af0` | v5.0 | Unicode safety + error UX blindaje |
| 2026-07-15 | `8f340e4` | v4.0 | Integrate Editorial Playbook Vol. V-VII |
| 2026-07-12 | `0b5c7b5` | v3.0 | Editorial Reasoning Engine — 14-node pipeline |
| 2026-07-10 | `12f2bec` | v2.0 | Chambers DOCX generator with exact template match |
| 2026-07-09 | `0e07f48` | v2.2 | Exact Chambers template + Strategic Report with AI depth |
