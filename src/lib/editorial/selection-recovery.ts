import {SELECTION_DIAGNOSTIC_CONTRACT} from '../audit/review-versions';
import {authorizedReviewUsed,editorialTokenBudget,hasUnknownProviderUsage,spentTokens} from './recovery';

/** One explicit continuation after a diagnostic-contract fix. No reset, new job,
 * extraction, or automatic generation merely because a deploy became live. */
export function canResumeSelectionDiagnostic(job:any,data:any,sourceHash:string,commit:string):boolean {
  const state=data?.review_checkpoint?.state;
  if(!job || job.status!=='failed' || job.stage!=='selection' || job.cursor!==0
    || job.tasks?.length!==1 || job.tasks[0]!=='selection' || job.sourceHash!==sourceHash
    || job.issue?.code!=='SELECTION_DIAGNOSTIC_INVALID' || job.issue?.owner!=='rankpilot'
    || !commit || commit==='local' || !job.ledger?.length || job.ledger.at(-1)?.worker_commit===commit
    || job.ledger.some((e:any)=>e.status==='selection_diagnostic_recovery_requested')
    || hasUnknownProviderUsage(job.ledger) || hasUnknownProviderUsage([{trace:state?.trace}])
    || authorizedReviewUsed(job.ledger) || spentTokens(job.ledger)>=editorialTokenBudget(job.ledger)
    || state?.selection_diagnostic_invalid!==true || state.selection_validated===true
    || state.selection_diagnostic_contract===SELECTION_DIAGNOSTIC_CONTRACT
    || !Number.isSafeInteger(state.selection_review_attempts) || state.selection_review_attempts<1 || state.selection_review_attempts>=3
    || !Number.isSafeInteger(state.selection_repair_attempts || 0) || (state.selection_repair_attempts || 0)>=2
    || !Array.isArray(state.trace) || !state.trace.length
    || state.trace.some((call:any)=>typeof call?.usage?.total_tokens!=='number' || call.usage.total_tokens<0)) return false;
  const checks=state.selection_review?.checks || {},decisions=state.strategy?.matters || [],matters=data.matters || [];
  const ids=matters.map((m:any)=>m.id),checked=Object.keys(checks),chosen=decisions.map((d:any)=>d.matter_id);
  return ids.length>0 && new Set(ids).size===ids.length && new Set(chosen).size===ids.length
    && chosen.length===ids.length && checked.length===ids.length
    && ids.every((id:string)=>checked.includes(id) && chosen.includes(id))
    && checked.some(id=>checks[id]?.status==='repair_required');
}


/** One explicit continuation after correcting a premature progress stop.
 * Uses only the already remaining repair/review allowance, never a reset. */
export function canResumeSelectionProgress(job:any,data:any,sourceHash:string,commit:string):boolean {
  const checkpoint=data?.review_checkpoint,state=checkpoint?.state,history=state?.selection_failure_history,now=Date.now();
  if(!job || job.status!=='failed' || job.stage!=='selection' || job.cursor!==0
    || job.tasks?.length!==1 || job.tasks[0]!=='selection' || job.sourceHash!==sourceHash
    || job.issue?.code!=='SELECTION_REJECTED' || job.issue?.owner!=='rankpilot'
    || !commit || commit==='local' || !job.ledger?.length || job.ledger.at(-1)?.worker_commit===commit
    || job.ledger.some((e:any)=>e.status==='selection_progress_recovery_requested')
    || hasUnknownProviderUsage(job.ledger) || hasUnknownProviderUsage([{trace:state?.trace}])
    || authorizedReviewUsed(job.ledger) || spentTokens(job.ledger)>=editorialTokenBudget(job.ledger)
    || !Number.isFinite(checkpoint?.created_at) || now<checkpoint.created_at || now-checkpoint.created_at>=86400000
    || !checkpoint.step_keys?.strategy
    || state?.selection_diagnostic_invalid!==false || state.selection_review_unavailable===true
    || state.selection_validated!==false || state.selection_review_validated!==false
    || !Number.isSafeInteger(state.selection_review_attempts) || state.selection_review_attempts!==2
    || state.selection_repair_attempts!==1
    || !Array.isArray(state.trace) || !state.trace.length
    || state.trace.some((call:any)=>typeof call?.usage?.total_tokens!=='number' || call.usage.total_tokens<0)
    || !Array.isArray(history) || history.length!==2 || !history.every((batch:any)=>Array.isArray(batch) && batch.every((id:any)=>typeof id==='string'))) return false;
  const previous=new Set(history[0]),current=new Set(history[1]);
  if(!current.size || current.size>=previous.size) return false;
  const checks=state.selection_review?.checks || {},failed=state.selection_feedback?.failed_checks || {};
  const decisions=state.strategy?.matters || [],ids=(data.matters || []).map((m:any)=>m.id);
  const rejected=Object.keys(checks).filter(id=>checks[id]?.status==='repair_required');
  return ids.length>0 && new Set(ids).size===ids.length && decisions.length===ids.length
    && new Set(decisions.map((d:any)=>d.matter_id)).size===ids.length
    && Object.keys(checks).length===ids.length && ids.every((id:string)=>checks[id] && decisions.some((d:any)=>d.matter_id===id))
    && rejected.length===current.size && Object.keys(failed).length===current.size
    && rejected.every(id=>current.has(id) && checks[id].evidence_bound===true && failed[id]?.evidence_bound===true);
}
