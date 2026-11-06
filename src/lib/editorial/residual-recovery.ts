import {authorizedReviewUsed,editorialTokenBudget,hasUnknownProviderUsage,spentTokens} from './recovery';

/** One explicit continuation of a legacy local wording residual after a code
 * fix. It keeps the same source, cursor, ledger and normal token budget. New
 * repairs handle this residual inside their own bounded correction call. */
export function canResumeEditorialResidual(job:any,data:any,sourceHash:string,commit:string):boolean {
  const state=data?.review_checkpoint?.state,report=state?.repair_report;
  if(!job || job.status!=='failed' || job.stage!=='development' || job.sourceHash!==sourceHash
    || job.issue?.code!=='DEVELOPMENT_REJECTED' || job.issue?.owner!=='rankpilot'
    || job.issue?.retryable!==true || !commit || commit==='local'
    || !job.ledger?.length || job.ledger.at(-1)?.worker_commit===commit
    || job.ledger.some((entry:any)=>entry.status==='residual_recovery_requested')
    || hasUnknownProviderUsage(job.ledger) || hasUnknownProviderUsage([{trace:state?.trace}])
    || !Array.isArray(state?.trace) || !state.trace.length
    || state.trace.some((call:any)=>typeof call?.usage?.total_tokens!=='number' || call.usage.total_tokens<0)
    || authorizedReviewUsed(job.ledger) || spentTokens(job.ledger)>=editorialTokenBudget(job.ledger)
    || !state?.development || state.development_validated===true
    || !report?.corrected_paths?.length || report.surgical_retries!==0
    || report.unresolved?.length || report.failed_paths?.length
    || !Array.isArray(state.errors) || !state.errors.length || state.errors.length>3) return false;
  return state.errors.every((message:any)=>{
    const match=String(message).match(/^Voz auditora en Submission: (b10|c2|candidates\/\d+\/submission_bio|matters\/\d+\/(?:text|completion_status))$/);
    if(!match || !report.corrected_paths.some((parent:string)=>match[1]===parent || match[1].startsWith(parent+'/'))) return false;
    let value:any=state.development;
    for(const part of match[1].split('/'))value=value?.[part];
    return typeof value==='string' && value.trim().length>0;
  });
}
