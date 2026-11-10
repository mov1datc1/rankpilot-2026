"""Persisted source-to-field review before paying to assemble the Audit/Word.

Uses the final review's obligations, not a second editorial policy. Receipts bind
source, instructions and actual output; an edit invalidates only its own unit.
The final byte-bound document review remains independent and mandatory.
"""
import copy
import json
import hmac
import os
from collections import OrderedDict
from hashlib import sha256
from typing import Literal
from pydantic import ConfigDict, Field, create_model

VERSION = 'source-field-review-v1'
INSTITUTIONAL_CONTEXT = 'complete-institutional-sources-v2'
TASK = '''Review only these source-bound editorial units before document assembly.
For EACH obligation judge whether the actual output executes its supplied rule
against the complete original sources. A matching quote is not semantic proof.
Check legal mechanism, result/status, attribution, credentials and decisive scale
where required. Confidential E narratives retain private source evidence; public
BIO/B10/C2 must generalise restricted identities and identifying metrics. Team
membership is not leadership or personal achievement. Missing source information
does not require invented detail or padding: an accurate limited profile is valid.
Mark failed only for a concrete material violation of this obligation; optional
wording preferences are met, not blocking defects. Identify an allowed output
passage and original source passage, and explain the exact omission or error and
what the authorised field must preserve. Institutional B10/C2 contain several
arguments: each obligation's source_ids identify the evidence it must execute,
not an exhaustive list of evidence for the whole section. Check additional
claims against that field's contextual_source_ids before alleging absence of
support, and against institutional_context for confirmed department heads,
original team profiles, objectives and original department/coverage narratives.
Confirmed filing heads establish departmental leadership independently of a
matter's lead-partner heading; neither by itself establishes partner seniority.
Do not remove a valid contribution merely because a different argument
supplies its evidence. Context from another mandate cannot establish a result
or personal role in the mandate being checked. Do not rewrite text, change sources,
nominate anyone, or certify the complete Submission/Audit. Every check is required.'''


