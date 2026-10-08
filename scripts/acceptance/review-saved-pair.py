"""Review saved, hash-checked Word text; preserves previous results and never repairs implicitly."""
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'ai-engine'))
load_dotenv(root / 'ai-engine/.env')
os.environ['OPENAI_API_BASE'] = 'https://api.openai.com/v1'
os.environ['OPENAI_BASE_URL'] = 'https://api.openai.com/v1'
from core.review_graph import review_rendered_package
from utils.engine_identity import engine_fingerprint

directory = Path(sys.argv[1]).resolve()
case = sys.argv[2]
saved = json.loads((directory / f'{case}-rendered.json').read_text())
for artifact in saved['files']:
    path = directory / f'{case}-{artifact["kind"]}.docx'
    assert hashlib.sha256(path.read_bytes()).hexdigest() == artifact['sha256'], 'Artifact changed'
    field = 'rendered_artifact' if artifact['kind'] == 'Submission' else 'rendered_audit'
    assert (directory / f'{case}-{artifact["kind"]}.txt').read_text() == saved['state']['package'][field], 'Text changed'
state = saved['state']
state['trace'] = []
state['node_events'] = []
target = directory / f'{case}-artifact-review.json'
stamp = str(time.time_ns())
if target.exists():
    target.with_name(target.name + '.before-resume-' + stamp).write_bytes(target.read_bytes())
try:
    result = review_rendered_package(state, allow_repair=False)
    output = {'engine_fingerprint': engine_fingerprint(), 'artifacts': saved['files'], 'result': result}
except Exception as error:
    output = {'artifacts': saved['files'], 'exception': type(error).__name__, 'message': str(error)}
target.write_text(json.dumps(output, ensure_ascii=False, indent=2))
print(case, 'passed', output.get('result', {}).get('judge', {}).get('passed'), 'error', output.get('exception'), flush=True)
