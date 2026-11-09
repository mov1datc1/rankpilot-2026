import {authorizedReviewUsed,editorialTokenBudget,hasUnknownProviderUsage,spentTokens} from './recovery';

/** An owner-approved capacity increase resumes the saved final review. It
 * cannot refill field methods or restart extraction/selection. */
export function canResumeBudgetReview(job:any,data:any,sourceHash:string):boolean {
  const capacity=editorialTokenBudget(job?.ledger || []);
  const grant=(job?.ledger || []).find((e:any)=>e.status==='authorized_validation_capacity'
    && e.authorization?.approved_by && e.authorization?.reason
    && e.authorization.total_tokens===capacity);
  const decision=[...(job?.ledger || [])].reverse().find((e:any)=>e.supervision)?.supervision;
  return !!grant && job?.status==='needs_review' && job.sourceHash===sourceHash
    && job.stage==='artifact' && job.cursor===job.tasks?.length && job.tasks.at(-1)==='artifact'
    && decision?.action==='pause' && decision.reason==='token_budget'
    && !!data?.final_artifact_review && !hasUnknownProviderUsage(job.ledger)
    && !hasUnknownProviderUsage([{trace:data.review_checkpoint?.state?.trace}])
    && !authorizedReviewUsed(job.ledger) && spentTokens(job.ledger)<capacity
    && !job.ledger.some((e:any)=>e.status==='capacity_continuation_requested' && e.capacity===capacity);
}
