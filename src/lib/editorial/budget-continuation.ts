import {authorizedReviewUsed,editorialTokenBudget,hasUnknownProviderUsage,spentTokens} from './recovery';
import {FIELD_RECOVERY_CONTRACT} from './field-recovery';

export function capacityRecoveryCheckpoint(job:any,data:any):any|null {
  const checkpoint=data?.review_checkpoint,state=checkpoint?.state;
  if(!state)return null;
  if(state.case_requirements?.recovery_contract===FIELD_RECOVERY_CONTRACT)return structuredClone(checkpoint);
  const repairs=(job.ledger || []).filter((e:any)=>e.supervision?.action==='repair');
  const paths=state.repair_report?.corrected_paths;
  // This legacy schema records one complete targeted pass. Multiple passes
  // without field history cannot safely be assigned fresh per-field methods.
  if(repairs.length!==1 || repairs[0].supervision.reason!=='targeted_generated_content'
    || state.legacy_artifact_recovery || state.field_review_attempts
    || !Array.isArray(paths) || !paths.length || state.repair_report?.failed_paths?.length
    || state.repair_report?.unresolved?.length)return null;
  const next=structuredClone(checkpoint);
  next.state.case_requirements={...state.case_requirements,recovery_contract:FIELD_RECOVERY_CONTRACT};
  next.state.field_review_attempts=Object.fromEntries(paths.map((path:string)=>[path,1]));
  next.state.legacy_artifact_recovery={version:'legacy-artifact-to-field-v1',prior_methods:1,prior_fields:[...paths]};
  return next;
}

/** An owner-approved capacity increase resumes the saved final review. It
 * cannot refill field methods or restart extraction/selection. */
export function canResumeBudgetReview(job:any,data:any,sourceHash:string):boolean {
  const capacity=editorialTokenBudget(job?.ledger || []);
  const grant=(job?.ledger || []).find((e:any)=>e.status==='authorized_validation_capacity'
    && e.authorization?.approved_by && e.authorization?.reason
    && e.authorization.total_tokens===capacity);
  const decision=[...(job?.ledger || [])].reverse().find((e:any)=>e.supervision)?.supervision;
  const uncapped=!Number.isFinite(capacity);
  return (uncapped || !!grant) && job?.status==='needs_review' && job.sourceHash===sourceHash
    && job.stage==='artifact' && job.cursor===job.tasks?.length && job.tasks.at(-1)==='artifact'
    && decision?.action==='pause' && decision.reason==='token_budget'
    && !!data?.final_artifact_review && !!capacityRecoveryCheckpoint(job,data) && !hasUnknownProviderUsage(job.ledger)
    && !hasUnknownProviderUsage([{trace:data.review_checkpoint?.state?.trace}])
    && !authorizedReviewUsed(job.ledger) && spentTokens(job.ledger)<capacity
    && !job.ledger.some((e:any)=>e.status==='capacity_continuation_requested' && e.capacity===(uncapped ? null:capacity));
}
