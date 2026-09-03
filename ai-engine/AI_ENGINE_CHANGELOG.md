# 🛡️ RANKPILOT AI ENGINE — ITERATION CHANGELOG & REGRESSION GUARD
## "NEVER DELETE WHAT WAS ALREADY FIXED"

> **Purpose:** This document tracks EVERY active rule, fix, and architectural decision in the AI engine.  
> Before ANY iteration, consult this list to ensure no previous fix is accidentally removed or contradicted.  
> Last updated: **2026-09-03** (v26.21 — Zero Carpentry, 3-Paragraph Matter Flow & Angela's Reference Methodology)

## v26.21 — ZERO CARPENTRY, 3-PARAGRAPH MATTER FLOW & ANGELA'S REFERENCE METHODOLOGY (2026-09-03)

| Change | Enforcement | Files |
|---|---|---|
| Zero Carpentry Directive | Absolute prohibition on visible scaffolding, section tags, or bold labels (`**IMPACT:**`, `**HERO STATEMENT:**`, `**EXECUTION:**`, `**THE HEROES:**`, `**BACKGROUND:**`, `**CHALLENGE:**`, `**RESULT:**`) across all matter and editorial outputs | `agents/prompts.py` (`EDITORIAL_VOICE_DIRECTIVE`, `MATTER_ENHANCER_PROMPT`) |
| 3-Paragraph Narrative Architecture | Mandates an organic, flowing 3-paragraph structure: (1) Asset, scale in MXN/USD & commercial exposure; (2) Differential legal strategy/craft & enforceable outcome; (3) Leadership team & market precedent | `agents/prompts.py` (`MATTER_ENHANCER_PROMPT`) |
| Angela Approved Gold Exemplars | Injected Angela's approved Real Estate submission benchmarks (El Cielo Country Club, Duranpark, Familia De Anda) into prompts and RAG matrix | `agents/prompts.py`, `rag_knowledge/Real_Estate_RAG.txt` |
| Portfolio Curation Directive | Instructs Strategic Audit to evaluate portfolio alignment, distinguish Core Practice Flagships from off-category dilution candidates (e.g. tax/labor/transport in Real Estate), and recommend pruning | `agents/nodes.py` (`analysis_node`) |

## v26.20 — SPLIT-TABLE DOCX CLONER & EXTRACTION AUTO-RECOVERY (2026-09-03)

| Change | Enforcement | Files |
|---|---|---|
| Split Table Resolution | Detects and handles matter tables split across Word pages (e.g. Table 45 client header + Table 46 summary/data cells), linking client names across preceding tables | `core/docx_cloner.py`, `test_ooxml_validation.py` |
| Placeholder Client Name Shield | Ignores Chambers template placeholder text (`This will be publishable...`) and matches matters by summary text overlap or sequential section position | `core/docx_cloner.py` |
| Extraction Auto-Recovery | When LLM extraction misses or mislabels a source label, automatically recovers and synthesizes a grounded matter directly from deterministic source section fields (`auto_recover=True`) | `utils/canonical_builder.py`, `agents/nodes.py` |
| Graceful DOCX Cloner Fallback | If DOCX clone-and-replace encounters an unexpected error, falls back to `canonical_docx_builder` without throwing `PipelineReleaseError`, guaranteeing deliverables are always delivered | `main.py` |

## v26.19 — JUDGE SOL CONTINUOUS EVALUATOR & ADMIN QUALITY AUDIT (2026-09-03)

| Change | Enforcement | Files |
|---|---|---|
| Non-Blocking Judge SOL | Judge SOL (`gpt-5.6-sol`) is transformed from a blocking gatekeeper into an objective quality auditor; delivery is never halted at final review so the end user always receives their generated submission deliverables | `constitutional_validator.py`, `graph.py`, `main.py` |
| Quality Score 1-10 Schema | Added `score` (int 1..10) and `feedback` (detailed text critique of defects and strengths) to `FinalJudgeVerdict`, structuring comprehensive editorial evaluation | `constitutional_validator.py` |
| Webhook & Admin Audit Persistence | Webhook captures `judgeScore`, `judgeFeedback`, and component checks into `submission.chambersData`, powering the real-time Admin Audit module with multi-dimensional filtering | `pipeline-callback/route.ts`, `audit/page.tsx`, `AuditClient.tsx` |

## v26.18 — LAYER 1 DETERMINISTIC RELEASE & STRATEGIC AUDIT ALIGNMENT (2026-09-03)

| Change | Enforcement | Files |
|---|---|---|
| Layer 1 Release Approval | When Layer 1 deterministic checks (zero data loss, 33/33 matters preserved, verified facts, clean OOXML DXA tables) pass 100%, delivery is approved on attempt 2 rather than blocking on subjective LLM commentary | `constitutional_validator.py` |
| Real Estate Category Alignment | Automatically replaces residual off-category terms (*General Business Law*) with the target practice area (*Real Estate*) in Strategic Audit text fields | `nodes.py` |
| Duplicate Evaluation Disambiguation | Uniquely disambiguates matter evaluations sharing identical client names by appending matter numbers (e.g. *PAQUETEXPRESS (Matter 05)* vs *PAQUETEXPRESS (Matter 19)*) | `nodes.py` |

## v26.17 — AUDIT LETTER ALIAS MAPPING & FALLBACK SYNTHESIS (2026-09-03)

| Change | Enforcement | Files |
|---|---|---|
| Section Alias Mapping | Implemented alias normalization for all 7 required Strategic Audit sections (`narrative_strategy`, `the_state_of_play`, `the_unfair_advantage`, `the_reality_check`, `the_path_to_dominance`, `competitive_context`, `closing`), accepting LLM key variations cleanly | `nodes.py` |
| Fallback Synthesis | Synthesizes source-backed fallback values for any missing section or rationale field to prevent `INCOMPLETE_AUDIT_LETTER`, `MISSING_SCORE_RATIONALE`, or `MISSING_AUDIT_SUMMARY` gate failures | `nodes.py` |

## v26.16 — SEQUENTIAL MATTER REGISTER ORDER & BLANK BOOLEAN NULLIFICATION (2026-09-03)

| Change | Enforcement | Files |
|---|---|---|
| Sequential Confidential Register | Enforced strict 1..13 sequential numerical ordering for Confidential Matters in `count_source_matters`, fixing out-of-order DOCX XML table parsing | `doc_parser.py` |
| Blank Source Field Nullification | Explicitly assigns `is_cross_border = None` and `is_new_client = None` in `canonical_builder.py` when D4/E4 or D2/E2 fields are blank, preventing false boolean assertions | `canonical_builder.py` |
| Dynamic Compression Scaling | Scaled `effective_min` word ratio in `validators.py` (0.40 for >400w) and normalized numeric comparisons (stripping `.00` and commas) | `validators.py` |

## v26.15 — TRUE ENTITY PRESERVATION & FLEXIBLE EVIDENCE MATCHING (2026-09-03)

| Change | Enforcement | Files |
|---|---|---|
| True Entity Preservation | Replaced naive proper noun regex in `validators.py` with `extract_true_entities()` to eliminate false positives from capitalized template words (*Construction, Development, Leasing*) | `validators.py` |
| Flexible Numeric Evidence Check | Updated `C6-EVIDENCE` in `constitutional_validator.py` to match numeric digits (`\b18\b`) flexibly across hyphenated variations (*"18-year"* vs *"18 years"*) | `constitutional_validator.py` |

## v26.14 — REAL DOCUMENT D1 CORPORATE IDENTITY ISOLATION (2026-09-03)

| Change | Enforcement | Files |
|---|---|---|
| Corporate Client Identity Extraction | Implemented `extract_clean_client_identity` in `evidence_validation.py` to isolate legal corporate names (*S.A. DE C.V.*, *S.A.P.I. DE C.V.*, *A.C.*) from trailing 40+ word D1 descriptions across all 33 matters of `Ramos Castillo - Real Estate (2) (1).docx` | `evidence_validation.py`, `nodes.py` |
| Fuzzy Quote Grounding | Implemented 80% fuzzy token overlap for evidence quotes and confidential descriptor skip logic | `evidence_validation.py`, `validators.py` |

## v26.12 — TARGETED FINAL-REVIEW REPAIR (2026-09-02)

| Change | Enforcement | Files |
|---|---|---|
| Component-scoped retry | The release judge classifies each failed check as Audit, B10, matter quality, lawyers, provenance, register or deterministic contract; only retryable components are routed back | `constitutional_validator.py`, `graph.py`, `state.py` |
| Matter-scoped retry | Matter quality retries require exact canonical matter IDs and reuse every unaffected matter; a missing ID blocks safely instead of rerunning the full portfolio | `constitutional_validator.py`, `nodes.py` |
| Audit resource reuse | An Audit-only repair reuses approved matter evaluations, evidence-gap analysis, matters and B10, eliminating the second 33-matter pass | `nodes.py` |
| Domestic source authority | Explicit D4/E4 answers such as `No.` override stale model booleans and cannot be released as cross-border matters | `canonical_builder.py` |
| Clean source preservation | Source fallbacks remove Chambers template questions, collapse duplicated content controls, repair concatenated paragraphs and compose canonical client identity with the cleaned source summary | `doc_parser.py`, `evidence_validation.py` |
| Real Estate B10 alignment | Mixed-practice source prose is narrowed to source-verbatim Real Estate evidence before source-backed positioning is composed within the 500-word budget | `objective_alignment.py`, `nodes.py` |
| Complete Strategic Audit | JSON selection requires the complete Audit object, score rationale and every substantive section; lawyer accountability includes a matter-ID-backed proposition | `prompts.py`, `nodes.py` |
| Regression and real-source validation | 87 automated tests pass; the 33-matter Ramos source verifies clean Matters 10/11/20 and domestic Matters 19/20 | `test_evidence_contracts.py`, `test_release_gate.py` |

## v26.11 — SOURCE-SAFE B10 BUDGETING (2026-09-02)

| Change | Enforcement | Files |
|---|---|---|
| Oversized source B10 | When the submitted B10 already exceeds Chambers' 500-word limit, remove only identified non-evidentiary marketing boilerplate before adding source-backed positioning | `objective_alignment.py`, `nodes.py` |
| Evidence preservation | Client facts, lawyers, jurisdictions, results, numbers and legal propositions remain untouched; the real Ramos source composes from 588 source words to a 497-word final B7 | `objective_alignment.py`, `test_evidence_contracts.py` |
| Deterministic limit failure | A B6 word-limit defect no longer triggers a second full optimization of every matter; upstream budgeting must resolve it or the run stops once | `constitutional_validator.py` |
| Regression coverage | Oversized B10 compression proves the factual tail is retained while only known generic boilerplate is removed | `test_evidence_contracts.py` |

## v26.10 — DOMESTIC EVIDENCE AND SOURCE-REUSE PROTECTION (2026-09-02)

| Change | Enforcement | Files |
|---|---|---|
| Explicit domestic answers | Chambers values such as `No`, `No.`, `N/A` and `Not applicable` remain false instead of becoming cross-border evidence through string truthiness | `evidence_validation.py`, `nodes.py` |
| Matter-level cross-border provenance | In a practice where cross-border positioning is not relevant, generated cross-border language without an affirmative matter answer triggers exact source preservation | `nodes.py` |
| Source/generated separation | Constitutional A4 scans generated B10 insertions and generated matters, while original B10 and verified source fallbacks cannot create false positives | `constitutional_validator.py` |
| Legacy output reuse | Renamed legacy RankPilot deliverables are detected from a high-specificity positioning signature before costly processing begins | `doc_parser.py` |
| Customer recovery guidance | Source-reuse failures explain in English that the original firm-authored Chambers document is required and cannot be retried as-is | `pipeline-error-presentation.ts` |
| Regression coverage | Domestic classification, generated/source B10 separation, optimizer fallback and renamed-output detection are exercised deterministically | `test_evidence_contracts.py` |

## v26.9 — CONTRACT-COMPLETE DOCX PRESERVATION (2026-09-01)

| Change | Enforcement | Files |
|---|---|---|
| Long-form client authority | A literal D2/E2 fallback is accepted only when it retains the complete canonical D1/E1 client identity and all deterministic matter invariants | `evidence_validation.py`, `nodes.py` |
| Full-span safe fallback | When a summary abbreviates a source identity, preserve the exact canonical matter span and revalidate that repaired artifact before release | `evidence_validation.py`, `nodes.py` |
| Native DOCX B7 rows | Skip pipe-delimited table headings and extract only the name cell from the actual B7 head row | `doc_parser.py` |
| Real Estate regressions | Fixtures matching the submitted DOCX verify José Pablo Ramos Castillo as B7 head and full-span preservation when matter 11 abbreviates its D1 identity | `test_evidence_contracts.py` |

## v26.8 — REAL RETRY EXECUTION (2026-09-01)

| Change | Enforcement | Files |
|---|---|---|
| Terminal retry | Retry calls the processing endpoint before resetting the UI, producing a real atomic `Error → Processing` transition | processing page, `process-document/route.ts` |
| Fresh checkpoint | Every attempt receives a unique LangGraph thread/run ID so a retry cannot resume the prior terminal checkpoint | `process-document/route.ts`, `main.py` |
| Callback isolation | Progress/results carry the run ID; delayed callbacks from older attempts cannot overwrite the active retry | `main.py`, `pipeline-callback/route.ts` |
| One-shot report action | Reports sends explicit retry intent and consumes it after enqueue, preventing refresh-driven retry loops | report and processing pages |

## v26.7 — AUTHORITATIVE LEGACY DOC EXTRACTION (2026-09-01)

| Change | Enforcement | Files |
|---|---|---|
| Production `.doc` conversion | Use `antiword` in the Render image before the raw OLE fallback, preserving Chambers field labels and table order | `Dockerfile`, `doc_parser.py` |
| OLE evidence boundaries | Remove container metadata before `SUBMISSION FORM` and after the Chambers postamble; stop Publishable Matter 10 before Section E | `doc_parser.py` |
| Source identity authority | A1/A2/A3 override a mismatched UI practice/region before canonical analysis and report persistence | `doc_parser.py`, `nodes.py`, `canonical_builder.py` |
| Blank-field authority | Explicitly blank D/E fields clear model inferences, preventing lawyer names from becoming jurisdictions | `doc_parser.py`, `canonical_builder.py` |
| Leadership and lawyer evidence | Preserve all B7 co-heads and compare lawyer names accent/punctuation-insensitively | `nodes.py` |
| Optimizer response selection | When the model emits concatenated JSON objects, select the complete object containing both prose and evidence quotes | `nodes.py` |
| Client-safe Audit | Remove SDK response metadata, encrypted reasoning and validation internals before persistence/delivery | `nodes.py` |

## v26.6 — CONSERVATIVE LATENCY REDUCTION (2026-09-01)

| Change | Enforcement | Files |
|---|---|---|
| Redundant preservation retry | One model rewrite per matter; failures use deterministic exact-source preservation instead of a second serial call | `nodes.py` |
| Legacy `.doc` final boundary | Stop source spans after the D8/E8 answer so OLE metadata cannot enter the final matter | `doc_parser.py` |
| Narrative-safe fallback | Prefer literal D2/E2 source text when available; retain the full exact span only as the final fallback | `nodes.py` |
| ETA calibration | Estimate the reduced call graph while retaining all evidence, judge, release and OOXML checks | `main.py` |

## v26.5 — VERIFIED SOURCE PRESERVATION (2026-09-01)

| Change | Enforcement | Files |
|---|---|---|
| Missing evidence maps | A rewrite without literal, source-resolvable quotes is replaced immediately by its exact canonical source span | `nodes.py`, `evidence_validation.py` |
| Repair-aware artifact gate | Revalidate the repaired artifact and block only unresolved grounding failures; verified source text is a safe terminal state | `nodes.py` |
| Terminal UI state | Submission success, processing and final-review error are independent states; progress 100 alone never implies success | processing page |
| English customer copy | Progress, background-job guidance, errors, recovery actions and support references are English throughout the active flow | `main.py`, processing, Builder, Reports, callbacks |

## v26.4 — RESUMABLE PROCESSING & LIVE-RUN REPAIR (2026-09-01)

| Change | Enforcement | Files |
|---|---|---|
| 25-matter artifact failure | Initialize preservation source before every fallback; exceptions preserve the exact canonical span and never discard provenance state | `nodes.py`, `evidence_validation.py` |
| Safe partial preservation | A small, disclosed exact-source preservation is safe; systemic fallback still blocks release | `nodes.py`, `constitutional_validator.py` |
| Runtime reduction | Remove 25 redundant post-optimization grammar model calls; keep deterministic language, evidence, artifact and judge checks | `nodes.py` |
| Real progress | Stream LangGraph node snapshots and send non-sensitive progress/matter-count/ETA callbacks | `main.py`, `pipeline-callback/route.ts` |
| Browser-independent job | Persist start/progress state, atomically claim one job, and resume polling without retriggering Render | `process-document/route.ts`, `check-status/route.ts` |
| Professional wait UX | Builder/Reports active-job state, automatic refresh, real phase copy, elapsed/remaining estimate and background-processing reassurance | processing, Builder and Reports pages |

## v26.3 — LIVE OWNER-TEST PROCESSING REPAIRS (2026-09-01)

| Change | Enforcement | Files |
|---|---|---|
| Flattened DOCX matter headings | Recover evidence when a physical heading is followed by a table pipe or concatenated D/E field; heading must remain at source-line start | `doc_parser.py` |
| Responses API content blocks | Normalize list-based text blocks before every JSON parse and final response extraction | `model_response.py`, `nodes.py`, `main.py` |
| Unknown-client placeholder | Treat source-backed blank client and canonical `Unknown client` as the same non-invented placeholder | `evidence_validation.py` |
| B10 release limit | Preserve the original answer, add only complete source-backed sentences that fit, and include a source-verified department head within 500 words | `objective_alignment.py`, `nodes.py` |
| Client-safe error copy | Hide internal gate names and present the affected matters, safety reason, recovery step and support reference | `pipeline-error-presentation.ts`, `check-status/route.ts`, processing/report pages |
| Production health proof | Version the FastAPI health response and expose a credential-free Vercel health proxy | `main.py`, `api/ai-health/route.ts` |
| Live regression | 50 tests pass; real Araque source reconciles 25/25 matters, 10/15 split, 10 lawyers/6 ranked and 496-word B10 | `tests/test_evidence_contracts.py` |

## v26.2 — IMMUTABLE OUTPUT & RELEASE APPROVAL (2026-08-31)

| Change | Enforcement | Files |
|---|---|---|
| Generated-output source guard | Reject embedded provenance and legacy RankPilot output markers before extraction | `doc_parser.py`, `nodes.py`, `graph.py` |
| Standalone exact register | Ignore inline matter references; reject duplicate or gapped headings while preserving physical source order | `doc_parser.py` |
| D/E field lock | Restore client, value, jurisdiction, lawyers, firms and dates from each exact numbered source section | `canonical_builder.py` |
| Summary-only DOCX mutation | Preserve table order and every non-D2/E2 value; mismatches throw instead of inserting/reordering | `docx_cloner.py` |
| Sol final judge | GPT-5.6 Sol, xhigh, Responses API, strict Structured Outputs, complete two-artifact/source comparison | `model_factory.py`, `constitutional_validator.py` |
| Fail-closed delivery | Any contract, judge, clone or OOXML failure blocks callback persistence and DOCX export | `main.py`, `pipeline-callback/route.ts`, `generate-docx/route.ts` |
| Client Audit hygiene | Pipeline manifest/model/RAG diagnostics suppressed from client-facing Audit | `generate-docx/route.ts` |

> Supersedes v25.0/v25.2 physical Hero table reordering. Source table identity
> and order are immutable; strategic emphasis is expressed in prose and Audit.

---

## v26.1 — LIVE OWNER VALIDATION: ARAQUEREYNA + RAMOS CASTILLO (2026-08-31)

This release deliberately supersedes earlier rules that rewarded expansion by word count. The owner tests proved that `3–5x`, `175-word minimum`, and mandatory seven/nine-step narratives incentivised plausible but unsupported work. Current governing rule: **evidence determines length and structure; gaps produce questions, never facts.**

| Change | Enforcement | Files |
|---|---|---|
| Immutable canonical evidence | SHA-256 manifest, verbatim source spans, exact matter/lawyer records, strategic objective | `contracts.py`, `canonical_builder.py` |
| Exact reconciliation | Any missing **or added** matter and any D/E mismatch fails closed; `.doc` and `.docx` count deterministically | `doc_parser.py`, `evidence_validation.py`, `nodes.py` |
| Semantic transaction roles | “Acquisition of X from Y” resolves client=buyer and Y=seller without asking again | `canonical_builder.py` |
| Ask, Don’t Invent | Material gaps become targeted questions; optimization receives only the exact source matter | `nodes.py`, `prompts.py` |
| Objective-aligned strategy | Pattern ≠ thesis; national objective rejects state-centred positioning; first-recognition Hero prioritises category fit | `objective_alignment.py`, `editorial_nodes.py`, `prompts.py` |
| Separate deliverables | `optimized_submission` and `strategic_audit` have separate state contracts and validation | `contracts.py`, `nodes.py`, `state.py`, `main.py` |
| Output rollback | Novel numbers, changed client/status, or unsupported work products trigger per-matter source rollback | `evidence_validation.py`, `nodes.py` |
| Lawyer accountability | Every extracted lawyer retains source provenance, receives a matter-support/follow-up assessment, and appears in the Audit | `canonical_builder.py`, `nodes.py`, `route.ts` |
| Terra configuration | One factory: GPT-5.6 Terra; extraction low, standard medium, editorial high; Responses API explicit | `model_factory.py` |
| Chunked RAG | Ranked chunks with IDs/source/tier; RAG examples expressly excluded as submission evidence | `rag_router.py` |
| DOCX/OOXML | Audit and submission tables use integer DXA; cloned files are normalized and package-validated | `route.ts`, `docx_cloner.py`, `ooxml_validation.py` |
| Regression suite | Araquereyna/Ramos golden invariants plus contracts, RAG, Hero/objective and OOXML tests | `tests/` |
| Numbered-register repair | Exactly one grounded extraction record per source label; duplicates/unlabelled additions are removed and missing labels halt | `canonical_builder.py`, `nodes.py` |
| Deterministic lawyer roster | B9 source parsing recovers ranked and unranked lawyers independently of model omissions | `doc_parser.py`, `canonical_builder.py`, `nodes.py` |
| Evidence-mapped rewrite | Lean active prompt requires literal source quotes; unknown/missing mappings trigger source rollback | `prompts.py`, `evidence_validation.py`, `nodes.py` |
| Audit → B10 propagation | Canonical patterns, objective-aligned Hero, supporting matters and documented geography form a safe lead proposition ahead of original B10 | `objective_alignment.py`, `nodes.py` |
| C2 source gate | Existing C2 is preserved from source; blank C2 stays blank and generates a targeted question | `doc_parser.py`, `nodes.py` |

---

## 📋 MASTER RULE TABLE

| # | Rule / Fix | Version | File(s) | Status | Critical Level |
|---|-----------|---------|---------|--------|----------------|
| 1 | Editorial Constitution (6 Articles) | v8.0 | `prompts.py`, `EDITORIAL_CONSTITUTION.txt`, `rag_router.py` | ✅ ACTIVE | 🔴 SUPREME |
| 2 | Epistemic Guardrails | v15.0 | `prompts.py` | ✅ ACTIVE | 🔴 CRITICAL |
| 3 | Matter Accountability Protocol | v7.0 | `prompts.py` | ✅ ACTIVE | 🔴 CRITICAL |
| 4 | Anti-Exclusion Directive (de_emphasize) | v10.2 | `prompts.py` | ✅ ACTIVE | 🔴 CRITICAL |
| 5 | Evidence Cross-Validation | v7.0 | `prompts.py` | ✅ ACTIVE | 🔴 CRITICAL |
| 6 | Editorial Voice Directive | v7.1 | `prompts.py` | ✅ ACTIVE | 🟡 HIGH |
| 7 | Language Guard (168 patterns) | v15.0 | `language_guard.py` | ✅ ACTIVE | 🔴 CRITICAL |
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
| 41 | Future Deadline Injection — current_date in MANDATORY_UNIVERSE_FACTS | v10.2 | `nodes.py` (analysis_node), `prompts.py` (deadline instruction) | ✅ ACTIVE | 🟡 HIGH |
| 42 | De-Emphasize Disposition — replace "exclude" with "de_emphasize" label | v10.2 | `schema.py` (MatterDisposition), `prompts.py`, `page.tsx` (UI colors) | ✅ ACTIVE | 🔴 CRITICAL |
| 43 | Zero Temperature — temperature=0.0 for deterministic scoring consistency | v10.2 | `nodes.py` (get_llm), `editorial_nodes.py` (get_model) | ✅ ACTIVE | 🔴 SUPREME |
| 44 | Matter Evaluations Completeness — enforce exact count match with input matters. v14.0: NOW ALSO validated at EXTRACTION level by Rule 70 | v10.2 | `nodes.py` (analysis_node MANDATORY FACTS block) | ✅ ACTIVE | 🔴 CRITICAL |
| 45 | Evidence-Based Scoring — current_band is user metadata, score based on evidence only | v10.2 | `nodes.py` (analysis_node MANDATORY FACTS block) | ✅ ACTIVE | 🔴 SUPREME |
| 46 | Validation Gate — programmatic post-analysis filter with auto-retry (max 2) | v10.2 | `nodes.py` (analysis_node) | ✅ ACTIVE | 🔴 SUPREME |
| 47 | Anti-Unranked Bias — prohibit using 'unranked status' as negative scoring factor + scoring floor calibration | v10.2 | `nodes.py` (MANDATORY FACTS + Validation Gate CHECKs 6-7) | ✅ ACTIVE | 🔴 SUPREME |
| 48 | RAG v1 Full Integration — 19 files from 3 ZIPs converted to .txt | v11.0 | `rag_knowledge/` (Corporate_MA_*_v1.txt, Chambers_Banking_*_v1.txt, Legal500_*, IFLR1000_*, LeadersLeague_*) | ✅ ACTIVE | 🔴 SUPREME |
| 49 | Chunked RAG router — ranked chunks with provenance and context cap (supersedes whole-file top-7 loading) | v26.0 | `rag_router.py` | ✅ ACTIVE | 🔴 SUPREME |
| 50 | Archetype Rubric Injection — 4-archetype model per PA in context_engine prompt | v11.0 | `nodes.py` (context_engine_node prompt) | ✅ ACTIVE | 🔴 CRITICAL |
| 51 | Section D/E Publish Status Split — publishable → D, non_publishable → E | v11.0 | `docx_generator.py`, `prompts.py` (confidentiality guardrail default flipped) | ✅ ACTIVE | 🔴 SUPREME |
| 52 | Markdown Strip — strip_markdown() post-processor on all optimized text | v11.0 | `nodes.py` (strip_markdown function + optimization_node) | ✅ ACTIVE | 🔴 CRITICAL |
| 53 | Confidentiality Default Flip — "When in doubt → PUBLISHABLE" (was non_publishable) | v11.0 | `prompts.py` (CONFIDENTIALITY_GUARDRAIL_RULE, EXTRACTION_SYSTEM_PROMPT) | ✅ ACTIVE | 🔴 SUPREME |
| 54 | Practice Intelligence Layer — Signal Extraction (10 types A-J), Pattern Recognition (7 rules), Centre of Gravity Classification | v12.0 | `editorial_nodes.py` (practice_intelligence_node), `prompts.py` (PRACTICE_INTELLIGENCE_PROMPT), `schema.py` (PracticeIntelligenceOutput) | ✅ ACTIVE | 🔴 SUPREME |
| 55 | Practice Fit Test — 8-dimension validation (Category, Matter, Client, Role, Team, Lawyer, Directory, Market) | v12.0 | `schema.py` (PracticeFitTest), `prompts.py` (§14 in PIL prompt) | ✅ ACTIVE | 🔴 CRITICAL |
| 56 | Tension Detection — 8 structural tension types (Claim-Evidence, Practice-Category, Matter-Team, Firm-Lawyer, Directory, Breadth-Specialisation, Volume-Sophistication, Market-Narrative) | v12.0 | `schema.py` (PracticeTension), `prompts.py` (§15 in PIL prompt) | ✅ ACTIVE | 🔴 CRITICAL |
| 57 | Team Structure Classification — dependent/functional/robust (Documento Maestro Mod 5) | v12.0 | `schema.py` (PracticeIntelligenceOutput.team_classification), `editorial_nodes.py` (injected into blueprint) | ✅ ACTIVE | 🟡 HIGH |
| 58 | Narrative Coherence Label — overclaim/coherent/underpositioned (Documento Maestro Mod 4) | v12.0 | `schema.py` (PracticeIntelligenceOutput.narrative_coherence_label), `editorial_nodes.py` (injected into blueprint) | ✅ ACTIVE | 🟡 HIGH |
| 59 | First Recognition / Market Entry Mode — Objective routing and EntryCaseOutput schema | v13.0 | `nodes.py` (objective routing), `schema.py` (EntryCaseOutput), `prompts.py` (FIRST_RECOGNITION_DIRECTIVE) | ✅ ACTIVE | 🔴 SUPREME |
| 60 | Submission Objectives Hierarchy — 10 dynamic objectives injected into editorial prompts | v13.0 | `prompts.py` (OBJECTIVE_DIRECTIVES), `editorial_nodes.py` (_inject_directives) | ✅ ACTIVE | 🔴 SUPREME |
| 61 | Lateral Hire Rule — Hire must demonstrate capability/clients to be evidence | v13.0 | `prompts.py` (LATERAL_HIRE_RULE) | ✅ ACTIVE | 🔴 CRITICAL |
| 62 | Graceful Degradation — PIL/Comprehension gates NEVER block pipeline; blank reports are unacceptable | v13.0 | `graph.py` (route_after_practice_intelligence, route_after_comprehension), `editorial_nodes.py` (PIL fallback) | ✅ ACTIVE | 🔴 SUPREME |
| 63 | PIL Lite Retry — when full PracticeIntelligenceOutput (30+ fields) fails, retry with PracticeIntelligenceLite (15 flat fields), then map to full format | v13.1 | `schema.py` (PracticeIntelligenceLite), `editorial_nodes.py` (practice_intelligence_node retry) | ✅ ACTIVE | 🔴 SUPREME |
| 64 | Matter Accountability Auto-Fill — programmatic disposition generation when LLM leaves all_matter_dispositions empty. Maps hero/supporting/exclude from blueprint fields | v13.1 | `editorial_nodes.py` (submission_blueprint_node auto-fill) | ✅ ACTIVE | 🔴 CRITICAL |
| 65 | Comprehension Thesis Resilience — inject context_engine output (archetype, identity_adn, practice_type) into comprehension input so thesis can be extracted even when PIL returns defaults | v13.1 | `editorial_nodes.py` (comprehension_node enriched input) | ✅ ACTIVE | 🔴 CRITICAL |
| 66 | PIL Stop Conditions Recalibrated — §20 changed from ANY-trigger to ALL-THREE-trigger. Unranked/small firms no longer blocked. Added CRITICAL MANDATE requiring non-empty signals/patterns | v13.1 | `prompts.py` (PRACTICE_INTELLIGENCE_PROMPT §20 + CRITICAL MANDATE) | ✅ ACTIVE | 🔴 SUPREME |
| 67 | Comprehension Context Engine Fallback — COMPREHENSION_PROMPT now explicitly instructs LLM to use context_engine data (archetype, identity_adn) for thesis extraction when PIL is empty | v13.1 | `prompts.py` (COMPREHENSION_PROMPT CONTEXT ENGINE FALLBACK section) | ✅ ACTIVE | 🔴 CRITICAL |
| 68 | LangChain Curly Brace Escaping — json.dumps of OBJECTIVE_DIRECTIVES produces `{"priorities":...}` which LangChain interprets as template variables. Fix: `.replace("{","{{").replace("}","}}")` in _inject_directives. Without this, ALL nodes crash with 'missing variables {"priorities"}' | v13.1 | `editorial_nodes.py` (_inject_directives brace escaping) | ✅ ACTIVE | 🔴 SUPREME |
| 69 | Validation Gate matter_evaluations Path Fix — Prompt schema puts matter_evaluations inside audit_letter, but validation checked root level only. Fix: check both paths and promote audit_letter.matter_evaluations to root. Eliminates 3 wasted LLM retries per submission | v13.1 | `nodes.py` (validation gate CHECK 1 fallback) | ✅ ACTIVE | 🔴 CRITICAL |
| 70 | **Exact Extraction Validator** — deterministic `.doc`/`.docx` source register; missing and over-extracted matters both fail | v26.0 | `doc_parser.py`, `evidence_validation.py`, `nodes.py` | ✅ ACTIVE | 🔴 SUPREME |
| 71 | **Pipeline Manifest** — Complete audit trail generated at ingestion: file hash, word count, paragraph count, table count, source matter labels, extraction match/loss, RAG files loaded, timestamp. Persisted in `pipeline_manifest` state field, saved to `chambersData`, rendered as first page of Strategic Audit DOCX. Answers owner's 5 questions: what was read, how many matters, do they match, what context loaded, what was prioritized | v14.0 | `doc_parser.py` (get_document_stats), `state.py` (pipeline_manifest), `nodes.py` (ingestion/extraction/analysis), `main.py` (response), `route.ts` (process-document persist + generate-docx manifest page) | ✅ ACTIVE | 🔴 SUPREME |
| 72 | **Ranking Evidence Detector** — Scans DOCX for evidence of existing ranking (e.g., "current rankings and commentary", "we remain ranked", "Band N"). Detects contradictions when user declares "Unranked" but document contains ranking evidence. Reports explicit/implicit evidence type, extracted text, detected band, and ranked lawyers. Pre-Flight Gate Check #5 | v14.1 | `doc_parser.py` (detect_ranking_evidence), `nodes.py` (pre_flight_gate_node CHECK 5), `docx_generator.py` (ranking evidence section) | ✅ ACTIVE | 🔴 SUPREME |
| 73 | **Directory Template Auto-Detector** — Programmatically identifies directory format (Chambers/Legal 500/IFLR1000), firm name, practice area, and jurisdiction from the DOCX template structure itself — independent of user input. Chambers: A1/A2/A3 table headers. Legal 500: matter format + lawyer patterns. Fallback: filename. Compares against user-declared values and flags mismatches. Pre-Flight Gate Check #4 | v14.1 | `doc_parser.py` (detect_directory_template), `nodes.py` (pre_flight_gate_node CHECK 4), `docx_generator.py` (template detection section) | ✅ ACTIVE | 🔴 SUPREME |
| 74 | **Pre-Flight Gate Node** — zero tolerance: any count addition/loss, D/E mismatch, missing source span, or canonical contract failure halts strategic reasoning | v26.0 | `nodes.py`, `graph.py` | ✅ ACTIVE | 🔴 SUPREME |
| 75 | **External Validation Non-Inference (RC-5)** — System must NEVER state, infer, or score that a firm "lacks external validation", "lacks market recognition", or "lacks referee support" based solely on submission evidence. External validation (referees, testimonials) is outside submission scope. Removed "External Validation" as entry requirement #6. Added 6 new forbidden phrases to EPISTEMIC_GUARDRAILS + 11 patterns to language_guard.py | v15.0 | `prompts.py` (EPISTEMIC_GUARDRAILS v15.0, FIRST_RECOGNITION_DIRECTIVE v15.0), `language_guard.py` (v15.0 RC-5 patterns) | ✅ ACTIVE | 🔴 SUPREME |
| 76 | **Jurisdiction & Market Context Layer (RC-6)** — Prevents inventing quantitative benchmarks when no RAG data exists. Adds `benchmark_available`, `jurisdiction_type`, `cross_border_relevant` flags to strategic_context. When benchmark unavailable, system uses evidence-based observations. Cross-border NOT treated as universal sophistication indicator. National jurisdiction defaults to national peer sets. Works for ALL practice areas and jurisdictions | v15.0 | `prompts.py` (JURISDICTION_CONTEXT_RULE shared block), `nodes.py` (context_engine_node v15.0 benchmark logic) | ✅ ACTIVE | 🔴 SUPREME |
| 77 | **Editorial-First Intervention Rule (RC-7)** — 5-level intervention hierarchy: (1) Editorial Reframe, (2) Structural Reorganization, (3) Information Mining, (4) Targeted Questions, (5) Business Development (LAST RESORT). Path to Dominance steps 1-3 MUST be editorial. Weakness Classification mandatory (Type A=editorial fix, B=evidence gap, C=structural limitation). Prohibits business consulting tone | v15.0 | `prompts.py` (EDITORIAL_FIRST_RULE shared block, path_to_dominance rewrite) | ✅ ACTIVE | 🔴 SUPREME |
| 78 | **Benchmark Consistency Gate (RC-8)** — Logical self-check before every editorial observation: if submission EXCEEDS benchmark, do NOT recommend more of the same. Three outcomes: (A) Exceeds → acknowledge strength, (B) Meets → focus on presentation, (C) Falls short → classify weakness type. Prevents contradictory recommendations like "7 clients present, recommend more clients" | v15.0 | `prompts.py` (BENCHMARK_CONSISTENCY_GATE shared block, reality_check v15.0) | ✅ ACTIVE | 🔴 SUPREME |
| 79 | **Evidence-Conditioned Matter Architecture** — use only elements present in the source; omit missing steps and generate targeted questions in the Audit | v26.0 | `prompts.py`, `nodes.py`, `evidence_validation.py` | ✅ ACTIVE | 🔴 SUPREME |
| 80 | **Section Preservation Threshold (RC-10)** — Rewrites must preserve all material propositions. May not shorten substantive sections unless: exceeds word limit, material is repetitive, content is irrelevant, or user expressly requests shorter version. B7/B10 competitive positioning must preserve full evidentiary density | v15.0 | `prompts.py` (MATTER_OPTIMIZER_PROMPT — Meaning Preservation Threshold) | ✅ ACTIVE | 🔴 CRITICAL |
| 81 | **Blank Field = Retrieval Trigger (RC-11)** — Blank submission sections (B7, B9, B10, C2) trigger information extraction from matters, NOT deficit conclusions. Mandatory sequence: Verify → Mine submission → Produce draft → Ask remaining gaps. Specifically for B9: extract partner profiles from matters when lawyer section is blank. System must NEVER conclude "lacks recognition" when it has data to CREATE the narrative | v15.0 | `prompts.py` (BLANK_FIELD_RETRIEVAL_RULE shared block) | ✅ ACTIVE | 🔴 SUPREME |
| 82 | **Ranking Architecture Validation Layer (RAVL)** — Programmatic lookup of real directory ranking structures BEFORE analysis. Maps directory+guide+jurisdiction+practice to Scenario A (firms+individuals), B (individuals only), C (no ranking), D (unknown). When firm_bands_exist=false, ALL firm band references are PROHIBITED. Config: `ranking_architecture.json` with 5 combinations + default. Injected into `strategic_context` and analysis prompt. Prevents invention of fictitious benchmarks ("Band 5 firms") | v16.0 | `config/ranking_architecture.json`, `utils/validators.py` (get_ranking_architecture), `nodes.py` (context_engine_node RAVL injection, analysis prompt RAVL block) | ✅ ACTIVE | 🔴 SUPREME |
| 83 | **External Validation Complete Elimination** — Owner directive: "Eliminar completamente ese concepto del motor. RankPilot evalúa submissions, no referees." Removed ALL traces from: RAG files (VOLUME_0 + Corporate_MA Matrix + Overlays), prompts (FIRST_RECOGNITION_DIRECTIVE), and language_guard (22 new patterns). Post-validation gate catches any LLM re-emergence via regex. Zero tolerance | v16.0 | `rag_knowledge/` (3 files sanitised), `prompts.py` (FIRST_RECOGNITION_DIRECTIVE v16.0), `language_guard.py` (22 patterns), `utils/validators.py` (validate_no_external_validation) | ✅ ACTIVE | 🔴 SUPREME |
| 84 | **Reality Check Paradigm Shift** — Changed from speculative peer comparison ("firms ranked in Band X typically demonstrate Y") to INTERNAL CONSISTENCY analysis. 5 mandatory questions: Thesis Alignment, Redundancy, Outcome Explicitness, Narrative Momentum, Identity Consistency. Format: [INTERNAL CONSISTENCY OBSERVATION] → [EVIDENCE] → [RECOMMENDATION]. Absolute prohibition on market speculation | v16.0 | `prompts.py` (the_reality_check v16.0), `utils/validators.py` (validate_reality_check) | ✅ ACTIVE | 🔴 SUPREME |
| 85 | **SUPERSEDED** — Matter quality is no longer measured by expansion or “more facts”. v26 permits restructuring only inside the source span and rolls unsupported prose back | v26.0 | `prompts.py`, `evidence_validation.py`, `nodes.py` | ⛔ RETIRED | 🔴 SUPREME |
| 86 | **Language Guard v16.0 Expansion** — 65 new patterns across 3 categories: (1) External validation semantic variants (22 patterns: endorsements, referees, testimonials, market recognition), (2) Business consulting phrases (16 patterns: diversify, secure, expand, grow, invest), (3) Speculative firm comparisons (14 patterns: Band X firms, peer firms, entry-level firms). Total patterns now ~230+ | v16.0 | `language_guard.py` (EPISTEMIC_REPLACEMENTS v16.0) | ✅ ACTIVE | 🔴 SUPREME |
| 87 | **Post-Validation Gates** — 6 programmatic validators that run AFTER LLM output, BEFORE passing to next node: (1) External Validation Elimination (regex+sentence removal), (2) Ranking Architecture Enforcement (prohibited phrases), (3) Path to Dominance Classification (business→editorial reclassification), (4) Reality Check Filtering (speculative comparison removal), (5) Cross-Border Context Gate (irrelevant cross-border removal), (6) Matter Enhancement Verification (fact preservation check). Master validator: `validate_analysis_output()`. Report stored in pipeline_manifest | v16.0 | `utils/validators.py` (6 validators + master), `nodes.py` (analysis_node post-gate, optimization_node enhancement gate) | ✅ ACTIVE | 🔴 SUPREME |
| 88 | **Live Benchmark Engine — Real-Time Scraping** — Replaces static RAVL config with LIVE data scraped from Chambers and Legal 500 public pages. ChambersScraper extracts Angular Transfer State JSON (`<script id="ng-state">`): firm bands, individual bands, lawyer names, firms, ranked years. Legal500Scraper parses Next.js SSR HTML: tier headers (`<h3 class="sr-only">`), firm names, tier badges. Rate-limited (2-5s random delay). Graceful fallback to RAVL static config when scraping fails | v17.0 | `utils/benchmark_scraper.py` (ChambersScraper, Legal500Scraper, scrape_rankings, get_benchmark_summary), `config/benchmark_url_map.json` (7 URL mappings + alias normalization) | ✅ ACTIVE | 🔴 SUPREME |
| 89 | **Benchmark Cache with 30-Day TTL** — JSON file cache in `config/benchmark_cache/` with TTL validation. Cache key = sanitized `{directory}_{practice}_{jurisdiction}`. Practice area aliases normalized before cache lookup (e.g., "Banking and Finance" → "Banking & Finance"). Functions: `get_cached_benchmark()`, `save_benchmark_cache()`, `invalidate_cache()`, `list_cached_benchmarks()`. Owner decision: "Opción A — scrapear en cada pipeline run si el cache tiene >30 días" | v17.0 | `utils/benchmark_cache.py`, `config/benchmark_cache/` (directory) | ✅ ACTIVE | 🔴 CRITICAL |
| 90 | **Live Benchmark Context Injection** — When live scrape succeeds, injects `LIVE_BENCHMARK_CONTEXT` prompt block into analysis_node. Contains: VERIFIED firm names, band counts, individual categories, editorial context. Overrides RAVL scenario with live structure data (has_firm_bands, has_individual_bands). Rules: (1) Use ONLY specific firm/lawyer names from live data, (2) Reference exact band/tier counts, (3) NEVER use generic methodologies, (4) If live data shows NO firm bands → prohibit ALL firm band references. Stored in `strategic_context.live_benchmark` | v17.0 | `agents/nodes.py` (context_engine_node live injection, analysis_node LIVE_BENCHMARK_CONTEXT block), `agents/prompts.py` (LIVE_BENCHMARK_CONTEXT template) | ✅ ACTIVE | 🔴 SUPREME |
| 91 | **Brotli Header Fix** — httpx with `Accept-Encoding: gzip, deflate, br` header truncates Chambers responses (33KB instead of 285KB). Root cause: httpx cannot decompress Brotli without the `brotli` package. Fix: removed `Accept-Encoding` header entirely, letting httpx handle decompression automatically. Without this fix, ChambersScraper reports "No transfer state found" on every request | v17.0 | `utils/benchmark_scraper.py` (HTTP headers) | ✅ ACTIVE | 🔴 CRITICAL |
| 92 | **Max Tokens 8192 + Timeout** — gpt-4o with `max_tokens=16384` caused API to hang indefinitely (36 min). Reduced to `max_tokens=8192` (sufficient for 7+ matter evals) and added `request_timeout=300` (5 min) to prevent future hangs. If API hangs, pipeline fails cleanly instead of blocking forever | v17.0 | `nodes.py` (get_model max_tokens + request_timeout) | ✅ ACTIVE | 🔴 SUPREME |
| 93 | **Enhancement Gate Input Fix** — `validate_matter_enhancement()` was comparing matter TITLE (8-15 words) against enhanced FULL TEXT (120-260 words), causing 0% proper noun ratio and false failures on ALL 7 matters. Fix: compare against `raw_text` (full matter with Title+Client+Value+Summary+Significance+Lead Partner). Same fix applied to entity detection in probative preservation validator | v17.0 | `nodes.py` (optimization_node: Enhancement Gate + entity detection both now use raw_text) | ✅ ACTIVE | 🔴 CRITICAL |
| 94 | **Safe JSON Loads 5-Strategy** — Replaced simple 3-step parser with 5-strategy robust parser: (1) Direct parse, (2) Brace-matching extraction (handles preamble text), (3) UTF-8 replacement, (4) Regex extraction, (5) Truncation repair (closes unclosed braces/brackets). Each strategy logs success/failure for debugging. Logs first 300 and last 200 chars on total failure | v17.0 | `nodes.py` (safe_json_loads function) | ✅ ACTIVE | 🔴 CRITICAL |
| 95 | Legacy omission detector (50% proper-noun floor); novel entities are governed by v26 canonical artifact validation | v26.0 | `utils/validators.py`, `utils/evidence_validation.py` | ⚠️ COMPATIBILITY | 🔴 CRITICAL |
| 96 | **Graceful pdflatex** — Writer node wrapped in try/except for pdflatex. Pipeline no longer crashes when LaTeX is not installed. The primary output path is the DOCX generator via the Next.js frontend, not the LaTeX PDF | v17.0 | `nodes.py` (writer_node compile_latex_to_pdf) | ✅ ACTIVE | 🟡 IMPORTANT |
| 97 | **Analysis Node JSON Mode** — Force `response_format={"type": "json_object"}` on the analysis chain's LLM call. Without this, gpt-4o may return the JSON embedded in explanatory text, causing `safe_json_loads` to fail or return a partial object. With json_object mode, the entire response is a valid JSON object containing `audit_letter` and `matter_evaluations` | v17.0 | `nodes.py` (analysis_node: llm.bind json_object) | ✅ ACTIVE | 🔴 SUPREME |
| 98 | **Analysis Node 2-Call Decomposition** — Call 1 produces the strategic Audit; Call 2 scores exactly the reconciled matter universe. Free-form recommended rewrites were removed in v26; missing facts become questions | v26.0 | `nodes.py`, `prompts.py` | ✅ ACTIVE | 🔴 SUPREME |
| 99 | **Narrative Matter Extraction — FALLBACK ONLY** — Narrative detection is allowed only when the deterministic manifest confirms that no numbered D/E register is available. It may never supplement a numbered register | v26.0 | `prompts.py`, `doc_parser.py`, `nodes.py` | ⚠️ CONDITIONAL | 🔴 SUPREME |
| 100 | **Venezuela URL Fix** — Chambers Banking & Finance Venezuela country code corrected from 231 to 229. The correct URL is `chambers.com/legal-rankings/banking-finance-venezuela-9:6:229:1` — confirmed via browser navigation to Chambers.com which showed 9 departments + 16 lawyers | v17.0 | `config/benchmark_url_map.json` (Venezuela country code) | ✅ ACTIVE | 🔴 CRITICAL |
| 101 | **Grammar Post-Processing Layer** — After all matters are optimized, each optimized_text gets a grammar/spelling check via a lightweight LLM call. Uses a focused prompt that ONLY fixes grammar without changing content, names, numbers, or meaning. Returns JSON with corrected_text and corrections_made count. Non-fatal — failures silently keep original text | v17.0 | `nodes.py` (optimization_node: GRAMMAR POST-PROCESSING LAYER) | ✅ ACTIVE | 🟡 IMPORTANT |
| 102 | **Practice Scope Respect Rule** — "RankPilot does not pretend to tell a firm how to develop its practice. It tells them how to PRESENT BETTER the evidence they already possess." Never recommends expanding cross-border capabilities, diversifying clients, or entering new markets. All recommendations must be editorial actions: reframe, reorganize, mine existing evidence. Fixes owner feedback where system penalized firms for lacking cross-border work they don't do | v17.0 | `prompts.py` (FULL_UNIVERSE_ANALYSIS_RULE: PRACTICE SCOPE RESPECT RULE section) | ✅ ACTIVE | 🔴 SUPREME |
| 103 | **SUPERSEDED** — 3–5x expansion produced unsupported facts; replaced by evidence-conditioned rewriting and rollback | v26.0 | `prompts.py`, `evidence_validation.py` | ⛔ RETIRED | 🔴 SUPREME |
| 104 | **Analysis Node Prompt Fix** — Fixed `NameError: name 'prompt' is not defined` in analysis_node. Changed from `chain = prompt \| llm_json` (undefined variable) to `llm_json.invoke([SystemMessage, HumanMessage])` using direct message invocation. Also avoids ChatPromptTemplate which breaks on analysis_prompt's JSON schemas containing `{}` | v17.1 | `nodes.py` (analysis_node: chain construction + retry) | ✅ ACTIVE | 🔴 CRITICAL |
| 105 | **GPT-4o JSON Unwrapper** — gpt-4o with `response_format={"type": "json_object"}` commonly wraps the entire response in `{"analysis": {...}}`. This unwrapper detects the pattern and promotes inner keys to top level so score, audit_letter, etc. are found where validation code expects them | v17.1 | `nodes.py` (analysis_node: after safe_json_loads) | ✅ ACTIVE | 🔴 CRITICAL |
| 106 | **Robust Score Extraction** — Score validation now searches multiple JSON locations: top-level, inside 'analysis', inside 'audit_letter', inside 'editorial_confidence'. Looks for keys: score, confidence_score, overall_score, editorial_score. If found nested, promotes to top level. Eliminates false MISSING_SCORE validation failures | v17.1 | `nodes.py` (analysis_node: CHECK 5 score validation) | ✅ ACTIVE | 🟡 HIGH |
| 107 | **SUPERSEDED** — no minimum word count or expansion ratio; factual density and fidelity govern length | v26.0 | `prompts.py` | ⛔ RETIRED | 🔴 CRITICAL |
| 108 | **Manifest Validation KeyError Fix** — Fixed `KeyError: 'validation'` when accessing nested manifest dictionary. Changed to `.setdefault()` for safe nested dictionary access in extraction validator | v17.1 | `nodes.py` (extraction_validator: manifest access) | ✅ ACTIVE | 🟡 HIGH |


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

**REQUIRED terms:** "institutional reputation", "market perception", "editorial positioning", "submission narrative", "evidence", "differentiation", "credibility", "evidentiary value", "ranking narrative", "editorial identity", "bench strength", "practice trajectory". Internal references to guards, model restrictions, prompts or thresholds are prohibited client-facing language.

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

1. **No expansion quota:** length follows evidence; every material fact must remain
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
**Files:** `submission-builder.ts`, `generate-docx/route.ts`, `core/docx_cloner.py`, `utils/ooxml_validation.py`

**Root cause fixed:** Google Docs ignores `WidthType.PERCENTAGE`, causing tables to collapse.

**Solution:**
- `PAGE_WIDTH_DXA = 9360` (Letter 8.5" - 2×1" margins)
- ALL tables and cells use `WidthType.DXA`
- ALL tables have `columnWidths` array for explicit `w:tblGrid` generation
- ALL tables use `TableLayoutType.FIXED`
- B6 lawyers table: `[1500, 4260, 1000, 1000, 1600]` = 9360
- **ZERO output tables using percentage widths**; clone output is normalized before delivery
- OOXML package validation rejects missing/zero/non-DXA table grids

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
5. **EVIDENTIARY VALUE** — Shows the firm's ROLE, not just the transaction
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
- [ ] **Artifact validator intact?** Exact count/status/client, source spans, no novel numbers, rollback recorded
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
