"""Opt-in paid check of the production extraction chain on monetary contexts."""
import argparse
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'ai-engine'))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--live',action='store_true')
    parser.add_argument('--output',default='scratch/monetary-context-eval.json')
    args=parser.parse_args()
    if not args.live:parser.error('--live is required: this uses paid model calls')
    path=ROOT/args.output
    if path.exists():parser.error('Use a new output file; preserve earlier results.')
    from dotenv import load_dotenv
    load_dotenv(ROOT/'ai-engine/.env')
    from langchain_core.callbacks import BaseCallbackHandler
    from chains.extraction_chain import get_extraction_chain
    from utils.canonical_builder import reconcile_extracted_matters_to_source
    class Usage(BaseCallbackHandler):
        calls=[]
        def on_llm_end(self,response,**kwargs):
            for group in response.generations:
                for generation in group:
                    self.calls.append(getattr(generation.message,'usage_metadata',None))
    examples=[
        ('USD 1000000','The facility was MXN 20 million, stated in the source as equivalent to USD 1000000.'),
        ('USD 1000000','The facility principal was USD 1000000. A separate employment claim involved MXN 4 million.'),
        ('USD 1000000','The same facility principal was MXN 1000000; the narrative expressly rejects the dollar denomination.')]
    sections=[f'Confidential Matter {i}\nE1 Name of client\nSynthetic Client {i}\nE2 Summary\nThe firm advised the client. {text}\nE3 Matter value\n{value}\nE4 Cross-border jurisdictions\nNo.\nE5 Lead partner\nSofia Vega\nE8 Current status\nPending.' for i,(value,text) in enumerate(examples,1)]
    source='A1 Firm\nSynthetic Aurora Legal\nA2 Country\nMexico\nA3 Practice\nBanking & Finance\n\n'+'\n\n'.join(sections)
    labels=[f'Confidential Matter {i}' for i in range(1,4)]
    usage=Usage()
    parsed=get_extraction_chain().invoke({'text':'SOURCE MANIFEST: '+json.dumps({'total':3,'matter_labels':labels})+'\nSOURCE DOCUMENT:\n'+source},config={'callbacks':[usage]})
    data=parsed.model_dump()
    matters,report=reconcile_extracted_matters_to_source(data['matters'],labels,source)
    by_label={m['source_label']:m for m in matters}
    checks={'all_three':len(matters)==3,
        'equivalence_preserved':not by_label.get(labels[0],{}).get('value_conflict'),
        'separate_concepts_preserved':not by_label.get(labels[1],{}).get('value_conflict'),
        'actual_conflict_preserved':bool(by_label.get(labels[2],{}).get('value_conflict'))}
    result={'scope':'Production extraction chain plus canonical reconciliation on synthetic monetary contexts',
        'checks':checks,'passed':all(checks.values()),'usage':usage.calls,'source':source,'extracted':data,'reconciled':matters,'reconciliation':report}
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({k:result[k] for k in ('checks','passed','usage')},ensure_ascii=False))
    raise SystemExit(0 if result['passed'] else 1)
