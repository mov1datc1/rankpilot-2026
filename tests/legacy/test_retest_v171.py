"""
RankPilot v17.1 Quick Retest — Both cases, verify score unwrapper
"""
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.abspath('ai-engine'))
from core.graph import app

OUT = "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision"

CASES = [
    {
        "name": "González",
        "file": "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision/Originales/González de Araujo - Data Protection - Chambers Latin America 2026.docx",
        "context": {"jurisdiction": "Mexico", "practice_area": "Data Protection", "directory": "Chambers", "current_status": "unranked"},
        "thread": "gonzalez_v171_retest"
    },
    {
        "name": "AraqueReyna",
        "file": "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision/Originales/BANKING & FINANCE - ARAQUEREYNA - CHAMBERS 2027.docx",
        "context": {"jurisdiction": "Venezuela", "practice_area": "Banking & Finance", "directory": "Chambers", "current_status": "Band 3"},
        "thread": "araquereyna_v171_retest"
    }
]

async def run_case(case):
    state = {
        "file_path": case["file"],
        "raw_text": "",
        "is_file": True,
        "submission_context": case["context"],
        "confidence_score": 0
    }
    print(f"\n{'='*70}")
    print(f"🚀 {case['name']} v17.1 RETEST")
    print(f"{'='*70}\n")
    start = time.time()
    try:
        result = await app.ainvoke(state, config={"configurable": {"thread_id": case["thread"]}})
        elapsed = time.time() - start
        
        analysis = result.get("analysis", {})
        matters = result.get("matters", [])
        score = analysis.get("score", "MISSING")
        risk = analysis.get("risk_level", "MISSING")
        audit = analysis.get("audit_letter", {})
        evals = analysis.get("matter_evaluations", [])
        
        print(f"\n✅ {case['name']} DONE in {elapsed:.0f}s ({elapsed/60:.1f} min)")
        print(f"  Score: {score}")
        print(f"  Risk: {risk}")
        print(f"  Matters: {len(matters)}")
        print(f"  Evaluations: {len(evals)}")
        print(f"  Audit letter keys: {list(audit.keys()) if isinstance(audit, dict) else type(audit).__name__}")
        
        # Show audit letter content if present
        if isinstance(audit, dict) and audit:
            for k, v in list(audit.items())[:5]:
                print(f"    {k}: {str(v)[:150]}")
        
        # Show matter details
        for i, m in enumerate(matters):
            if isinstance(m, dict):
                orig = len(m.get("raw_text", m.get("summary", "")).split())
                opt = len(m.get("optimized_text", "").split())
                title = m.get("title", "?")[:50]
                print(f"  Matter {i+1}: '{title}' | {orig}w → {opt}w ({opt/max(orig,1):.1f}x)")
        
        out_file = os.path.join(OUT, f"pipeline_output_v171_retest_{case['name'].lower().replace(' ', '_')}.json")
        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, default=str, ensure_ascii=False)
        print(f"  📄 Saved: {out_file}")
        return True
    except Exception as e:
        print(f"\n❌ {case['name']} FAILED after {time.time()-start:.0f}s: {e}")
        import traceback; traceback.print_exc()
        return False

async def main():
    for case in CASES:
        await run_case(case)
    print(f"\n{'='*70}")
    print(f"🏁 ALL RETESTS COMPLETE")
    print(f"{'='*70}")

asyncio.run(main())
