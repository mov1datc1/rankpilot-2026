"""Synthetic live editorial graph QA; no DB writes or customer information."""
import json,os,sys,time
from pathlib import Path
from dotenv import load_dotenv
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'ai-engine'));load_dotenv(root/'ai-engine/.env')
os.environ['OPENAI_REQUEST_TIMEOUT']='90';os.environ['OPENAI_MAX_OUTPUT_TOKENS']='10000'
from core.review_graph import review_graph
source='Synthetic Aurora Legal represented Synthetic Buyer in a tax appeal before the Mexican Federal Administrative Justice Court in 2026. Partner Sofia Vega led the representation. The disputed assessment is MXN 1000000. The appeal remains pending; no ruling or financial recovery has occurred. Publication is explicitly authorized.'
b10='Synthetic Aurora Legal advises on tax disputes in Mexico. Partner Sofia Vega leads the department. The supplied mandate is a pending tax appeal. No broader team size, geographic footprint or market ranking is claimed.'
base={'directory':'Chambers','practice_area':'Tax','jurisdiction':'Mexico','firm_name':'Synthetic Aurora Legal','b10_source':b10,'b10_draft':b10,'lawyers':[{'name':'Sofia Vega','is_partner':True}], 'matters':[{'id':'qa-1','client':'Synthetic Buyer','rawNotes':source,'source_excerpt':source,'summary':source,'optimizedText':source,'leadPartner':'Sofia Vega','value':'MXN 1000000','publish_status':'publishable','confidentialityConfirmed':True,'isConfidential':False}]}
results=[]
for name,package in [('grounded',base),('invented_outcome',{**base,'matters':[{**base['matters'][0],'optimizedText':'The team won the appeal and recovered MXN 9000000 for the client.'}]})]:
 start=time.monotonic()
 try:
  result=review_graph.invoke({'package':package},{'recursion_limit':12})
  verdict=result['release_verdict'];passed=(not verdict['passed']) if name=='invented_outcome' else bool(result.get('letter') and result.get('strategy'))
  results.append({'case':name,'check':'reject fabricated outcome' if name=='invented_outcome' else 'complete review; editorial approval recorded separately','passed':passed,'seconds':round(time.monotonic()-start,2),'strategy':result.get('strategy'),'letter':result.get('letter'),'judge':result.get('judge'),'release':verdict,'trace':result.get('trace')})
 except Exception as exc:results.append({'case':name,'passed':False,'error':type(exc).__name__+': '+str(exc)[:500]})
 print(name,results[-1]['passed'],flush=True)
 Path(__file__).with_name('editorial-graph-live-qa.json').write_text(json.dumps({'scope':'Synthetic live model graph; no DB/browser or rendering. Grounded case requires completed review, not automatic approval.','results':results},ensure_ascii=False,indent=2))
raise SystemExit(0 if all(r['passed'] for r in results) else 1)
