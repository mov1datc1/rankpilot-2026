"""Ten synthetic practices: real micro writers + editorial graph. No production writes."""
import json,os,sys,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from dotenv import load_dotenv
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'ai-engine'));load_dotenv(root/'ai-engine/.env')
os.environ['OPENAI_REQUEST_TIMEOUT']='90';os.environ['OPENAI_MAX_OUTPUT_TOKENS']='10000'
from agents.micro_optimizer import optimize_b10_micro,optimize_matter_micro
from core.review_graph import review_graph
scenarios={
 'Real Estate':'negotiated acquisition documents and reviewed title for a warehouse site; closing remains pending',
 'Labour & Employment':'represented the employer in collective bargaining; negotiations remain pending',
 'Tax':'challenged an income tax assessment before a tax tribunal; the appeal remains pending',
 'Corporate/M&A':'advised the buyer on acquisition of all shares in a target company; closing remains pending',
 'Banking & Finance':'negotiated a syndicated credit facility for the borrower; signing remains pending',
 'Energy & Natural Resources':'advised on an electricity generation permit; the application remains pending',
 'Competition':'represented the client in a merger clearance proceeding; regulatory clearance remains pending',
 'Intellectual Property':'represented the client in a trademark opposition; the opposition remains pending',
 'Data Protection':'advised on response to a personal data breach; the regulatory investigation remains pending',
 'Dispute Resolution':'represented the claimant in a commercial arbitration; no award has been issued and the proceedings remain pending',
}
def run(item):
 idx,(practice,work)=item;start=time.monotonic();source=f'Synthetic Aurora Legal {work} for Synthetic Client {idx}. Partner Sofia Vega led this mandate in Mexico, with documented work on 15 September 2026. The source reports a matter value of MXN 1000000. No final outcome or financial recovery is claimed. Publication is explicitly authorized.'
 b10=f'Synthetic Aurora Legal advises on {practice} in Mexico. Partner Sofia Vega leads this practice. The department describes one mandate in 2026: it {work}. No market ranking, wider team size or wider geographic footprint is claimed.'
 m={'id':f'qa-{idx}','client':f'Synthetic Client {idx}','name':practice+' mandate','summary':source,'rawNotes':source,'source_excerpt':source,'leadPartner':'Sofia Vega','value':'MXN 1000000','publish_status':'publishable','confidentialityConfirmed':True,'isConfidential':False,'completionDate':'Pending as of 30 September 2026'}
 try:
  mb=optimize_b10_micro(b10,practice,'Synthetic Aurora Legal');mm=optimize_matter_micro(m,practice_area=practice,firm_name='Synthetic Aurora Legal')
  if not mb.get('success') or not mm.get('success'):raise ValueError('Micro writer failed')
  m['optimizedText']=mm['optimized_text']
  package={'directory':'Chambers','practice_area':practice,'jurisdiction':'Mexico','research_period':{'from':'2025-10-01','to':'2026-09-30','source':'Synthetic authorized submission instructions'},'firm_name':'Synthetic Aurora Legal','b10_source':b10,'b10_draft':mb['enhanced_b10'],'lawyers':[{'name':'Sofia Vega','is_partner':True,'isPartner':True}],'matters':[m]}
  result=review_graph.invoke({'package':package},{'recursion_limit':12})
  return {'practice':practice,'completed':True,'approved':result['release_verdict']['passed'],'seconds':round(time.monotonic()-start,2),'package':package,'review':result}
 except Exception as exc:return {'practice':practice,'completed':False,'approved':False,'error':str(exc)[:400]}
results=[]
with ThreadPoolExecutor(max_workers=3) as pool:
 for future in as_completed([pool.submit(run,item) for item in enumerate(scenarios.items(),1)]):
  result=future.result();results.append(result);print(result['practice'],result['completed'],result['approved'],flush=True)
  Path(__file__).with_name('practice-editorial-qa.json').write_text(json.dumps({'scope':'Synthetic real micro optimization + model graph across 10 practices. Not authenticated end-to-end or population accuracy estimate.','results':results},ensure_ascii=False,indent=2))
raise SystemExit(0 if all(r['completed'] and r['approved'] for r in results) else 1)
