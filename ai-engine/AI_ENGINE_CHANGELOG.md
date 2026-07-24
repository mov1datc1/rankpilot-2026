# 🛡️ RANKPILOT AI ENGINE — ITERATION CHANGELOG & REGRESSION GUARD
## "NEVER DELETE WHAT WAS ALREADY FIXED"

> **Purpose:** This document tracks EVERY active rule, fix, and architectural decision in the AI engine.  
> Before ANY iteration, consult this list to ensure no previous fix is accidentally removed or contradicted.  
> Last updated: **2026-07-24** (v9.0 — Owner Observations 24/7/2026)

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

---

## 📅 COMMIT HISTORY (AI Engine changes only)

| Date | Commit | Version | Summary |
|------|--------|---------|---------|
| 2026-07-24 | `pending` | v9.0 | Owner Observations 24/7/2026: SCR Detection, Evidence vs Prose, Benchmark Quantification, Evidence List Detector, 34 new Language Guard patterns |
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
