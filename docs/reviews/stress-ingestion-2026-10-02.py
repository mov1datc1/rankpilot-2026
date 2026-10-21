"""Exercise the actual /extract handler, isolated from database and production.
Default: deterministic parsing and injected faults. --live: four synthetic LLM calls.
"""
import asyncio
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / 'ai-engine'
sys.path.insert(0, str(ENGINE))
from dotenv import load_dotenv
load_dotenv(ENGINE / '.env')
# Explicit QA bounds; output reports these overrides. Do not change project .env.
os.environ['OPENAI_REQUEST_TIMEOUT'] = '60'
os.environ['OPENAI_MAX_OUTPUT_TOKENS'] = '4096'
from main import extract_document_endpoint
from docx import Document

class Request:
    def __init__(self, payload): self.payload = payload
    async def json(self): return self.payload

def block(client, number=1, prefix='Publishable'):
    letter = 'E' if prefix == 'Confidential' else 'D'
    return f'''{prefix} Matter {number}
{letter}1 Name of client
{client}
{letter}2 Summary of matter and your department's role
The team challenged an assessment before the tax tribunal. The matter remains pending.
{letter}3 Matter value
MXN 1000000
{letter}4 Cross-border elements
No
{letter}5 Lead partner
Sofia Vega
{letter}6 Other team members
Luis Paz
{letter}7 Other firms advising
None
{letter}8 Date of completion
Ongoing
{letter}9 Other information
None
'''

def call(payload):
    capture = io.StringIO()
    start = time.monotonic()
    with contextlib.redirect_stdout(capture), contextlib.redirect_stderr(capture):
        response = asyncio.run(extract_document_endpoint(Request(payload)))
    body = json.loads(response.body)
    return response.status_code, body, round(time.monotonic()-start, 3), capture.getvalue()

