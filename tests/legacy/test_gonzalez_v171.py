"""
RankPilot v17.1 Benchmark — González de Araujo
"""
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.abspath('ai-engine'))
from core.graph import app

FILE = "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision/Originales/González de Araujo - Data Protection - Chambers Latin America 2026.docx"
OUT = "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision"

async def main():
    state = {
        "file_path": FILE,
        "raw_text": "",
        "is_file": True,
        "submission_context": {
            "jurisdiction": "Mexico",
            "practice_area": "Data Protection",
            "directory": "Chambers",
            "current_status": "unranked"
        },
        "confidence_score": 0
    }
    print(f"\n{'='*70}")
    print(f"🚀 González de Araujo v17.1 — Data Protection Mexico")
    print(f"{'='*70}\n")
    start = time.time()
    try:
        result = await app.ainvoke(state, config={"configurable": {"thread_id": "gonzalez_v171"}})
        elapsed = time.time() - start
        print(f"\n✅ DONE in {elapsed:.0f}s ({elapsed/60:.1f} min)")
        
        analysis = result.get("analysis", {})
        matters = result.get("matters", [])
        audit = analysis.get("audit_letter", {})
        
        print(f"Score: {analysis.get('score', '?')}")
        print(f"Matters: {len(matters)}")
        print(f"Audit keys: {list(audit.keys()) if isinstance(audit, dict) else 'MISSING'}")
        
        evals = analysis.get("matter_evaluations", audit.get("matter_evaluations", []) if isinstance(audit, dict) else [])
        print(f"Matter evaluations: {len(evals)}")
        
        # Check matter word counts
        for i, m in enumerate(matters):
            if isinstance(m, dict):
                orig = len(m.get("raw_text", m.get("summary", "")).split())
                opt = len(m.get("optimized_text", "").split())
                title = m.get("title", "?")[:50]
                ratio = f"{opt/max(orig,1):.1f}x" if orig > 0 else "N/A"
                print(f"  Matter {i+1}: '{title}' | orig={orig}w → opt={opt}w ({ratio})")
        
        out_file = os.path.join(OUT, "pipeline_output_v171_gonzalez.json")
        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, default=str, ensure_ascii=False)
        print(f"\n📄 Saved: {out_file}")
    except Exception as e:
        print(f"\n❌ FAILED after {time.time()-start:.0f}s: {e}")
        import traceback; traceback.print_exc()

asyncio.run(main())
