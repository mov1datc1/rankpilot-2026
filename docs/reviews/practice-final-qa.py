"""Post-render model review of each synthetic practice's actual Word text."""
import json,os,sys
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from dotenv import load_dotenv
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'ai-engine'));load_dotenv(root/'ai-engine/.env');os.environ['OPENAI_MAX_OUTPUT_TOKENS']='10000';os.environ['OPENAI_REQUEST_TIMEOUT']='90'
from core.review_graph import review_rendered_package
cases=json.loads(Path(__file__).with_name('practice-artifact-qa.json').read_text())['results'];results=[]
if '--failed-only' in sys.argv:
 prior=json.loads(Path(__file__).with_name('practice-final-qa.json').read_text())['results']
 results=[{**r,'retained_previous_pass':True} for r in prior if r['passed']]
 passed={r['practice'] for r in results};cases=[c for c in cases if c['practice'] not in passed]
def run(c):
 if not c['rendered']:return {'practice':c['practice'],'passed':False,'error':c['error']}
 try:
  result=review_rendered_package({**c['request'],'trace':[]});return {'practice':c['practice'],'passed':result['judge']['passed'] and not any(d['severity']=='critical' for d in result['judge']['defects']),**result}
 except Exception as exc:return {'practice':c['practice'],'passed':False,'error':str(exc)[:300]}
with ThreadPoolExecutor(max_workers=3) as pool:
 for future in as_completed([pool.submit(run,c) for c in cases]):
  r=future.result();results.append(r);print(r['practice'],r['passed'],flush=True)
  Path(__file__).with_name('practice-final-qa.json').write_text(json.dumps({'scope':'Real model post-render review, actual DOCX text, synthetic cases. No authenticated production workflow.','results':results},ensure_ascii=False,indent=2))
raise SystemExit(0 if len(results)==10 and all(r['passed'] for r in results) else 1)