def digest(value):
    return sha256(json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()


def method_count(attempts,path):
    # A whole-candidate repair includes its BIO/category. A later descendant
    # address cannot buy a fresh allowance; unrelated sibling fields stay apart.
    return max([int(count) for key,count in attempts.items()
        if key==path or path.startswith(key+'/') or key.startswith(path+'/')]+[0])


def receipt_matches(unit,receipt,require_signature=False):
    if receipt.get('version')!=VERSION or receipt.get('hash')!=unit['hash'] or receipt.get('field')!=unit['field']:
        return False
    wanted={o['id'] for o in unit['obligations']};checks=receipt.get('checks',[])
    if len(checks)!=len(wanted) or {c.get('obligation_id') for c in checks}!=wanted or any(c.get('status')!='met' for c in checks):return False
    secret=os.environ.get('AI_ENGINE_SERVICE_TOKEN')
    if require_signature or secret:
        if not secret or not isinstance(receipt.get('signature'),str):return False
        unsigned={k:v for k,v in receipt.items() if k!='signature'}
        expected=hmac.new(secret.encode(),json.dumps(unsigned,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode(),sha256).hexdigest()
        if not hmac.compare_digest(expected,receipt['signature']):return False
    return True


def units_for(state):
    from core.editorial_case import obligations, execution_source_catalog, execution_output
    from core.editorial_development import SOURCE_FIELDS
    source_fields=set(SOURCE_FIELDS) | {'id','name','fullName','title','client','clientDescription','source_label',
        'bio','comments','key_focus','standout_work','standoutWork','credentials','professional_roles',
        'role','isPartner','is_partner','roleResolution','confirmed_department_head',
        'currentRank','current_ranking','isRanked','is_ranked','otherFirms','crossBorder',
        'valueResolution','valueConflict','confidential','isConfidential','confidentialityStatus',
        'confidentialityConfirmed','confidentialityEvidence','publish_status','publishStatus',
        'publication_route','resolved_publication_status'}
    package,strategy,proposal=state['package'],state['strategy'],state['development']
    sources=execution_source_catalog(package,strategy,proposal)
    groups=OrderedDict()
    for obligation in obligations(package,strategy,proposal):
        # Cross-document argument consistency needs the finished Audit. It stays
        # in the independent final review, not a fictitious early approval.
        if obligation['output_scope']=='audit' or obligation['id'].endswith('b9_audit_consistency'):
            continue
        path=obligation['field']
        text,_=execution_output(package,proposal,{},path)
        if not text.strip():
            raise ValueError('Field review cannot certify an absent output: '+path)
        unit=groups.setdefault(path,{'field':path,'output':text,'obligations':[], 'sources':{}})
        refs={}
        for source in obligation['sources']:
            original={k:v for k,v in source.items() if k in source_fields}
            key=digest(original);unit['sources'][key]=original;refs[key]=True
        unit['obligations'].append({'id':obligation['id'],'instruction':obligation['instruction'],
            'source_ids':list(refs),'source_passages':sources[obligation['id']]})
    result=[]
    from utils.review_policy import EDITORIAL_RULES
    for unit in groups.values():
        if unit['field'] in ('b10','c2'):
            from core.review_graph import role_payload
            # Reuse the source view supplied to development/repair. In
            # particular, a practice-level claim is not limited to mandates.
            institution=role_payload({'package':package},'development')['package']
            unit['institutional_context']={k:v for k,v in institution.items() if k!='matters'}
            core={m['matter_id'] for m in strategy.get('matters',[]) if m.get('disposition')=='core'}
            context=[]
            for matter in package.get('matters',[]):
                if matter.get('id') not in core:continue
                original={k:v for k,v in matter.items() if k in source_fields}
                key=digest(original);unit['sources'][key]=original;context.append(key)
            unit['contextual_source_ids']=context
            unit['context_version']=INSTITUTIONAL_CONTEXT
        unit['output_passages']={'P_'+digest(q)[:16]:q for q in
            dict.fromkeys(' '.join(line.split()) for line in unit['output'].splitlines() if line.strip())}
        unit['hash']=digest({'version':VERSION,'policy':EDITORIAL_RULES,**unit})
        result.append(unit)
    return result


def batches(units):
    # Review a person's BIO/category together, and B10/C2 together. Their own
    # original evidence is sent once; unrelated records retain distinct rules.
    families=OrderedDict()
    for unit in units:
        path=unit['field'];family='/'.join(path.split('/')[:2]) if path.startswith('candidates/') else 'institution' if path in ('b10','c2') else path
        families.setdefault(family,[]).append(unit)
    result=[];batch=[]
    for family in families.values():
        combined=batch+family
        size=len(json.dumps(review_payload(combined),ensure_ascii=False).encode())
        checks=sum(len(u['obligations']) for u in combined)
        if batch and (len(combined)>6 or size>120000 or checks>24):
            result.append([u['field'] for u in batch]);batch=[]
        batch.extend(family)
    if batch:result.append([u['field'] for u in batch])
    return result


def contract(units):
    fields={}
    for unit in units:
        for item in unit['obligations']:
            fields[item['id']]=(create_model('FieldProof_'+digest(item['id'])[:12],__config__=ConfigDict(extra='forbid'),
                status=(Literal['met','failed'],...),
                artifact_ref=(Literal[tuple(unit['output_passages'])],...),
                source_ref=(Literal[tuple(item['source_passages'])],...),
                reason=(str,Field(min_length=1,max_length=500))),...)
    checks=create_model('FieldChecks',__config__=ConfigDict(extra='forbid'),**fields)
    return create_model('SourceFieldVerdict',__config__=ConfigDict(extra='forbid'),checks=(checks,...))


def review_payload(units):
    """One copy per original record/passage, irrespective of obligation count."""
    records={};passages={};items=[]
    for unit in units:
        records.update(unit['sources']);checks=[]
        for obligation in unit['obligations']:
            passages.update(obligation['source_passages'])
            checks.append({k:v for k,v in obligation.items() if k!='source_passages'} |
                          {'source_refs':list(obligation['source_passages'])})
        items.append({'field':unit['field'],'output_passages':unit['output_passages'],'obligations':checks,
            **({'contextual_source_ids':unit['contextual_source_ids'],
                'institutional_context_ref':'institutional_context'} if 'contextual_source_ids' in unit else {})})
    result={'units':items,'original_sources':records,'original_passages':passages}
    contexts=[u['institutional_context'] for u in units if 'institutional_context' in u]
    if contexts:
        if any(c!=contexts[0] for c in contexts):raise ValueError('Institutional source views differ')
        result['institutional_context']=contexts[0]
    return result


def project_checks(units,result):
    parsed=contract(units).model_validate(result).model_dump()
    receipts=[];defects=[]
    for unit in units:
        checks=[]
        for item in unit['obligations']:
            check=parsed['checks'][item['id']]
            proof={'obligation_id':item['id'],'status':check['status'],
                'source_quote':item['source_passages'][check['source_ref']],
                'artifact_quote':unit['output_passages'][check['artifact_ref']],'reason':check['reason']}
            checks.append(proof)
            if check['status']=='failed':
                defects.append({'code':'EDITORIAL_OMISSION','severity':'critical','owner':'rankpilot','scope':'submission',
                    'field_path':unit['field'],'matter_id':None,'source_quote':proof['source_quote'],
                    'artifact_quote':proof['artifact_quote'],'message':proof['reason'],'obligation_id':item['id']})
        if all(c['status']=='met' for c in checks):
            receipt={'version':VERSION,'field':unit['field'],'hash':unit['hash'],'checks':checks}
            secret=os.environ.get('AI_ENGINE_SERVICE_TOKEN')
            if secret:receipt['signature']=hmac.new(secret.encode(),json.dumps(receipt,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode(),sha256).hexdigest()
            receipts.append(receipt)
    return receipts,defects


def verified_obligations(package,strategy,proposal):
    """Reuse signed proofs only where the actual exported field is identifiable.

    A full-document substring is not a field locator. Matter narratives/B10/C2
    continue through final checks; BIO uses the actual Word-table extraction.
    Internal category/comparison fields bind to the exact retained proposal.
    """
    from core.editorial_case import execution_output
    secret=os.environ.get('AI_ENGINE_SERVICE_TOKEN')
    if not secret or not package.get('rendered_artifact') or not package.get('field_review_receipts') or proposal.get('version') not in ('editorial-development-v3','editorial-development-v4'):
        return []
    original={k:v for k,v in package.items() if k not in
        ('rendered_artifact','rendered_audit','rendered_candidate_bios','_verified_field_obligations','field_review_receipts')}
    units={u['field']:u for u in units_for({'package':original,'strategy':strategy,'development':proposal})}
    valid=[]
    for signed in package.get('field_review_receipts',[]):
        path=signed.get('field','');unit=units.get(path)
        if not unit or not receipt_matches(unit,signed,require_signature=True):continue
        if not path.startswith(('candidates/','comparisons/')):continue
        if path.endswith('/submission_bio'):
            actual,_=execution_output(package,proposal,{},path)
            if ' '.join(actual.split())!=' '.join(unit['output'].split()):continue
        valid.extend(o['id'] for o in unit['obligations'])
    return sorted(set(valid))


def schedule(state,result=None):
    result=dict(result or {});merged={**state,**result}
    if merged.get('development_observations'):
        from core.editorial_development import development_errors
        current_errors=development_errors(merged['package'],merged['strategy'],merged['development'])
        result['development_observations']=[e for e in merged['development_observations'] if e in current_errors]
        merged.update(result)
    units=units_for(merged)
    receipts=merged.get('field_review_receipts',[])
    observations=[o for o in merged.get('field_review_observations',[]) if any(
        u['field']==o.get('field') and u['hash']==o.get('hash') for u in units)]
    result['field_review_observations']=observations
    pending=[u for u in units if not any(receipt_matches(u,r) for r in receipts)
        and not any(o['field']==u['field'] and o['hash']==u['hash'] for o in observations)]
    if not pending:
        return {**result,'repair_continuation':None,'development_validated':not observations and not merged.get('development_observations'),'development_delivery_ready':True,'errors':[],
            'field_review_failures':[],
            'repair_feedback':merged.get('field_review_parent_feedback',[]) + merged.get('field_review_reconciled_feedback',[])}
    return {**result,'development_validated':False,'development_delivery_ready':False,'development_repair_unlocatable':False,
        'errors':['Redacción guardada; comprobando los campos contra sus fuentes antes de preparar los documentos.'],
        'repair_continuation':{'version':VERSION,'phase':'review','proposal_hash':digest(merged['development']),
            'pending_groups':batches(pending)}}


def after_repair(state,result):
    """A residual continuation belongs to the same field recovery method."""
    paths={d['field_path'] for d in state.get('field_review_failures',[])}
    attempts=state.get('field_review_attempts',{})
    result={**result,'field_review_attempts':attempts,'repair_strategy':state.get('repair_strategy','targeted_correction')}
    if result.get('development_validated'):
        return schedule(state,result)
    if result.get('repair_continuation'):
        return result
    # A global validation flag may remain false solely because a different
    # field carries an exhausted internal-binding observation. It cannot decide
    # whether this repair worked. Review changed output before buying another
    # method or attaching the old verdict to the repaired text's new hash.
    if repaired_output_needs_review(state,result,paths):
        return schedule(state,result)
    if paths and not unknown_usage(result.get('trace',[])) and all(method_count(attempts,path)<2 for path in paths):
        return {**result,'development_repair_unlocatable':False,
            'repair_continuation':{'version':VERSION,'phase':'repair',
                'proposal_hash':digest(result.get('development',state['development'])),
                'pending_groups':[sorted(paths)]}}
    return retain_observations(state,{**result,'repair_continuation':None,'development_repair_unlocatable':True})


def repaired_output_needs_review(state,result,paths):
    from core.development_delivery import complete_proposal_findings
    from core.editorial_repair import repair_value_at
    merged={**state,**result}
    if unknown_usage(merged.get('trace',[])) or not paths:return False
    try:
        changed=any(repair_value_at(state['development'],p)!=repair_value_at(merged['development'],p)
                    for p in paths)
        if not changed:return False
        local=complete_proposal_findings(merged)
        # New local faults still need the normal bounded repair. Existing
        # observations neither grant approval nor invalidate unrelated work.
        return local is not None and all(e in merged.get('development_observations',[]) for e in local)
    except (KeyError,IndexError,TypeError,ValueError):
        return False


def unknown_usage(trace):
    from core.editorial_repair import unknown_repair_usage
    return unknown_repair_usage(trace)


def recheck_context(state):
    """Reconsider an old incomplete-source diagnosis, never replenish repairs."""
    from core.editorial_development import development_errors
    failures=state.get('field_review_failures',[])
    eligible=(state.get('field_review_context_version')!=INSTITUTIONAL_CONTEXT
        and state.get('development_reusable') and not unknown_usage(state.get('trace',[]))
        and failures and all(d.get('field_path') in ('b10','c2')
            and str(d.get('obligation_id','')).startswith('argument:') for d in failures))
    errors=development_errors(state['package'],state['strategy'],state['development'])
    if not eligible or errors:
        return {'development_validated':False,'development_repair_unlocatable':True,
            'field_context_recheck':False,'repair_continuation':None,
            'errors':errors or ['La comprobación del contexto no es aplicable a este intento.']}
    # The earlier diagnosis remains in history. A new source-bound verdict must
    # actually pass; even a corrected context cannot buy a third repair method.
    return schedule(state,{'field_context_recheck':False,'repair_continuation':None})


def advance(state):
    from core.editorial_repair import unknown_repair_usage, repair_rejected_development
    pending=state.get('repair_continuation') or {}
    if pending.get('proposal_hash')!=digest(state['development']) or unknown_repair_usage(state.get('trace',[])):
        return {'development_validated':False,'development_repair_unlocatable':True,'repair_continuation':None,
            'errors':['La revisión por campos perdió vigencia o conserva una operación sin resultado confirmado.']}
    if pending.get('phase')=='repair':
        defects=state.get('field_review_failures',[])
        paths={d['field_path'] for d in defects};attempts=dict(state.get('field_review_attempts',{}))
        if not paths or any(method_count(attempts,path)>=2 for path in paths):
            return retain_observations(state,{'development_validated':False,'development_repair_unlocatable':True,'repair_continuation':None,
                'errors':['La recuperación de estos campos agotó sus dos métodos; se conserva el avance.']})
        strategy='source_reconstruction' if any(method_count(attempts,path) for path in paths) else 'targeted_correction'
        previous_counts={path:method_count(attempts,path) for path in paths}
        for path in paths:attempts[path]=previous_counts[path]+1
        current={**state,'repair_continuation':None,'repair_strategy':strategy,'repair_feedback':defects,
                 'field_review_attempts':attempts}
        result=repair_rejected_development(current,state['development'],defects)
        return after_repair(current,result)
    from core.review_graph import invoke_role
    available={u['field']:u for u in units_for(state)}
    paths=(pending.get('pending_groups') or [[]])[0]
    if not paths or len(paths)!=len(set(paths)) or any(p not in available for p in paths):
        raise ValueError('Invalid persisted field review group')
    units=[available[p] for p in paths]
    result,trace=invoke_role(state,'field_reviewer',contract(units),TASK,review_payload(units))
    receipts,defects=project_checks(units,result)
    saved=[r for r in state.get('field_review_receipts',[]) if r.get('field') not in paths]+receipts
    update={'trace':trace,'field_review_receipts':saved}
    if any(u['field'] in ('b10','c2') for u in units):
        update['field_review_context_version']=INSTITUTIONAL_CONTEXT
    if defects:
        return {**update,'development_validated':False,'development_repair_unlocatable':False,
            'field_review_failures':defects,
            'field_review_reconciled_feedback':state.get('field_review_reconciled_feedback',[])+defects,
            'errors':['Hallazgos localizados; RankPilot corregirá esos campos antes de preparar los documentos.'],
            'repair_continuation':{'version':VERSION,'phase':'repair','proposal_hash':digest(state['development']),
                'pending_groups':[list(dict.fromkeys(d['field_path'] for d in defects))]}}
    return schedule(state,update)


def retain_observations(state,result=None):
    """Finish usable, source-bound prose without pretending a failed check passed.

    Only a structurally valid saved proposal can proceed. Each remaining unit
    is still reviewed; changed text/source invalidates these dispositions too.
    """
    from core.editorial_development import development_errors
    merged={**state,**(result or {})}
    failures=merged.get('field_review_failures') or []
    local_errors=development_errors(merged['package'],merged['strategy'],merged['development'])
    if local_errors and all(e in merged.get('development_observations',[]) for e in local_errors):
        from core.development_delivery import complete_proposal_findings
        # Previously exhausted internal bindings remain observations. Check
        # completeness and privacy again after any semantic correction.
        if complete_proposal_findings(merged) is not None:local_errors=[]
    if (unknown_usage(merged.get('trace',[])) or not failures
        or local_errors
        or any(d.get('owner')!='rankpilot' or not d.get('artifact_quote')
            or not d.get('source_quote') or not d.get('field_path') for d in failures)):
        return result or {'development_validated':False,'development_repair_unlocatable':True,
            'repair_continuation':None,'errors':['No se pudo completar la redacción; el avance está guardado.']}
    units={u['field']:u for u in units_for(merged)}
    if any(d['field_path'] not in units for d in failures):return result or {}
    fields={d['field_path'] for d in failures}
    kept=[o for o in merged.get('field_review_observations',[]) if o.get('field') not in fields]
    kept += [{'field':field,'hash':units[field]['hash'],
        'defects':[d for d in failures if d['field_path']==field],
        'reason':'bounded_repair_finished_with_observations'} for field in sorted(fields)]
    return schedule(merged,{**(result or {}),'field_review_observations':kept,
        'development_repair_unlocatable':False,'field_review_failures':[],
        'repair_continuation':None,'errors':[]})
