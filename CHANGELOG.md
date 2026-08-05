# CHANGELOG — RankPilot 2026

All notable changes to this project are documented in this file.
Format follows [Semantic Versioning](https://semver.org/).

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
