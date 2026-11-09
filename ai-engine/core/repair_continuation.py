"""Persist each already-authorized residual group before the next provider call.

This is continuation, not another repair round. Source/strategy freshness is
checked by the owned application checkpoint; the retained proposal is also bound
here so stale groups cannot overwrite a later correction.
"""
import copy
import hashlib
import json

VERSION = 'bounded-residual-v1'


def proposal_hash(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()


def deferred_result(fixed, pending, trace):
    pending['proposal_hash']=proposal_hash(fixed)
    return {'development':fixed,'development_validated':False,
        'repair_continuation':pending,'development_repair_unlocatable':False,'trace':trace,
        'errors':['Correcciones guardadas; continúa el siguiente campo pendiente.']}


def defer_repair(state,fixed,targets,retry_targets,shared,repair,application_errors,trace):
    from core.biography_depth import residual_repair_groups
    # The full source evidence is only needed by the remaining groups. The
    # original targets retain their postconditions, not duplicate source blobs.
    originals={p:{k:copy.deepcopy(v) for k,v in t.items() if k in
        ('current_value','binding_only','rejected_quotes','rejected_quote_path')}
        for p,t in targets.items()}
    pending={'version':VERSION,'pending_groups':residual_repair_groups(copy.deepcopy(retry_targets)),
        'original_targets':originals,'shared':shared,'repair':repair,
        'application_errors':application_errors,'attempted_paths':[], 'residual_requests':0}
    return deferred_result(fixed,pending,trace)


def resume_repair(state):
    from core.editorial_repair import (unknown_repair_usage,invoke_residual_repair,
        project_repair_result,apply_valid_corrections,repair_failures)
    from core.editorial_development import bind_development,development_errors,submission_voice_paths
    fixed=copy.deepcopy(state.get('development'));trace=list(state.get('trace',[]))
    pending=copy.deepcopy(state.get('repair_continuation') or {})
    groups=pending.get('pending_groups') or []
    paths=[p for group in groups for p in group]
    attempted=pending.get('attempted_paths',[])
    if (not state.get('development_reusable') or pending.get('version')!=VERSION
        or pending.get('proposal_hash')!=proposal_hash(fixed) or not groups
        or len(paths)!=len(set(paths)) or set(paths)&set(attempted)
        or unknown_repair_usage(trace)):
        return {'development':fixed,'development_validated':False,'repair_continuation':None,
            'development_repair_unlocatable':True,'trace':trace,
            'errors':['La continuación guardada no corresponde a la propuesta o conserva consumo desconocido.']}
    targets=pending['original_targets']
    if any(not any(p==owned or p.startswith(owned+'/') for owned in targets) for p in paths):
        return {'development':fixed,'development_validated':False,'repair_continuation':None,
            'development_repair_unlocatable':True,'trace':trace,
            'errors':['La continuación intenta modificar un campo no autorizado.']}
    group=groups.pop(0)
    pending['attempted_paths'].extend(group)
    pending['residual_requests']+=1
    retry_error=None
    try:
        retry,trace=invoke_residual_repair(state,group,pending.get('shared'))
        retry=project_repair_result(retry,group)
        fixed,failures=apply_valid_corrections(fixed,group,retry,state['package'],state['strategy'])
        pending['application_errors']={**{p:e for p,e in pending['application_errors'].items() if p not in group},**failures}
        repair=pending['repair']
        pending['repair']={**retry,
            'unresolved':list(dict.fromkeys(repair.get('unresolved',[])+retry.get('unresolved',[]))),
            'source_notes':list(dict.fromkeys(repair.get('source_notes',[])+retry.get('source_notes',[])))}
    except Exception as error:
        from utils.provider_budget import BudgetPreflightError
        if isinstance(error,BudgetPreflightError):
            # No generation started: preserve the queued group and its unused
            # allowance, including successful earlier groups and their usage.
            pending['attempted_paths']=[p for p in pending['attempted_paths'] if p not in group]
            pending['residual_requests']-=1
            pending['pending_groups']=[group]+groups
            return deferred_result(fixed,pending,getattr(error,'trace_history',None) or trace)
        if getattr(error,'trace_history',None):trace=error.trace_history
        elif getattr(error,'trace',None):trace.append(error.trace)
        retry_error='La corrección localizada no pudo completarse; se conserva el avance y el consumo.'
    if groups and not retry_error and not unknown_repair_usage(trace):
        return deferred_result(fixed,pending,trace)
    repair=pending['repair'];application_errors=pending['application_errors']
    failed=repair_failures(state,fixed,targets,application_errors)
    owned=lambda path:any(path==parent or path.startswith(parent+'/') for parent in targets)
    failed=list(dict.fromkeys(failed+[p for p in submission_voice_paths(fixed) if owned(p)]))
    fixed=bind_development(state['package'],fixed)
    errors=development_errors(state['package'],state['strategy'],fixed)
    if retry_error:errors.append(retry_error)
    errors.extend('La reparación no completó la corrección requerida: '+p for p in failed)
    errors.extend('Reparación pendiente: '+str(e) for e in repair.get('unresolved',[]))
    return {'development':fixed,'development_validated':not errors,'errors':errors,'trace':trace,
        'repair_continuation':None,'development_repair_unlocatable':True if errors else False,
        'repair_report':{'corrected_paths':[p for p in targets if p not in failed],
            'unresolved':repair.get('unresolved',[]),'source_notes':repair.get('source_notes',[]),
            'failed_paths':failed,'surgical_retries':1,'application_errors':application_errors,
            'retry_paths':pending['attempted_paths'],'residual_requests':pending['residual_requests']}}
