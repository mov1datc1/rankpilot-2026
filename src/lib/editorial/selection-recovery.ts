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
