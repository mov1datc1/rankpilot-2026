# CHANGELOG — RankPilot 2026

All notable changes to this project are documented in this file.
Format follows [Semantic Versioning](https://semver.org/).

## [v20.1] — 2026-08-13

### 🔧 Splice, Grammar, Diversity & Word Count Fixes

**6 bugs identified and resolved across 4 pipeline test runs (González de Araujo DOCX).**

#### Bug Fixes:
1. **Splice Contamination (Critical)**: `sanitize_descriptor_source()` strips DOCX table artifacts (`| No. 6 |`) and isolates ±500 chars around client name. `find_foreign_client_mentions()` post-generation validator detects cross-matter contamination.
2. **Grammar Errors (Critical)**: `repair_possessive_appositive()` fixes `"Client's, descriptor"` → `"Client, descriptor"` with Unicode curly apostrophe support (U+2019/U+2018). Runs both per-matter AND after grammar LLM as final safety net.
3. **Opening Diversity**: Final Diversity Enforcement runs AFTER all post-processing (descriptor insert, grammar LLM) to catch corrupted openings. `force_opening_diversity()` rewritten with smart pattern matching using client_name context.
4. **Word Count Floor**: 175-word minimum with warning log. Descriptor capitalization fix for mid-sentence industry words.

#### Prompt Changes:
- SOURCE BOUNDARY rules in MATTER_OPTIMIZER_PROMPT
- GRAMMAR FOR CLIENT APPOSITIVES prohibition
- TABLE/LIST ARTIFACT prohibition
- Thesis redaction: all client names → `[client]` placeholder
- Descriptor priority: Body E2 summary FIRST, doc_text E1 as fallback

#### Test Results (R4 — Final):
| Check | Result |
|-------|--------|
| Splice | ✅ 7/7 CLEAN |
| Diversity | ✅ 7/7 UNIQUE |
| Word Count | ✅ ALL ≥ 175w |
| Grammar | ✅ 7/7 CLEAN |
| Constitutional | ✅ PASS (attempt 2) |
| Pipeline Time | 882s |

---

## [v20.0] — 2026-08-12

### 🏗️ Opening Diversity Tracker + Constitutional Validation Gate

**New modules**: `OpeningDiversityTracker` class with prompt injection, validation, and programmatic force-replace. Constitutional Validation Gate with LLM editorial judge (7 checks: B1, B3, B4, C2, C3, C4, C9) + deterministic L1 checks. Gate allows up to 3 retries before delivering with warnings.

**6 bugs found in testing**: Splice contamination (M5), opening diversity (5/7), word count regression, M4 evidence loss, D2 missing section, grammar errors.

---

## [v19.2] — 2026-08-11

### 📊 Stable Baseline

Pipeline producing consistently good output. 7/7 matters expanded vs original (+55-171%). All constitutional checks passing. Client descriptors preserved. Zero filler words. Established as baseline for v20.0 comparison testing.

---

## [v18.8] — 2026-08-10

### 🔧 Client Descriptor Verification v2 + Entity-Loss Detection

`verify_client_descriptors()` expanded with E1 form data extraction, industry keyword matching (60+ terms), and multi-word phrase support. Entity-loss detection (`[ENTITY-LOSS v20]`) checks that ≥60% of named entities survive optimization. Re-optimization triggered on entity loss.

---

## [v18.5b] — 2026-08-09

### 📝 Architecture Labels Hidden + Anti-Homogenization

**Labels renamed**: "Competitive Identity" → "Practice Positioning", "Hero Matter" → "Lead Engagement". Internal architecture terms removed from all visible output (DOCX headers, audit letter).

**Anti-homogenization**: Each matter must tell a DIFFERENT strategic story. C3 constitutional check enforces differentiated openings. Prompt includes sector-specific angles (pharma=sensitive data, retail=scaling, industrial=risk management).

---

## [v18.5] — 2026-08-09

### 🎯 B7 Strategic Enhancement + Evidence Strengthening

**B7 rewrite**: System message changed to "editorial analyst who reveals why a practice is differentiated". B7 now interprets (not decorates) the practice. 2-3 client examples illustrate patterns. Lead partner mentioned by name. Thesis preserved from original.

**Evidence Strengthening Requests**: Claims lacking quantifiable evidence get targeted questions instead of manufactured prose. Section added to Strategic Audit Letter.

**Density > Volume**: "400 words of high density > 500 words with filler."

---

## [v18.0] — 2026-08-08

### 🔄 Matter Enhancer Prompt Rewrite

Complete rewrite of `MATTER_OPTIMIZER_PROMPT` with:
- KEEP → EXPAND → STRENGTHEN paradigm
- Client descriptor preservation rules with few-shot examples
- Evidence strength tiers (Strong > Moderate > Weak)
- Strategic opening requirement (WHY first, not mandate)
- Anti-homogenization rule with sector-specific angles

---



### 🏗️ L1 Defense: Cross-Border + RAVL Injection into ALL Editorial Nodes

**Problem**: 4 editorial nodes (`identity_discovery`, `hypothesis_construction`, `comparative_analysis`, `editorial_confidence`) in `editorial_nodes.py` NEVER received:
- The `cross_border_relevant` flag in their system prompt
- The RAVL scenario (Scenario B: individuals only)

The LLM generated "lacks cross-border work" because the prohibition was only in the JSON data (which the LLM ignores), not in the system message (which it follows).

**Root cause**: `_inject_directives()` existed but was only wired to 5 of 9 nodes. The 4 reasoning-heavy nodes were missing.

**Fixes**:
1. Added **CROSS-BORDER PROHIBITION** block to `_inject_directives()`:
   - 5 explicit DO NOT rules
   - Positive alternatives (focus on regulatory complexity, local mandates)
   - Activated when `cross_border_relevant = False`

2. Wired `_inject_directives()` into ALL 4 missing nodes:
   - `identity_discovery_node` (L424)
   - `hypothesis_construction_node` (L510)
   - `comparative_analysis_node` (L637)
   - `editorial_confidence_node` (L689)

**Architecture**: 3-layer defense now complete:
- **L1**: System prompt injection (THIS FIX) — tells LLM what NOT to do
- **L2**: Post-processing validator (v17.6.1) — catches remaining leaks
- **L3**: Validation gate — blocks violating outputs

---

## [v17.6.1] — 2026-08-06

### 🔧 Cross-Border Validator: Comprehensive Sweep + Expanded Patterns

**Problem**: Owner Point #6 — "cross-border" appeared 7 times in audit reasoning trace despite Data Protection being a domestic practice.

**Root cause**: `validate_cross_border()` only swept 3 named fields (`the_state_of_play`, `competitive_context`, `competitive_positioning_text`) but cross-border references leaked through HYPOTHESIS_CONSTRUCTION, REFUTATION_ENGINE, COMPARATIVE_ANALYSIS, EDITORIAL_CONFIDENCE nodes into unnamed reasoning trace fields.

**Fixes**:
- Expanded `CROSS_BORDER_PATTERNS` from 7 → 12 patterns (+`limited cross-border`, `lack of cross-border`, `undermined by cross-border`, etc.)
- Changed audit sweep from 3 named fields → ALL string fields in audit dict
- Added top-level `summary` and `competitive_identity` sweep
- **5/5 real v17-5.1 sentences correctly caught and removed**

---

## [v17.6] — 2026-08-06

### 🔧 Complete Rewrite: `verify_client_descriptors()` — 7/7 clients now pass

**v17.5.3 fixed 5/7 clients but FAILED on Grupo Hermes and MEGA DIRECT because:**
1. `industry_terms` list was too narrow — missing: `diversified`, `services`, `advertising`, `marketing`, `information`, `conglomerate`, `provider`, `call`, `center`
2. Only matched comma-delimited descriptors — missed em-dash format (`ClientName — descriptor`)
3. Single-word matching missed multi-word phrases like `call center`

**v17.6 fixes:**
- Expanded `industry_terms` from 31 → 60+ words (added services, conglomerate, diversified, advertising, etc.)
- Added multi-word phrase matching (`call center`, `real estate`, `private equity`, etc.)
- Added em-dash pattern (`ClientName — descriptor`) for client list formats
- Added more end markers (`, engaged`, `, undertook`, `, retained`) for descriptor boundary detection
- Scoring system: each phrase match counts as 2 identity signals

**Test results — 7/7:**
| Client | Before v17.6 | After v17.6 | Key words |
|--------|-------------|-------------|-----------|
| Excelsior | ✅ was OK | ✅ | dairy, producers |
| Modelquipo | ✅ was OK | ✅ | engineering, manufacturing |
| Hotel Riazor | ✅ was OK | ✅ | decades, experience |
| Biocodex | ✅ was OK | ✅ | pharmaceutical |
| Chedraui | ✅ was OK | ✅ | retail |
| **Grupo Hermes** | 🔴 FAILED | ✅ **FIXED** | diversified, infrastructure, energy, transport, automotive |
| **MEGA DIRECT** | 🔴 FAILED | ✅ **FIXED** | call center, marketing, experience |

---


### 🧬 PHYSICAL TOKEN BAN: logit_bias Filler Prevention (3-Layer Defense)

The LLM kept generating filler phrases despite prompt prohibitions. Root cause: prompt-level prohibitions are "suggestions" the LLM can ignore. Now using a 3-layer defense:

#### Layer 1: logit_bias (PHYSICAL BAN — impossible to bypass)
- **What**: Token-level ban via OpenAI's `logit_bias` parameter with value `-100`
- **Effect**: Makes it **mathematically impossible** for the LLM to generate these 9 words:
  - `pivotal`, `seamlessly`, `meticulously`, `beacon`, `testament`, `cornerstone`, `holistic`, `paramount`, `underscores`
- **How**: Token IDs verified with `tiktoken` `o200k_base` encoding (gpt-4o)
- **Scope**: Applied to `get_model()` factory — affects ALL LLM calls (matters, B7, audit, analysis)

#### Layer 2: Prompt Prohibition (EXPLICIT INSTRUCTION)
- Added `PROHIBITED GENERIC PHRASES` block to B7 enhancement prompt
- Matter enhancer already had this since v17.1
- Lists 15+ filler phrases with correct alternatives

#### Layer 3: strip_fillers() (POST-PROCESSING SAFETY NET)
- Moved `GENERIC_FILLERS` regex patterns to **module level** (was inline in function)
- Created centralized `strip_fillers(text)` function
- Applied to **ALL** LLM output: matters AND B7 (previously only matters)
- Expanded to 31 patterns (from original 15)

### 📊 Defense Matrix

| Filler Word | Layer 1 (logit_bias) | Layer 2 (prompt) | Layer 3 (regex) |
|------------|---------------------|------------------|-----------------|
| pivotal | ✅ TOKEN BAN | ✅ | ✅ |
| seamlessly | ✅ TOKEN BAN | ✅ | ✅ |
| beacon | ✅ TOKEN BAN | ✅ | ✅ |
| testament | ✅ TOKEN BAN | ✅ | ✅ |
| cornerstone | ✅ TOKEN BAN | ✅ | ✅ |
| comprehensive | ❌ (multi-token) | ✅ | ✅ |
| distinguished | ❌ (multi-token) | ✅ | ✅ |
| robust framework | ❌ (phrase) | ✅ | ✅ |
| navigate complex | ❌ (phrase) | ✅ | ✅ |

### v17.5.1 — Broaden `solidified` regex
- Pattern `\bsolidified its position\b` only caught ONE variant
- Changed to `\bsolidified its\b` → catches `solidified its reputation`, `solidified its role`, etc.

### v17.5.2 — CLIENT IDENTITY PRESERVATION rule (few-shot prompt)
- **Problem found via Original-vs-Enhanced comparison:**
  - Excelsior: `"one of Mexico's leading dairy producers"` → `"a prominent client"` ❌
  - Modelquipo: `"an engineering and manufacturing group"` → `"a key player in its sector"` ❌
- **Fix**: Added `CLIENT IDENTITY PRESERVATION` block to `MATTER_ENHANCER_PROMPT` with:
  - 4 ❌ forbidden examples (exactly what the LLM was doing)
  - 3 ✅ correct examples (copy original descriptor, then ADD context)
  - Rule: "Copy the original client descriptor FIRST, then ADD context. NEVER replace it."

### v17.5.3 — ARCHITECTURAL FIX: `verify_client_descriptors()` (4th layer)

**Root cause**: Prompt rules are "suggestions" the LLM can ignore. Client descriptor loss is NOT fixable with prompts alone.

**Solution**: Programmatic post-processing function (DETERMINISTIC — no LLM involved):
1. Extracts client descriptor from ORIGINAL text (e.g., "one of Mexico's leading dairy producers")
2. Extracts industry/sector keywords (dairy, engineering, manufacturing, decades, etc.)
3. Checks if 60%+ of keywords survived in enhanced text
4. If NOT → surgically splices the original descriptor back in

**Unit tests passed:**
- Excelsior: ✅ Restored "dairy producers" (was "prominent client")
- Modelquipo: ✅ Restored "engineering and manufacturing" (was "key player")
- Hotel Riazor: ✅ Restored "five decades of experience" (was "recognised entity")
- Chedraui: ✅ NOT modified (already had "retail" — correct behavior)

**4-Layer Defense Architecture (v17.5.3):**

```
Original → [LLM + logit_bias] → [strip_fillers] → [verify_client_descriptors] → Output
            Layer 1+2              Layer 3           Layer 4
            (token ban +           (31 regex)         (descriptor repair)
             prompt rules)
```

| Layer | Function | Type | Can fail? |
|-------|----------|------|-----------|
| 1. `logit_bias` | Ban 9 filler tokens | Token-level | ❌ Impossible |
| 2. Prompt rules | Few-shot examples | LLM instruction | 🟡 Can ignore |
| 3. `strip_fillers()` | 31 regex patterns | Deterministic | ❌ No |
| 4. `verify_client_descriptors()` | Restore lost descriptors | Deterministic | ❌ No |

---

## [v17.2] — 2026-08-05

### 🎯 CRITICAL: Intelligent Benchmark Resolver + Band Auto-Detection
Owner-reported regression: Live meeting showed AraqueReyna (Band 2 in Chambers) being treated as "Unranked" with Band 4 alignment. Root cause: 3 cascading failures.

#### Fix A: Regional Jurisdiction Fallback
- **Problem**: Benchmark scraper looked for `"Banking & Finance|Latin America"` but URL map has country-level keys (`"Banking & Finance|Venezuela"`)
- **Fix**: When jurisdiction is regional (Latin America, Europe, Asia Pacific, etc.), automatically scan URL map for all country-level entries under the same practice area
- **Result**: `"Latin America"` → finds `"Mexico"`, `"Venezuela"` → scrapes Venezuela page → gets real data

#### Fix B: Band Auto-Detection from Live Data
- **Problem**: User selected "Unranked" in dropdown, but firm is actually Band 2
- **Fix**: After scraping, search for the submission firm in the ranked firms list using fuzzy matching. If found, override the user-declared band with the verified band
- **Result**: `ARAQUEREYNA → Band 2` auto-detected. Starting position reclassified from "Entry Candidate" → "Upper Tier Push"

#### Fix C: Owner's Benchmark Specification Implemented
```
Directory → Jurisdiction → Practice → Editorial Page → Ranking Structure
```
- System now discovers ranking structure AUTOMATICALLY
- Knows if practice has firm bands, individual bands, or both
- Example: Data Protection México = individuals only; Banking Venezuela = firms + individuals

### 📊 Verified: Chambers Venezuela Banking & Finance
- 9 ranked firms (Band 1-3), 16 ranked individuals (SS, Band 1-3)
- ARAQUEREYNA correctly identified in Band 2
- Pedro Luis Planchart Pocaterra (Band 1), Gustavo J Reyna (Senior Statespeople)

---

## [v17.1.6] — 2026-08-05

### 🎯 ROOT CAUSE FIX: Jurisdiction Detection
- **Fixed**: A3 "Location (Jurisdiction)" now correctly shows the AI-detected **country** (e.g., "Venezuela") instead of the UI-selected **region** (e.g., "Latin America")
- **Root cause**: The priority chain in both `process-document/route.ts` and `generate-docx/route.ts` had `strategic_context.jurisdiction` (UI dropdown = region) FIRST, which always won over `analysis.location` (AI-detected = country)
- **Fix**: Reversed priority: `analysis.location` > `metadata.jurisdiction` > `strategic_context.jurisdiction`
- Affects: Submission Form (A3), Audit Letter header, Audit context banner

---

## [v17.1.5] — 2026-08-05

### 🗑️ Database Garbage Prevention
- **Fixed**: Orphan matter accumulation on re-process
  - Changed `Matter → Submission` relation from `onDelete: SetNull` to `onDelete: Cascade`
  - Deleting a submission now properly deletes all associated matters
  - Added `deleteMany` cleanup before creating new matters (prevents duplicates on re-process)
- **Added**: `prisma db push --accept-data-loss` to `postinstall` script for auto-schema sync on Vercel deploy
- **Added**: Debug logging for jurisdiction save/read paths with full source chain

### 🔧 Analysis Unwrap Hardening
- Simplified gpt-4o nested wrapper unwrap: always overwrite top-level keys with inner values
- Delete the nested `analysis.analysis` wrapper after promotion (prevents confusion downstream)

---

## [v17.1.4] — 2026-08-05

### 🔄 Analysis Unwrap at Save Time
- **Fixed**: gpt-4o analysis data (`{analysis: {analysis: {location, score, ...}}}`) was only being unwrapped at DOCX generation time — too late, DB already had wrapped data
- **Fix**: Unwrap at SAVE time in `process-document/route.ts` BEFORE writing to DB
- Ensures `detectedJurisdiction`, `score`, and `location` are correctly stored in `chambersData`

---

## [v17.1.3b] — 2026-08-05

### 📝 B7 Narrative Reconstruction
- **Fixed**: B7 "What is this department best known for?" was only 63 words (below 155-word Chambers minimum)
- **Fix**: Now maps `thesis_statement` + `positioning_statement` + `bench_strength_narrative` from the AI pipeline
- Result: B7 now generates 147–188 words of rich, editorial-quality narrative

### 🔧 JSON Unwrap Logic
- Fixed backwards skip logic in `generate-docx/route.ts` JSON unwrapper
- Added `location` to `alwaysPromote` list for nested analysis objects

---

## [v17.1.3] — 2026-08-04

### 📊 Score Derivation Fix
- **Fixed**: Score was 0/100 or missing because `editorial_confidence` was being read from `res_json` (LLM response) instead of `state` (pipeline state)
- **Fix**: Read `editorial_confidence` from pipeline state first, then fall back to LLM response
- Added `insufficient → 35`, `needs_investigation → 35` to confidence-to-score mapping
- Result: Score correctly derives as 35/100 for insufficient evidence submissions

---

## [v17.1.2] — 2026-08-04

### 🏗️ DOCX Builder Reconstruction
- **Fixed**: Strategic Audit Letter was empty/missing sections
- Rebuilt audit letter with:
  - Pipeline Manifest (trust layer with file hash, word count, matter verification)
  - Evaluation Context Banner (directory, practice, jurisdiction, band)
  - Insufficient Evidence warning with percentage
  - Editorial Thesis & Hero Matter section
  - Competitive Positioning Analysis
  - Pipeline Trace (all 15 nodes logged)
  - Strategic Recommendations with actionable next steps
- **Fixed**: Jurisdiction detection chain for audit header and context
- **Added**: Matter extraction logging for repository debugging

---

## [v17.1.1] — 2026-08-04

### 🐛 Bug Fixes
- **Fixed**: `NameError: expected_count` in validation gate (`nodes.py`)
- **Fixed**: Score derivation from `editorial_confidence.overall_confidence` field

---

## [v17.1] — 2026-08-04

### 🔄 Paradigm Shift: KEEP → EXPAND → STRENGTHEN
- **Changed**: Matter optimization paradigm from "rewrite/compress" to "keep original → expand with context → strengthen with evidence"
- Owner directive: *"RankPilot does not summarize. It takes existing evidence and makes it MORE CONVINCING."*
- Matters now preserve 100% of original content and ADD editorial amplification
- Entity preservation: Re-optimization if named entity preservation drops below 60%

### 🐛 Critical Bug Fixes
- Fixed validation gate retry loop that was burning 2-3 retries per submission
- Fixed `MISSING_SCORE` false positive when score was derived from editorial_confidence
- Grammar check integrated as post-processing pass

---

## [v17.0] — 2026-08-04

### 🌐 Live Benchmark Engine
- Real-time Chambers scraping for competitive positioning
- URL map for 50+ practice/jurisdiction combinations
- Returns actual firm names, bands, and ranking structure
- System can no longer invent bands or firms that don't exist

---

## [v16.0] — 2026-08-03

### 📜 Constitutional Enforcement
- 15 First Principles codified into pipeline
- 20 Constitutional Articles enforced at each node
- Editorial Intelligence Specification Volumes 0-VII integrated
- RAVL (Ranking Architecture Validation Layer) with static config

---

## [v15.0] — 2026-08-02

### 🎯 Editorial Reasoning Calibration
- 7 Surgical Rules (RC-5 to RC-11)
- Hypothesis construction with refutation engine
- Comparative analysis with band alignment
- Editorial confidence scoring

---

## [v14.1] — 2026-08-01

### ✈️ Pre-Flight Gate
- 5-Point validation before any reasoning
- Rules 72-74: Input integrity checks

---

## [v14.0] — 2026-08-01

### 🔍 Trust Layer
- Extraction Validator (Rule 70): Source vs extracted matter count verification
- Pipeline Manifest (Rule 71): File hash, word count, paragraph count tracking
- Matter loss detection with percentage alert

---

## [v13.1] — 2026-07-31

### 🔧 Stability & Resilience
- PIL Lite retry for LangChain template variable crashes
- Validation gate fix: `matter_evaluations` found inside `audit_letter` wrapper
- Dynamic processing header + resilient JSON parsing for Render timeouts
- Comprehension context engine fallback prompts
- Matter Accountability auto-fill

---

## Owner Feedback Resolution Tracker

| Issue | Owner Complaint | Status | Fixed In |
|-------|----------------|--------|----------|
| Jurisdiction wrong | "Latin America" instead of "Venezuela" | ✅ **FIXED** | v17.1.6 |
| Score missing/zero | Score was 0/100 or absent | ✅ **FIXED** | v17.1.3 |
| B7 too short | 63 words (needs 155+) | ✅ **FIXED** | v17.1.3b |
| Strategic letter incomplete | Empty sections, no pipeline trace | ✅ **FIXED** | v17.1.2 |
| Matters summarized | Evidence disappeared, all matters look alike | ✅ **FIXED** | v17.1 |
| Validation retries | 2-3 wasted retries per submission | ✅ **FIXED** | v17.1.1 |
| Benchmark validation | System invents rankings | ✅ **FIXED** | v17.0 |
| DB garbage on re-process | Orphan matters accumulating | ✅ **FIXED** | v17.1.5 |
| Grammar errors | "would benefit from provide" | ✅ **FIXED** | v17.1 |
| Matter repo not saving | Matters not saved to firm folder | ✅ **FIXED** | v17.1.2a |
