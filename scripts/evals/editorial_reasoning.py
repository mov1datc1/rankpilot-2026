"""Opt-in paid, synthetic editorial evaluation; never writes production records.

Exercises real DOCX/PDF readers and all production editorial graph nodes.
This is not browser end-to-end validation or final Word layout approval.
"""
import argparse, copy, json, re, sys, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'ai-engine'))
CASES=[
 ('finance','Banking & Finance','docx',
  'Synthetic Aurora Legal advised Synthetic Meridian Borrower on an MXN 45000000 acquisition facility. Conflicting creditor priorities and a unanimity requirement for amendments prevented closing. Partner Sofia Vega led the intercreditor negotiations and agreed a majority-consent carve-out limited to administrative amendments; payment priority remained unchanged. Associate Mateo Cruz prepared the amendment comparison and coordinated signatures. Signing remains pending and no funds have been drawn.',
  [r'priorit',r'unanim|consent',r'pending']),
 ('tax','Tax','pdf',
  'Synthetic Aurora Legal challenged an MXN 30000000 tax assessment for Synthetic Delta Taxpayer. The authority served the assessment without the annex setting out its calculation, preventing an informed defence. Partner Sofia Vega led the procedural challenge. The tribunal ordered fresh service with the missing annex and reopened the defence period; it did not cancel the tax liability or decide the substantive tax issue. Associate Mateo Cruz assembled the service record. Merits proceedings remain pending.',
  [r'annex',r'serv',r'pending']),
 ('ip','Intellectual Property','text',
  'Synthetic Aurora Legal represented Synthetic Orion Brand in a trademark ownership dispute. A missing intermediate assignment in the chain of title prevented the client from establishing standing. Partner Sofia Vega located a historic assignment and obtained an interim order allowing the claim to proceed. The court has not determined ownership or awarded damages. Associate Mateo Cruz checked the assignment records. The underlying trademark dispute remains pending.',
  [r'assign',r'chain of title|intermediate',r'interim',r'pending']),
]

def resume(path,out):
    """Exercise the production repair stages on saved output, without regenerating sources.

    This tests stage behavior, not the durable worker's scheduling or browser.
    Preserve the initial result and full cumulative usage even on failure.
    """
    from core.review_graph import run_editorial_stage
    result=json.loads(path.read_text());state=result['state'];before=copy.deepcopy(state['package'])
    before_selection=copy.deepcopy(state['strategy']);started=time.monotonic();events=[]
    try:
        for attempt in range(2):
            if state.get('judge',{}).get('passed'):break
            critical=[d for d in state.get('judge',{}).get('defects',[]) if d.get('severity')=='critical']
            if any(d.get('owner')=='user' for d in critical):break
            concrete=[d for d in critical if d.get('code')!='TEMPORAL_FINDING_UNRESOLVED'
                      and (d.get('artifact_quote') or d.get('source_quote'))]
            state['repair_feedback']=critical
            if any(d.get('scope')!='letter' for d in concrete):
                state=run_editorial_stage('development',{**state,'development_reusable':True})
                events.append('targeted_development_repair')
                if state.get('errors'):break
            if concrete:
                state=run_editorial_stage('writer',state);events.append('audit_reconciliation')
                if state.get('errors'):break
            state=run_editorial_stage('editor',state);events.append('independent_rereview')
        draft=state.get('development',{}).get('matters',[{}])[0]
        patterns=next(c[-1] for c in CASES if c[0]==result['case'])
        checks={'sources_unchanged':state['package']==before,'selection_unchanged':state['strategy']==before_selection,
            'mechanism_retained':all(re.search(p,draft.get('text',''),re.I) for p in patterns),
            'legal_issue_anchored':bool(draft.get('legal_issue_source_quote')),
            'development_validated':state.get('development_validated') is True,
            'independent_review_passed':state.get('judge',{}).get('passed') is True,
            'render_gate_passed':state.get('render_gate',{}).get('passed') is True}
        result.update(checks=checks,passed=all(checks.values()))
    except Exception as error:
        if getattr(error,'trace',None):state.setdefault('trace',[]).append(error.trace)
        result.update(passed=False,error=str(error))
    result.update(state=state,repair_events=events,additional_seconds=round(time.monotonic()-started,2),
        usage={key:sum((t.get('usage') or {}).get(key,0) for t in state.get('trace',[]))
               for key in ('input_tokens','output_tokens','total_tokens')})
    (out/path.name).write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in result.items() if k not in ('state','events')}),flush=True)
    return result

