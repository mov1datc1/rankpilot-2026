"""Offline checks against immutable Word pairs. No model, network or rewriting.

Patterns are explicit reviewer-authored assertions for a frozen case, not a
universal semantic judge. A passing report never implies editorial approval.
"""
import argparse
import hashlib
import io
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

RUBRIC = ('source_fidelity', 'audit_submission_consistency', 'personal_case_b9',
          'institutional_b10_c2', 'selection_and_comparisons', 'firm_voice',
          'confidentiality_and_roles', 'actionable_audit')


def document(path, expected_hash=None):
    path=Path(path); data=path.read_bytes(); actual=hashlib.sha256(data).hexdigest()
    if expected_hash and actual!=expected_hash:
        raise ValueError('Frozen artifact hash mismatch: '+str(path))
    with ZipFile(io.BytesIO(data)) as archive:
        root=ET.fromstring(archive.read('word/document.xml'))
    ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    text='\n'.join(''.join(p.itertext()) for p in root.findall('.//w:p',ns))
    return {'sha256':actual,'text':text}


def check(text, rule):
    """Select an explicit field before matching, so an Audit mention cannot
    excuse a Submission omission. Missing/ambiguous field boundaries fail.
    """
    scope=rule.get('scope')
    if scope:
        matches=list(re.finditer(scope,text,re.I|re.S))
        if len(matches)!=1:return {'passed':False,'reason':'field_missing_or_ambiguous'}
        text=matches[0].group('field')
    mode=rule['mode']
    if mode not in ('required','forbidden'):raise ValueError('Unknown check mode')
    found=bool(re.search(rule['pattern'],text,re.I|re.S))
    return {'passed':found if mode=='required' else not found,
            'reason':'required_evidence' if mode=='required' else 'forbidden_content'}


def evaluate(manifest, base):
    base=Path(base);reports=[]
    if not manifest.get('cases'):raise ValueError('A quality bank cannot be empty')
    for case in manifest['cases']:
        if not case.get('checks'):raise ValueError('A case must declare explicit checks')
        for evidence in case.get('evidence_files',[]):
            if not evidence.get('sha256') or hashlib.sha256((base/evidence['path']).read_bytes()).hexdigest()!=evidence['sha256']:
                raise ValueError('Frozen source/feedback hash mismatch')
        pairs={};results={}
        for version in ('baseline','candidate'):
            pairs[version]={}
            for kind in ('audit','submission'):
                spec=case[version][kind]
                if version=='baseline' and not spec.get('sha256'):
                    raise ValueError('Every baseline artifact must be hash-bound')
                pairs[version][kind]=document(base/spec['path'],spec.get('sha256'))
            results[version]={r['id']:check(pairs[version][r['artifact']]['text'],r) for r in case['checks']}
            if len(results[version])!=len(case['checks']):raise ValueError('Duplicate quality check ID')
        regressions=[key for key,old in results['baseline'].items() if old['passed'] and not results['candidate'][key]['passed']]
        unresolved=[key for key,value in results['candidate'].items() if not value['passed']]
        hashes={k:v['sha256'] for k,v in pairs['candidate'].items()}
        def complete(review, pair):
            ratings=review.get('rubric',{})
            return (review.get('artifact_hashes')=={k:v['sha256'] for k,v in pair.items()}
                and bool(review.get('reviewer')) and bool(review.get('evidence'))
                and all(isinstance(ratings.get(k),dict) and ratings[k].get('evidence')
                        and type(ratings[k].get('score')) in (int,float) and 1<=ratings[k]['score']<=10 for k in RUBRIC))
        review=case.get('human_review') or {};baseline_review=case.get('baseline_review') or {}
        human_complete=complete(review,pairs['candidate']) and complete(baseline_review,pairs['baseline'])
        rubric_regressions=[k for k in RUBRIC if review['rubric'][k]['score']<baseline_review['rubric'][k]['score']] if human_complete else []
        reports.append({'id':case['id'],'artifact_hashes':hashes,'checks':results,
            'regressions':regressions,'unresolved':unresolved,
            'rubric_regressions':rubric_regressions,
            'human_review_complete':bool(human_complete),
            'release_quality_ready':not unresolved and not rubric_regressions and bool(human_complete) and review.get('decision')=='accept'})
    return {'provider_calls':0,'scope':'Explicit frozen checks plus separate human rubric; not a semantic quality guarantee.',
            'cases':reports,'release_quality_ready':all(c['release_quality_ready'] for c in reports)}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest',type=Path)
    parser.add_argument('--output',type=Path)
    parser.add_argument('--require-release-quality',action='store_true')
    args=parser.parse_args()
    report=evaluate(json.loads(args.manifest.read_text()),args.manifest.parent)
    result=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
    if args.output:args.output.write_text(result)
    else:print(result,end='')
    # A passing technical comparison alone is never release approval.
    failed=(not report['release_quality_ready']) if args.require_release_quality else any(c['regressions'] or c['rubric_regressions'] for c in report['cases'])
    return int(failed)


if __name__=='__main__':sys.exit(main())
