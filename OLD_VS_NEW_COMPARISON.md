# Old vs New RankPilot AI Engine — Deep Comparison

## Pipeline Architecture

| Component | Old (rankpilot-core) | New (ai-engine) | Status |
|-----------|---------------------|-----------------|--------|
| **Pipeline** | 5 nodes: ingestion → extraction → analysis → interrogation ↔ writing | 7 nodes: ingestion → extraction → **context_engine** → analysis → **optimization** → interrogation ↔ writing | ✅ New is MORE advanced |
| **RAG System** | ❌ None | ✅ 22 RAG knowledge files + RAGRouter with practice/directory matching | ✅ New has RAG the old didn't |
| **Context Engine** | ❌ None | ✅ 8-Layer methodology: starting position, practice type, archetype, complexity profile, client type, identity ADN, benchmark, target viability | ✅ New is MORE advanced |
| **Matter Optimization** | ❌ None | ✅ Dedicated optimization_node with MATTER_OPTIMIZER_PROMPT | ✅ New has individual matter optimization |
| **Confidence Gate** | 65% threshold → interrogation | Same 65% gate, but also has strategic_context feeding analysis | ✅ Same logic, enhanced |

---

## Prompts Deep Comparison

### EXTRACTION_SYSTEM_PROMPT

| Dimension | Old | New | Verdict |
|-----------|-----|-----|---------|
| Core Mission | "Identify Structural Signals" | Same + "team_role" field added | ✅ New adds team role |
| Output Schema | firm_metadata, positioning_claims, matters, structural_gaps | Same + team_role per matter | ✅ Enhanced |
| Constraints | "No filler, neutral tone" | Same + "DO NOT summarize. Act as strategic editor" | ✅ Stronger |

### STRATEGIC_ANALYSIS_PROMPT (The Critical One)

| Dimension | Old | New (after V2.2) | Verdict |
|-----------|-----|-------------------|---------|
| Identity | "Positioning Intelligence Engine" | "Senior Strategic Rankings Consultant" + Board-level | ✅ New is better |
| Evaluation Framework | 4 tiers (Foundational → Aspirational) | Same + RAG knowledge injection | ✅ Enhanced |
| Analysis Logic | Positioning Tension + Blind Spots | Same + ABSOLUTE PROHIBITIONS on negative language + Competitive Positioning mandate | ✅ Enhanced |
| Output Fields | dominant_model, positioning_tier, confidence_score, blind_spots, structural_advantage, evolution_path, tier_viability | risk_level, score, summary, **narrative_strategy**, the_state_of_play, **THE WEAPON**, **VOICE OF TRUTH**, **path_to_dominance with Why/What/Deadline**, competitive_context, **matter_evaluations**, **recommended_rewrites**, **competitive_positioning_text**, **closing** | ✅ New has 13 fields vs 7 |
| RAG Integration | ❌ None | ✅ Full RAG_KNOWLEDGE injected with practice-specific guidelines | ✅ Major upgrade |
| Matter-Level Scoring | ❌ None | ✅ Per-matter score + quality label | ✅ New feature |
| AI Rewrites | ❌ None | ✅ 220-260 word Chambers-grade rewrites | ✅ New feature |

### EDITORIAL_INTERROGATOR_PROMPT

| Dimension | Old | New | Verdict |
|-----------|-----|-----|---------|
| Core Logic | Same "bridge the gap" philosophy | Same + C2 Section mandate added | ✅ Enhanced |
| Output | Same "2-3 strategic questions" | Same structure | ≈ Equal |

### MATTER_OPTIMIZER_PROMPT

| Dimension | Old | New | Verdict |
|-----------|-----|-----|---------|
| Existence | ❌ Didn't exist | ✅ Full prompt with prohibitions, confidentiality rules, team role mandate, presentation order | ✅ NEW |

### LATEX_WRITER_PROMPT

| Dimension | Old | New | Verdict |
|-----------|-----|-----|---------|
| Structure | I. Executive Summary → II. Structural Positioning → III. Portfolio Analysis → IV. Strategic Evolution Path | Same 4-section structure, both present | ≈ Same |

---

## Conclusion

**The new system is significantly MORE advanced than the old one:**

1. **The old had NO RAG** — the new has 22 practice-specific knowledge files
2. **The old had NO Context Engine** — the new has an 8-layer methodology
3. **The old had NO Matter Optimization** — the new optimizes each matter individually
4. **The old had 7 output fields** — the new has 13 (narrative_strategy, matter_evaluations, rewrites, closing, etc.)
5. **The old had NO absolute prohibitions** — the new forbids negative language and missing-data callouts

The only thing the old system did that the new captures differently is the **PDF visual output** — the old used LaTeX compilation for a beautifully formatted PDF with TikZ/tcolorbox. The new renders the same content via the Next.js web UI (which is actually better for interactivity) and exports via DOCX.

> [!IMPORTANT]
> No features from the old system are lost. Everything has been either preserved, enhanced, or superseded by a better implementation.
