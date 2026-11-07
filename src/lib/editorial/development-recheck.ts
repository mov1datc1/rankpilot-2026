import {authorizedReviewUsed,editorialTokenBudget,hasUnknownProviderUsage,spentTokens} from './recovery';

/** A software fix can justify ONE unpaid validation of the saved proposal.
 * Failure is terminal and cannot buy another generation or repair allowance. */
export function canRecheckDevelopment(job:any,data:any,sourceHash:string,commit:string):boolean {
  const state=data?.review_checkpoint?.state;
  return !!job && job.status==='failed' && job.stage==='development' && job.sourceHash===sourceHash
    && job.tasks?.[job.cursor]==='development' && job.issue?.code==='DEVELOPMENT_REJECTED'
    && job.issue?.owner==='rankpilot' && !!commit && commit!=='local' && !!job.ledger?.length
    && job.ledger.at(-1)?.worker_commit!==commit
    && !job.ledger.some((e:any)=>e.status==='development_recheck_requested')
    && !hasUnknownProviderUsage(job.ledger) && !hasUnknownProviderUsage([{trace:state?.trace}])
    && !authorizedReviewUsed(job.ledger) && spentTokens(job.ledger)<editorialTokenBudget(job.ledger)
    && state?.selection_validated===true && state.selection_review_validated===true
    && !!state.development && state.development_validated===false
    && Array.isArray(state.errors) && state.errors.length>0
    && Array.isArray(state.trace) && state.trace.length>0
    && state.trace.every((c:any)=>typeof c?.usage?.total_tokens==='number' && c.usage.total_tokens>=0)
    && !data.final_artifact_review && !state.judge
    && !(state.repair_feedback || []).some((d:any)=>d?.severity==='critical' || d?.artifact_quote);
}
