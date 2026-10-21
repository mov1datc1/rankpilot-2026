"""Review text extracted from the real synthetic DOCX with the configured judge."""
import asyncio,json,os,sys
from pathlib import Path
from dotenv import load_dotenv
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'ai-engine'));load_dotenv(root/'ai-engine/.env')
os.environ['OPENAI_REQUEST_TIMEOUT']='90';os.environ['OPENAI_MAX_OUTPUT_TOKENS']='10000'
from main import verify_rendered_package_endpoint
class Request:
 async def json(self):return json.loads(Path(__file__).with_name('rendered-editorial-package-qa.json').read_text())
response=asyncio.run(verify_rendered_package_endpoint(Request()));result=json.loads(response.body)
Path(__file__).with_name('verify-rendered-live-qa.json').write_text(json.dumps({'status':response.status_code,'result':result},ensure_ascii=False,indent=2))
print(response.status_code,result.get('judge'),flush=True)
raise SystemExit(0 if result.get('judge',{}).get('passed') else 1)
