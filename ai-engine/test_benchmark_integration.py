"""
Full Pipeline Test — Live Benchmark Engine v17.0
=================================================
Runs the COMPLETE 16-node RankPilot pipeline with a real submission document.
Uses: González de Araujo — Data Protection — Chambers Latin America 2026

This is the definitive end-to-end verification that:
1. The DOCX is parsed correctly
2. The Live Benchmark Engine scrapes real Chambers data
3. The benchmark is injected into strategic_context
4. The LLM receives REAL firm names and band data
5. The final output references actual benchmark data (not hallucinated)
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
DOCX_PATH = "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision/Originales/González de Araujo - Data Protection - Chambers Latin America 2026.docx"
THREAD_ID = "test-benchmark-v17-dp"

CONTEXT = {
    "directory": "Chambers",
    "jurisdiction": "Mexico",
    "practice_area": "Data Protection",
    "current_status": "Unranked",
    "firm_name": "González de Araujo",
    "submission_type": "New Entry",
    "guide": "Latin America",
}

# ──────────────────────────────────────────
# BUILD INITIAL STATE
# ──────────────────────────────────────────
print("=" * 70)
print("🚀 RANKPILOT v17.0 — FULL PIPELINE TEST")
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
print("Starting pipeline... (this will take 3-5 minutes)")
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
        print(f"   Categories: {live_benchmark.get('structure', {}).get('individual_categories', [])}")
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
        
        # Check if the analysis mentions real benchmark data
        analysis_str = json.dumps(analysis, ensure_ascii=False)
        benchmark_names = ["Héctor Guzmán", "Isabel Davara", "Carlos Vela", "Paola Morales"]
        found_names = [name for name in benchmark_names if name in analysis_str]
        if found_names:
            print(f"✅ Analysis references REAL benchmark names: {found_names}")
        else:
            print(f"ℹ️  Analysis does not directly reference individual names (may use firm-level data)")
        
        # Check for anti-patterns (hallucinated benchmarks)
        if "Band 5 peers typically" in analysis_str:
            print("⚠️  ANTI-PATTERN DETECTED: 'Band 5 peers typically' — may be hallucinated")
        if "firms at Band" in analysis_str.lower() and not live_benchmark.get("structure", {}).get("has_firm_bands"):
            print("⚠️  ANTI-PATTERN: References firm bands when NONE exist for this practice")
    
    # ──────────────────────────────────────────
    # SAVE FULL OUTPUT
    # ──────────────────────────────────────────
    output_path = "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision/pipeline_output_v17_benchmark_test.json"
    
    # Remove non-serializable items
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
