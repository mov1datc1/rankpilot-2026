"""
v17.7 Model Comparison Test — González de Araujo Data Protection
================================================================
Usage:
  python3 test_model_compare.py gpt-4o
  python3 test_model_compare.py gpt-5.6-terra
"""
import os, sys, json, time, re

sys.path.insert(0, os.path.dirname(__file__))
os.environ["ENVIRONMENT"] = "development"

from dotenv import load_dotenv
load_dotenv()

# ── Model override ──
MODEL_NAME = sys.argv[1] if len(sys.argv) > 1 else "gpt-4o"
OUTPUT_FILE = f"/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/test_results_{MODEL_NAME.replace('.', '_').replace('-', '_')}.json"

print(f"\n{'='*70}")
print(f"MODEL COMPARISON TEST — {MODEL_NAME}")
print(f"{'='*70}")

# Monkey-patch BOTH get_model functions
import agents.editorial_nodes as en
import agents.nodes as nd

def make_patched_model(model_name, for_nodes=False):
    def patched():
        from langchain_openai import ChatOpenAI
        kwargs = {
            "model_name": model_name,
            "temperature": 0.0,
            "openai_api_key": os.environ.get("OPENAI_API_KEY"),
            "request_timeout": 300,  # v18.0: CRITICAL — prevents hangs with unstable internet
        }
        if for_nodes:
            kwargs["max_tokens"] = 8192
        else:
            kwargs["max_tokens"] = 16384  # v18.0: Editorial nodes need more output room
        
        # Model-specific parameters
        if "gpt-5" in model_name:
            # GPT-5.x: reasoning_effort supported, logit_bias NOT supported
            effort = "high" if not for_nodes else "medium"
            kwargs["model_kwargs"] = {"reasoning_effort": effort}
        elif "gpt-4o" in model_name or "gpt-4.1" in model_name:
            # GPT-4o/4.1: logit_bias supported (only for nodes)
            if for_nodes:
                kwargs["model_kwargs"] = {"logit_bias": {
                    "96138": -100, "77640": -100, "124315": -100,
                    "103445": -100, "79130": -100, "144018": -100,
                    "68202": -100, "111864": -100, "168008": -100,
                }}
        return ChatOpenAI(**kwargs)
    return patched

en.get_model = make_patched_model(MODEL_NAME, for_nodes=False)
nd.get_model = make_patched_model(MODEL_NAME, for_nodes=True)

from langchain_core.messages import HumanMessage
from core.graph import app as graph_app

# ── Configuration ──
DOCX_PATH = "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision/Originales/González de Araujo - Data Protection - Chambers Latin America 2026.docx"
THREAD_ID = f"test-model-compare-{MODEL_NAME}-{int(time.time())}"

CONTEXT = {
    "directory": "Chambers",
    "jurisdiction": "Mexico",
    "practice_area": "Data Protection",
    "current_status": "Unranked",
    "firm_name": "González de Araujo Consultores",
    "submission_type": "New Entry",
    "guide": "Latin America",
    "primary_objective": "First-time recognition",
}

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

# ── Run ──
print(f"Document: {os.path.basename(DOCX_PATH)}")
print(f"Model: {MODEL_NAME}")
print(f"Starting pipeline... (5-12 minutes)")
print()

start = time.time()
try:
    result = graph_app.invoke(initial_state, config)
    elapsed = time.time() - start
    
    # ── Extract metrics ──
    analysis = result.get("analysis", {})
    audit = analysis.get("audit_letter", {}) if isinstance(analysis, dict) else {}
    trace = result.get("reasoning_trace", [])
    
    all_analysis_text = json.dumps(analysis, default=str)
    all_trace_text = json.dumps(trace, default=str)
    all_text = all_analysis_text + all_trace_text
    
    cb_analysis = all_analysis_text.lower().count("cross-border")
    cb_trace = all_trace_text.lower().count("cross-border")
    cb_total = all_text.lower().count("cross-border")
    
    # Negative cross-border (penalizing)
    neg_patterns = [
        r"lacks?\s+cross.?border",
        r"limited\s+cross.?border", 
        r"lack\s+of\s+cross.?border",
        r"no\s+cross.?border\s+(?:work|evidence|matters)",
        r"absence\s+of\s+cross.?border",
        r"without\s+cross.?border",
        r"insufficient\s+cross.?border",
    ]
    neg_count = 0
    neg_matches = []
    for pat in neg_patterns:
        matches = re.findall(pat, all_text, re.IGNORECASE)
        neg_count += len(matches)
        neg_matches.extend(matches)
    
    score = analysis.get("confidence_score", 0) if isinstance(analysis, dict) else 0
    band = ""
    if isinstance(audit, dict):
        band = audit.get("band_alignment", audit.get("recommended_band", "N/A"))
    
    metrics = {
        "model": MODEL_NAME,
        "elapsed_seconds": round(elapsed, 1),
        "elapsed_minutes": round(elapsed / 60, 1),
        "confidence_score": score,
        "band_alignment": band,
        "cross_border_total": cb_total,
        "cross_border_in_analysis": cb_analysis,
        "cross_border_in_trace": cb_trace,
        "negative_cross_border_count": neg_count,
        "negative_cross_border_matches": neg_matches,
    }
    
    # Save
    output = {
        "metrics": metrics,
        "analysis": analysis,
        "reasoning_trace": trace,
        "strategic_context": result.get("strategic_context", {}),
    }
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f, indent=2, default=str, ensure_ascii=False)
    
    print(f"\n{'='*70}")
    print(f"✅ PIPELINE COMPLETED — {MODEL_NAME}")
    print(f"{'='*70}")
    print(f"  Time: {elapsed:.0f}s ({elapsed/60:.1f} min)")
    print(f"  Score: {score}")
    print(f"  Band: {band}")
    print(f"  Cross-border (total): {cb_total}")
    print(f"  Cross-border (analysis): {cb_analysis}")
    print(f"  Cross-border (trace): {cb_trace}")
    print(f"  Negative cross-border: {neg_count}")
    if neg_matches:
        for m in neg_matches:
            print(f"    🔴 \"{m}\"")
    else:
        print(f"    ✅ No negative cross-border references!")
    print(f"  Output: {OUTPUT_FILE}")
    print(f"{'='*70}")
    
except Exception as e:
    elapsed = time.time() - start
    import traceback
    print(f"\n❌ PIPELINE FAILED after {elapsed:.0f}s")
    traceback.print_exc()
    sys.exit(1)