def main():
    results = []
    def record(name, payload, expect, layer):
        status, body, seconds, logs = call(payload)
        observed = {'status':status,'success':body.get('success'),'matters':len(body.get('matters',[])),
            'clients':[m.get('client') for m in body.get('matters',[])],
            'confidentiality':[m.get('confidentialityStatus') for m in body.get('matters',[])],
            'error':body.get('error'), 'model_error_caught':'EXTRACTION ERROR' in logs,
            'empty_optimized_text':all(not m.get('optimizedText') for m in body.get('matters',[])),
            'seconds':seconds}
        if layer.startswith('live_'):
            observed['extracted'] = body
            observed['extraction_errors'] = [line[:600] for line in logs.splitlines() if 'EXTRACTION ERROR' in line]
        passed = expect(status,body) and not (layer.startswith('live_') and observed['model_error_caught'])
        if name == 'live_multi_source_same_mandate' and passed:
            passed = body['matters'][0].get('confidentialityStatus') == 'confirmation_required'
        if name == 'live_two_distinct_ip_matters' and passed:
            permissions = {m.get('client'): m.get('confidentialityStatus') for m in body['matters']}
            passed = permissions == {'Synthetic Labs':'confidential', 'Synthetic Foods':'publishable'}
        if name == 'live_conflicting_values' and passed:
            m = body['matters'][0]
            passed = not m.get('value') and 'USD' in m.get('valueConflict','') and 'MXN' in m.get('valueConflict','')
        results.append({'id':name,'passed':passed,'layer':layer,'observed':observed})
        print(json.dumps(results[-1],ensure_ascii=False),flush=True)
    context={'practice_area':'Tax','jurisdiction':'Mexico','firm_name':'Synthetic Legal'}
    if '--live' not in sys.argv:
        # No live calls allowed in this branch.
        with patch('agents.nodes.get_extraction_chain',side_effect=RuntimeError('Injected extractor failure')):
            record('A_numbered_plaintext',{'user_input':block('Synthetic Alpha'),'context':context},
                lambda s,b:s==200 and len(b.get('matters',[]))==1 and b['matters'][0]['client']=='Synthetic Alpha','real_parser')
            record('A_confidential_plaintext',{'user_input':block('Synthetic Secret',prefix='Confidential'),'context':context},
                lambda s,b:s==200 and len(b.get('matters',[]))==1 and b['matters'][0]['isConfidential'],'real_parser')
            record('B_sources_only',{'sources':[{'name':'notes.txt','text':block('Synthetic Alpha')}],'context':context},
                lambda s,b:s==200 and len(b.get('matters',[]))==1,'real_handler')
            record('B_two_docs_repeated_number',{'user_input':'source bundle','sources':[{'name':'alpha.txt','text':block('Synthetic Alpha')},{'name':'beta.txt','text':block('Synthetic Beta')}],'context':context},
                lambda s,b:s==200 and set(m['client'] for m in b.get('matters',[]))=={'Synthetic Alpha','Synthetic Beta'},'real_parser')
            record('extractor_failure_is_not_success',{'user_input':'Unstructured legal notes with no headings.','context':context},
                lambda s,b:s>=400 or b.get('success') is False,'fault_injected_at_model_factory')
            record('irrelevant_recipe_does_not_build',{'user_input':'Recipe: mix flour and water, bake for twenty minutes.','context':context},
                lambda s,b:s>=400 or b.get('success') is False,'fault_injected_at_model_factory_not_semantic_eval')
            with tempfile.TemporaryDirectory(prefix='rankpilot-ingestion-') as temp:
                path=Path(temp)/'synthetic-tax.docx';doc=Document()
                for line in block('Synthetic DOCX').splitlines():doc.add_paragraph(line)
                doc.save(path)
                record('A_real_docx',{'user_input':str(path),'sources':[{'url':str(path),'name':path.name}],'context':context},
                    lambda s,b:s==200 and len(b.get('matters',[]))==1 and b['matters'][0]['client']=='Synthetic DOCX','real_docx_parser')
                record('B_partial_source_failure',{'user_input':'source bundle','sources':[{'url':str(path),'name':path.name},{'url':str(Path(temp)/'missing.docx'),'name':'missing.docx'}],'context':context},
                    lambda s,b:bool(b.get('source_errors')) or bool(b.get('warnings')) or 'missing.docx' in str(b.get('error','')),'real_docx_parser_missing_file')
        mode='offline'
    else:
        cases=[
          ('irrelevant_recipe','Tax',[{'name':'recipe.txt','text':'Recipe for bread: mix flour, yeast and water, knead and bake. This is a cooking recipe, not a legal matter.'}],0),
          ('multi_source_same_mandate','Corporate/M&A',[
            {'name':'email.txt','text':'Synthetic Aurora Legal. Partner Sofia Vega advised Synthetic Buyer on acquiring all shares of Synthetic Target in Mexico. Transaction code ALPHA-2026. Price USD 12000000. Publication permission not supplied.'},
            {'name':'closing.txt','text':'Transaction ALPHA-2026 closed on 10 September 2026. Synthetic Buyer acquired all shares of Synthetic Target. Lead partner Sofia Vega. No other transactions in this note.'}],1),
          ('two_distinct_ip_matters','Intellectual Property',[
            {'name':'patent.txt','text':'Synthetic Aurora Legal represented Synthetic Labs in patent infringement case IP-01 in Mexico. Lead partner Sofia Vega. Interim injunction obtained; final merits pending. Confidential. No value stated.'},
            {'name':'trademark.txt','text':'Synthetic Aurora Legal advised Synthetic Foods in trademark opposition IP-02 in Mexico. Lead partner Luis Paz. Opposition remains pending. Publication explicitly authorized. No value stated.'}],2),
          ('conflicting_values','Energy & Natural Resources',[
            {'name':'first.txt','text':'Synthetic Aurora Legal advises Synthetic Solar on generation permit case EN-01 in Mexico. Lead Sofia Vega. A cover sheet lists MXN 5000000. Pending. Confidential.'},
            {'name':'second.txt','text':'Same permit case EN-01, Synthetic Solar: another cover sheet lists USD 5000000, contradicting the earlier MXN figure. Currency is not resolved. Do not choose a currency.'}],1),
        ]
        for name,practice,sources,count in cases:
            record('live_'+name,{'user_input':sources[0]['text'],'sources':sources,'context':{**context,'practice_area':practice}},
                lambda s,b,n=count:((s==422 and b.get('code')=='NO_LEGAL_MATTERS') if n==0 else (s==200 and len(b.get('matters',[]))==n)),
                'live_model_actual_local_extract_handler_input_rejection_or_count')
        mode='live'
    report={'mode':mode,'model':os.getenv('OPENAI_MODEL'),'qa_overrides':{'timeout_seconds':60,'max_output_tokens':4096},
      'total':len(results),'passed':sum(r['passed'] for r in results),'failed':sum(not r['passed'] for r in results),'results':results}
    out=Path(os.environ['RANKPILOT_REVIEW_OUTPUT']) if os.environ.get('RANKPILOT_REVIEW_OUTPUT') else Path(__file__).with_name('stress-ingestion-2026-10-02-'+mode+'.json')
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