def run(case,out,identity_conflict=False):
    from docx import Document
    import fitz
    from utils.doc_parser import DocumentParser
    from core.review_graph import review_graph
    name,practice,fmt,source,patterns=case
    if fmt=='docx':
        path=out/(name+'.docx');doc=Document();doc.add_paragraph(source);doc.save(path)
        extracted=DocumentParser.parse(str(path))
    elif fmt=='pdf':
        path=out/(name+'.pdf');doc=fitz.open();page=doc.new_page()
        assert page.insert_textbox(fitz.Rect(50,50,540,780),source,fontsize=11)>=0
        doc.save(path);doc.close();extracted=DocumentParser.parse(str(path))
    else:extracted=source
    assert all(re.search(pattern,extracted,re.I) for pattern in patterns)
    package={'directory':'Chambers','practice_area':practice,'jurisdiction':'Mexico','firm_name':'Synthetic Aurora Legal',
        'b10_source':f'Synthetic Aurora Legal advises on {practice} in Mexico. Sofia Vega is a partner; Mateo Cruz is an associate. No wider team size or ranking is asserted.',
        'lawyers':[{'name':'Sofia Vega','isPartner':True,'role':'Partner'},{'name':'Mateo Cruz','isPartner':False,'role':'Associate'}],
        'matters':[{'id':name+'-1','client':{'finance':'Synthetic Meridian Borrower','tax':'Synthetic Delta Taxpayer','ip':'Synthetic Orion Brand'}[name],'source_excerpt':extracted,'summary':extracted,'leadPartner':'Sofia Vega','teamMembers':'Mateo Cruz','publish_status':'publishable','confidentialityConfirmed':True}]}
    if identity_conflict:
        package['matters'][0]['client']='Synthetic '+name+' Client'
    start=time.monotonic();state={'package':package};events=[]
    try:
        for event in review_graph.stream(state,{'recursion_limit':20},stream_mode='updates'):
            for node,update in event.items():
                state.update(update);events.append(node)
                print(json.dumps({'case':name,'node':node,'errors':update.get('errors',[])}),flush=True)
        draft=state.get('development',{}).get('matters',[{}])[0]
        checks={'source_extracted':True,'mechanism_retained':all(re.search(pattern,draft.get('text',''),re.I) for pattern in patterns),
            'legal_issue_anchored':bool(draft.get('legal_issue_source_quote')),
            'development_validated':state.get('development_validated') is True,
            'independent_review_passed':state.get('judge',{}).get('passed') is True,
            'render_gate_passed':state.get('render_gate',{}).get('passed') is True}
        if identity_conflict:
            checks={'conflicting_identity_blocks':not state.get('render_gate',{}).get('passed',False)
                and any(d.get('code')=='SOURCE_CONFLICT' and d.get('field_path')=='client'
                        and d.get('severity')=='critical' for d in state.get('judge',{}).get('defects',[]))}
        usage={key:sum((t.get('usage') or {}).get(key,0) for t in state.get('trace',[]))
               for key in ('input_tokens','output_tokens','total_tokens')}
        result={'case':name,'format':fmt,'checks':checks,'passed':all(checks.values()),'usage':usage,'seconds':round(time.monotonic()-start,2),'events':events,'state':state}
    except Exception as error:
        result={'case':name,'format':fmt,'passed':False,'error':str(error),'events':events,'state':state}
    (out/(name+'-result.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in result.items() if k not in ('state','events')}),flush=True)
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--live',action='store_true');parser.add_argument('--identity-conflict',action='store_true');parser.add_argument('--resume');parser.add_argument('--output',default='scratch/editorial-reasoning-eval');args=parser.parse_args()
    if not args.live:parser.error('--live is required: this evaluation uses paid model calls')
    from dotenv import load_dotenv
    load_dotenv(ROOT/'ai-engine/.env')
    out=ROOT/args.output;out.mkdir(parents=True,exist_ok=True)
    if any(out.glob('*-result.json')):parser.error('Use a new output directory; paid evaluation evidence is never overwritten.')
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(resume,p,out) for p in sorted((ROOT/args.resume).glob('*-result.json'))] if args.resume else [pool.submit(run,case,out,args.identity_conflict) for case in CASES]
        if not futures:parser.error('No saved evaluation results found.')
        results=[f.result() for f in as_completed(futures)]
    summary={'scope':'Synthetic multi-format production editorial graph, without browser or final layout approval','results':[{k:v for k,v in r.items() if k not in ('state','events')} for r in results]}
    (out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    raise SystemExit(0 if all(r['passed'] for r in results) else 1)
