import {authorizedReviewUsed,editorialTokenBudget,hasUnknownProviderUsage,spentTokens} from './recovery';

export const FIELD_CONTEXT_VERSION='selected-institutional-sources-v1';

/** One source-complete diagnostic of a legacy institutional failure. Keeps all
 * prior repair methods and tokens; another deploy cannot refresh this right. */
export function canRecheckFieldContext(job:any,data:any,sourceHash:string,commit:string):boolean {
  const s=data?.review_checkpoint?.state,failures=s?.field_review_failures;
  return !!job && job.status==='failed' && job.stage==='development' && job.sourceHash===sourceHash
    && job.tasks?.[job.cursor]==='development' && job.issue?.code==='DEVELOPMENT_REJECTED'
    && job.issue?.owner==='rankpilot' && !!commit && commit!=='local' && !!job.ledger?.length
    && job.ledger.at(-1)?.worker_commit!==commit
    && !job.ledger.some((e:any)=>e.status==='field_context_review_requested')
    && !hasUnknownProviderUsage(job.ledger) && !hasUnknownProviderUsage([{trace:s?.trace}])
    && !authorizedReviewUsed(job.ledger) && spentTokens(job.ledger)<editorialTokenBudget(job.ledger)
    && s?.selection_validated===true && s.selection_review_validated===true
    && !!s.development && s.development_validated===false && s.field_review_enabled===true
    && s.field_review_context_version!==FIELD_CONTEXT_VERSION
    && Array.isArray(s.trace) && s.trace.length>0
    && s.trace.every((c:any)=>typeof c?.usage?.total_tokens==='number' && c.usage.total_tokens>=0)
    && !data.final_artifact_review && !s.judge && Array.isArray(failures) && failures.length>0
    && failures.every((d:any)=>d.owner==='rankpilot' && ['b10','c2'].includes(d.field_path)
      && String(d.obligation_id || '').startsWith('argument:'));
}

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
