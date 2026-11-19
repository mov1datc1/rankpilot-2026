import { hasUnknownProviderUsage } from './recovery';

/** Codes with which the final reviewer could not return a valid verdict. A call
 * still in progress (EXISTING_CALL) is never treated as finished. */
export const FINAL_REVIEW_UNFINISHED=new Set(['AI_REVIEW_INVALID','AI_OUTPUT_LIMIT','AI_REVIEW_UNAVAILABLE','STAGE_FAILED','PROVIDER_OUTCOME_UNKNOWN']);
export const FINAL_REVIEW_RESUME='final_review_resume_requested';

/** v1.0.104 (Ramos Castillo 19-11): a case stopped only because its final
 * review could not finish keeps every saved stage; a retry requeues that final
 * review once over the same sources and saved drafts. */
export function canResumeFinalReview(job:any,data:any,sourceHash:string):boolean {
  return !!job && job.status==='failed' && job.stage==='artifact' && job.sourceHash===sourceHash
    && FINAL_REVIEW_UNFINISHED.has(job.issue?.code) && !hasUnknownProviderUsage(job.ledger || [])
    && !(job.ledger || []).some((e:any)=>e.status===FINAL_REVIEW_RESUME)
    && !!data?.review_checkpoint?.state;
}
