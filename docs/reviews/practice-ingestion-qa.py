"""Ten synthetic practices, actual DOCX parser (A) and real model with two sources (B).
No DB writes. This checks extraction, not full editorial generation or ranking quality.
"""
import importlib.util
import json
from pathlib import Path
import tempfile
from docx import Document
spec=importlib.util.spec_from_file_location('ingestion_qa',Path(__file__).with_name('stress-ingestion-2026-10-02.py'))
qa=importlib.util.module_from_spec(spec);spec.loader.exec_module(qa)
scenarios={
 'Real Estate':'negotiated the acquisition of a warehouse site',
 'Labour & Employment':'represented the employer in collective bargaining',
 'Tax':'challenged an income tax assessment before a tax tribunal',
 'Corporate/M&A':'advised the buyer on acquisition of all shares in a target company',
 'Banking & Finance':'negotiated a syndicated credit facility for the borrower',
 'Energy & Natural Resources':'advised on an electricity generation permit',
 'Competition':'represented the client in a merger clearance proceeding',
 'Intellectual Property':'represented the client in a trademark opposition',
 'Data Protection':'advised on response to a personal data breach',
 'Dispute Resolution':'represented the claimant in a commercial arbitration',
}
results=[]
with tempfile.TemporaryDirectory(prefix='rankpilot-practice-qa-') as temp:
 for idx,(practice,work) in enumerate(scenarios.items()):
  client=f'Synthetic Client {idx+100}';code=f'QA-{idx+100}'
  context={'practice_area':practice,'jurisdiction':'Mexico','firm_name':'Synthetic Aurora Legal'}
  text=qa.block(client).replace('The team challenged an assessment before the tax tribunal. The matter remains pending.',f'Synthetic Aurora Legal {work}. The matter remains pending.')
  p=Path(temp)/f'{code}.docx';doc=Document()
  for line in text.splitlines():doc.add_paragraph(line)
  doc.save(p)
  payloads=[('A',{'user_input':str(p),'sources':[{'url':str(p),'name':p.name}],'context':context}),('B',{'sources':[
    {'name':'instruction.txt','text':f'Synthetic Aurora Legal, Mexico. Matter {code}: partner Sofia Vega {work} for {client}. Matter value MXN 1000000. Publication permission explicitly granted.'},
    {'name':'update.txt','text':f'Update for the same matter {code} and client {client}: the matter remains pending. No outcome or award has been obtained. No other mandate is described.'}], 'context':context})]
  for mode,payload in payloads:
   status,body,seconds,_=qa.call(payload);matters=body.get('matters',[])
   passed=status==200 and len(matters)==1 and matters[0].get('client')==client and matters[0].get('confidentialityStatus')=='publishable' and not matters[0].get('optimizedText')
   results.append({'practice':practice,'mode':mode,'passed':passed,'status':status,'seconds':seconds,'response':body})
   print(practice,mode,passed,flush=True)
report={'scope':'10 practices: real DOCX extraction A and live model narrative ingestion B. Not full pipeline or browser end-to-end.','total':len(results),'passed':sum(r['passed'] for r in results),'results':results}
Path(__file__).with_name('practice-ingestion-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(0 if report['passed']==report['total'] else 1)
