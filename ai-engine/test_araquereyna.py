"""
Full Pipeline Test — AraqueReyna Banking & Finance v17.0
=======================================================
Runs the COMPLETE 16-node RankPilot pipeline with AraqueReyna submission.
Uses: BANKING & FINANCE - ARAQUEREYNA - CHAMBERS 2027

Validates:
1. Live Benchmark Engine scrapes Banking & Finance Venezuela
2. Scenario A (firms + individuals) correctly detected
3. Real firm names and bands injected
4. No hallucinated benchmarks
5. Jurisdiction correctly shows Venezuela (not Latin America)
"""
import os
import sys
import json
import time
import traceback

# Setup
sys.path.insert(0, os.path.dirname(__file__))
os.environ["ENVIRONMENT"] = "development"

from dotenv import load_dotenv
load_dotenv()

from langchain_core.messages import HumanMessage
from core.graph import app as graph_app

# ──────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────
DOCX_PATH = "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision/Originales/BANKING & FINANCE - ARAQUEREYNA - CHAMBERS 2027.docx"
THREAD_ID = "test-benchmark-v17-bf-araquereyna"

CONTEXT = {
    "directory": "Chambers",
    "jurisdiction": "Venezuela",
    "practice_area": "Banking & Finance",
    "current_status": "Ranked",
    "firm_name": "AraqueReyna",
    "submission_type": "Retention",
    "guide": "Latin America",
}

# ──────────────────────────────────────────
# BUILD INITIAL STATE
# ──────────────────────────────────────────
print("=" * 70)
print("🚀 RANKPILOT v17.0 — ARAQUEREYNA BANKING & FINANCE TEST")
print("=" * 70)
print(f"Document: {os.path.basename(DOCX_PATH)}")
print(f"Directory: {CONTEXT['directory']}")
print(f"Practice: {CONTEXT['practice_area']}")
print(f"Jurisdiction: {CONTEXT['jurisdiction']}")
print(f"Status: {CONTEXT['current_status']}")
print()

initial_state = {
    "file_path": DOCX_PATH,
    "doc_text": "",
    "messages": [HumanMessage(content="Please process this submission document.")],
    "metadata": {},
    "matters": [],
    "analysis": {},
    "latex_code": "",
    "confidence_score": 0.0,
    "is_complete": False,
    "pdf_url": "",
    "submission_context": CONTEXT,
    "strategic_context": {},
    # Editorial Reasoning Engine
    "comprehension": {},
    "competitive_identity": {},
    "hypotheses": [],
    "refutation_results": {},
    "comparative_analysis": {},
    "editorial_confidence": {},
    "narrative_architecture": {},
    "submission_blueprint": {},
    "evidence_map": {},
    "reasoning_trace": [],
    "editorial_memory": "",
    "current_step": "ingestion",
    "pipeline_manifest": {},
}

config = {"configurable": {"thread_id": THREAD_ID}}

# ──────────────────────────────────────────
# RUN PIPELINE
# ──────────────────────────────────────────
print("Starting pipeline... (this will take 5-12 minutes)")
print()
start = time.time()

try:
    result = graph_app.invoke(initial_state, config)
    elapsed = time.time() - start
    
    print()
    print("=" * 70)
    print(f"✅ PIPELINE COMPLETED in {elapsed:.1f}s ({elapsed/60:.1f} min)")
    print("=" * 70)
    
    # ──────────────────────────────────────────
    # VERIFY LIVE BENCHMARK INTEGRATION
    # ──────────────────────────────────────────
    strategic = result.get("strategic_context", {})
    
    print()
    print("--- LIVE BENCHMARK VERIFICATION ---")
    benchmark_source = strategic.get("benchmark_source", "unknown")
    print(f"Benchmark source: {benchmark_source}")
    
    live_benchmark = strategic.get("live_benchmark", {})
    if live_benchmark:
        print(f"✅ Live benchmark present!")
        print(f"   Firms: {live_benchmark.get('total_firms', '?')}")
        print(f"   Individuals: {live_benchmark.get('total_individuals', '?')}")
        firm_bands = live_benchmark.get('structure', {}).get('firm_bands', [])
        individual_cats = live_benchmark.get('structure', {}).get('individual_categories', [])
        print(f"   Firm bands: {firm_bands}")
        print(f"   Individual categories: {individual_cats}")
        has_firms = live_benchmark.get('structure', {}).get('has_firm_bands', False)
        print(f"   Has firm bands: {has_firms}")
    else:
        print("❌ No live benchmark in strategic_context")
    
    ravl = strategic.get("ranking_architecture", {})
    print(f"RAVL Scenario: {ravl.get('scenario', '?')}")
    print(f"Firm bands: {ravl.get('firm_bands_exist', '?')}")
    print(f"Live enriched: {ravl.get('live_enriched', False)}")
    
    # ──────────────────────────────────────────
    # EXTRACT ANALYSIS HIGHLIGHTS
    # ──────────────────────────────────────────
    analysis = result.get("analysis", {})
    if isinstance(analysis, dict):
        print()
        print("--- ANALYSIS OUTPUT HIGHLIGHTS ---")
        print(f"Confidence score: {analysis.get('confidence_score', '?')}")
        print(f"Confidence level: {analysis.get('confidence_level', '?')}")
        print(f"Recommended band: {analysis.get('recommended_band', '?')}")
        
        # Check if analysis references real benchmark data
        analysis_str = json.dumps(analysis, ensure_ascii=False)
        
        # Known firms in Banking & Finance Venezuela
        benchmark_firms = ["D'Empaire", "Hoet Pelaez", "Mendoza Palacios", "Baker McKenzie"]
        found_firms = [f for f in benchmark_firms if f.lower() in analysis_str.lower()]
        if found_firms:
            print(f"✅ Analysis references REAL benchmark firms: {found_firms}")
        else:
            print(f"ℹ️  Analysis does not directly reference competitor firm names")
        
        # Check for correct jurisdiction
        if "Venezuela" in analysis_str:
            print("✅ Correct jurisdiction: Venezuela")
        if "Latin America" in analysis_str and "Venezuela" not in analysis_str:
            print("⚠️  JURISDICTION ISSUE: References 'Latin America' but not 'Venezuela'")
        
        # Check matter evaluations
        evals = analysis.get("matter_evaluations", [])
        if isinstance(evals, list):
            print(f"Matter evaluations: {len(evals)}")
        
        # Check for anti-patterns
        if "Band 5 peers" in analysis_str or "Band 5 firms" in analysis_str:
            print("⚠️  ANTI-PATTERN: Hallucinated 'Band 5' references")
    
    # ──────────────────────────────────────────
    # SAVE FULL OUTPUT
    # ──────────────────────────────────────────
    output_path = "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision/pipeline_output_v17_araquereyna.json"
    
    serializable_result = {}
    for k, v in result.items():
        if k == "messages":
            serializable_result[k] = [str(m) for m in v]
        else:
            try:
                json.dumps(v, default=str)
                serializable_result[k] = v
            except (TypeError, ValueError):
                serializable_result[k] = str(v)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(serializable_result, f, indent=2, ensure_ascii=False, default=str)
    
    print()
    print(f"📄 Full output saved to: {output_path}")
    
except Exception as e:
    elapsed = time.time() - start
    print()
    print("=" * 70)
    print(f"❌ PIPELINE FAILED after {elapsed:.1f}s")
    print("=" * 70)
    print(f"Error: {e}")
    traceback.print_exc()
