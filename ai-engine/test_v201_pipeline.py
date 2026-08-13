"""
v20.1 Pipeline Test — González de Araujo (Data Protection)
Runs the full LangGraph pipeline locally against the original DOCX.
Saves the output as JSON and generates a v20.1 DOCX for comparison.
"""
import sys
import os
import json
import time

# Setup paths
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from langchain_core.messages import HumanMessage

# Build the graph
from core.graph import create_rankpilot_graph
graph = create_rankpilot_graph()

# Input file
DOCX_PATH = "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision/Originales/González de Araujo - Data Protection - Chambers Latin America 2026.docx"
OUTPUT_DIR = "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision"

assert os.path.exists(DOCX_PATH), f"DOCX not found: {DOCX_PATH}"

# Build initial state
context = {
    "directory": "Chambers Latin America",
    "jurisdiction": "Mexico",
    "practice_area": "Data Protection",
    "current_status": "Ranked Band 1",
    "firm_name": "González de Araujo",
}

thread_id = f"test_v201_{int(time.time())}"
config = {"configurable": {"thread_id": thread_id}}

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
    "submission_context": context,
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
    "original_b10": "",
    "enhanced_b7": "",
}

print("=" * 70)
print(f"RUNNING v20.1 PIPELINE TEST — González de Araujo (Data Protection)")
print(f"Thread: {thread_id}")
print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)

start_time = time.time()

try:
    output = graph.invoke(initial_state, config)
    elapsed = time.time() - start_time
    
    print(f"\n{'=' * 70}")
    print(f"PIPELINE COMPLETED in {elapsed:.1f}s")
    print(f"{'=' * 70}")
    
    # Save the raw output
    matters = output.get("matters", [])
    print(f"\nTotal matters: {len(matters)}")
    
    # Save pipeline output
    output_path = os.path.join(OUTPUT_DIR, f"pipeline_output_v201_test.json")
    serializable = {
        "thread_id": thread_id,
        "elapsed_seconds": elapsed,
        "matter_count": len(matters),
        "matters": [],
    }
    
    for i, m in enumerate(matters):
        opt_text = m.get('optimized_text', m.get('summary', ''))
        word_count = len(opt_text.split())
        serializable["matters"].append({
            "index": i + 1,
            "title": m.get('title', ''),
            "client": m.get('client', ''),
            "status": m.get('status', ''),
            "word_count": word_count,
            "optimized_text": opt_text,
            "first_word": opt_text.split()[0] if opt_text.split() else "",
        })
        
        # Print summary
        first_words = opt_text[:100] if opt_text else "EMPTY"
        print(f"  M{i+1} ({m.get('client', '?')}): {word_count}w | First: {opt_text.split()[0] if opt_text.split() else '?'} | {first_words}...")
        
        # Check for splice
        if 'Modelquipo' in opt_text and 'Excelsior' in m.get('client', ''):
            print(f"    ⚠️ SPLICE STILL PRESENT!")
        if '| No' in opt_text:
            print(f"    ⚠️ TABLE ARTIFACT STILL PRESENT!")
    
    with open(output_path, 'w') as f:
        json.dump(serializable, f, indent=2, ensure_ascii=False)
    
    print(f"\nOutput saved to: {output_path}")
    
    # Check opening diversity
    first_words = [m["first_word"] for m in serializable["matters"]]
    unique_words = len(set(first_words))
    print(f"\nOpening diversity: {unique_words}/7 unique")
    print(f"  Words: {first_words}")
    if unique_words < 7:
        dupes = [w for w in first_words if first_words.count(w) > 1]
        print(f"  Duplicates: {set(dupes)}")
    
    # Check word counts
    print(f"\nWord counts:")
    for m in serializable["matters"]:
        flag = "⚠️ SHORT" if m["word_count"] < 150 else "✅"
        print(f"  M{m['index']}: {m['word_count']}w {flag}")

except Exception as e:
    elapsed = time.time() - start_time
    print(f"\n❌ PIPELINE FAILED after {elapsed:.1f}s: {e}")
    import traceback
    traceback.print_exc()
