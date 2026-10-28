"""
RankPilot v17.1 Benchmark — AraqueReyna Banking & Finance Venezuela
"""
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.abspath('ai-engine'))
from core.graph import app

FILE = "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision/Originales/BANKING & FINANCE - ARAQUEREYNA - CHAMBERS 2027.docx"
OUT = "/Users/jonathanpalacios/Downloads/Rankpilot-2026/analizar/Submission_revision"

async def main():
    state = {
        "file_path": FILE,
        "raw_text": "",
        "is_file": True,
        "submission_context": {
            "jurisdiction": "Venezuela",
            "practice_area": "Banking & Finance",
            "directory": "Chambers",
            "current_status": "Band 3"
        },
        "confidence_score": 0
    }
    print(f"\n{'='*70}")
    print(f"🚀 AraqueReyna v17.1 — Banking & Finance Venezuela")
    print(f"{'='*70}\n")
    start = time.time()
    try:
        result = await app.ainvoke(state, config={"configurable": {"thread_id": "araquereyna_v171"}})
        elapsed = time.time() - start
        print(f"\n✅ DONE in {elapsed:.0f}s ({elapsed/60:.1f} min)")
        
        analysis = result.get("analysis", {})
        matters = result.get("matters", [])
        audit = analysis.get("audit_letter", {})
        strategic = result.get("strategic_context", {})
        
        print(f"Score: {analysis.get('score', '?')}")
        print(f"Matters extracted: {len(matters)}")
        print(f"Audit keys: {list(audit.keys()) if isinstance(audit, dict) else 'MISSING'}")
        
        evals = analysis.get("matter_evaluations", audit.get("matter_evaluations", []) if isinstance(audit, dict) else [])
        print(f"Matter evaluations: {len(evals)}")
        
        # Show each matter
        for i, m in enumerate(matters):
            if isinstance(m, dict):
                orig = len(m.get("raw_text", m.get("summary", "")).split())
                opt = len(m.get("optimized_text", "").split())
                title = m.get("title", "?")[:60]
                client = m.get("client", "?")[:30]
                ratio = f"{opt/max(orig,1):.1f}x" if orig > 0 else "N/A"
                print(f"  Matter {i+1}: '{title}' | Client: {client} | orig={orig}w → opt={opt}w ({ratio})")
        
        # Check benchmark
        benchmark = strategic.get("live_benchmark", {})
        if benchmark:
            print(f"\nLive Benchmark: {benchmark.get('source', '?')} | Firms: {len(benchmark.get('firm_bands', []))}")
        
        # Check evidence preservation
        opt_all = " ".join([m.get("optimized_text", "") for m in matters if isinstance(m, dict)])
        for kw in ['JP Morgan', 'Simmons', 'Debevoise', 'Kennedys', 'SUDEBAN', 'Planchart']:
            if kw.lower() in opt_all.lower():
                print(f"  ✅ Evidence preserved: {kw}")
            else:
                print(f"  ⚠️ Evidence check: {kw} (may be in audit letter instead)")
        
        out_file = os.path.join(OUT, "pipeline_output_v171_araquereyna.json")
        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, default=str, ensure_ascii=False)
        print(f"\n📄 Saved: {out_file}")
    except Exception as e:
        print(f"\n❌ FAILED after {time.time()-start:.0f}s: {e}")
        import traceback; traceback.print_exc()

asyncio.run(main())
