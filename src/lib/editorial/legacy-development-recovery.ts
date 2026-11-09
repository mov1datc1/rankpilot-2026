import {authorizedReviewUsed,editorialTokenBudget,hasUnknownProviderUsage,spentTokens} from './recovery';
import {canResumeEditorialResidual} from './residual-recovery';

/** Old residual calls belonged to the original targeted method. Permit one
 * explicit source reconstruction, migrating (never clearing) field counters. */
export function canResumeLegacyDevelopment(job:any,data:any,sourceHash:string,commit:string):boolean {
  // Finish an unused residual of the first method before migrating to a second.
  if(canResumeEditorialResidual(job,data,sourceHash,commit))return false;
  const s=data?.review_checkpoint?.state,r=s?.repair_report;
  return !!job && job.status==='failed' && job.stage==='development' && job.sourceHash===sourceHash
    && job.tasks?.[job.cursor]==='development' && job.issue?.code==='DEVELOPMENT_REJECTED'
    && job.issue.owner==='rankpilot' && !!commit && commit!=='local' && !!job.ledger?.length
    && job.ledger.at(-1)?.worker_commit!==commit
    && !job.ledger.some((e:any)=>e.status==='legacy_development_recovery_requested')
    && !hasUnknownProviderUsage(job.ledger) && !hasUnknownProviderUsage([{trace:s?.trace}])
    && !authorizedReviewUsed(job.ledger) && spentTokens(job.ledger)<editorialTokenBudget(job.ledger)
    && s?.selection_validated===true && s.selection_review_validated===true
    && !!s.development && s.development_validated===false && !s.legacy_field_recovery_report
    && !s.field_review_receipts?.length && !Object.keys(s.field_review_attempts || {}).length
    && !s.field_review_failures?.length && Array.isArray(s.trace) && s.trace.length>0
    && s.trace.every((c:any)=>typeof c?.usage?.total_tokens==='number' && c.usage.total_tokens>=0)
    && !data.final_artifact_review && !s.judge && r?.surgical_retries===1
    && Array.isArray(r.failed_paths) && r.failed_paths.length>0 && !r.unresolved?.length
    && Array.isArray(r.retry_paths) && r.retry_paths.length>0;
}
