import {hasUnknownProviderUsage,spentTokens,editorialTokenBudget} from './recovery';
import {fieldMethodCount} from './field-recovery';

/** One migration of a source-current semantic stop into delivery with findings.
 * Never rerun extraction, clear usage, or create a third field repair method. */
export function canContinueWithObservations(job:any,data:any,sourceHash:string):boolean {
  const state=data?.review_checkpoint?.state,defects=state?.field_review_failures;
  const failed=state?.repair_report?.failed_paths;
  const semantic=Array.isArray(defects) && defects.length>0
    && defects.every((d:any)=>d.owner==='rankpilot' && d.field_path && d.source_quote && d.artifact_quote
      && fieldMethodCount(state.field_review_attempts || {},d.field_path)>=2);
  const local=state?.development_reusable===true && state?.development_repair_unlocatable===true
    && Array.isArray(failed) && failed.length>0 && !state.repair_report?.unresolved?.length
    && failed.every((path:any)=>typeof path==='string' && fieldMethodCount(state.field_review_attempts || {},path)>=2);
  return !!job && job.status==='failed' && job.stage==='development'
    && job.tasks?.[job.cursor]==='development' && job.sourceHash===sourceHash
    && job.issue?.code==='DEVELOPMENT_REJECTED' && job.issue?.owner==='rankpilot'
    && state?.selection_validated===true && state?.selection_review_validated===true
    && !!state?.development && !state.development_validated && !state.repair_continuation
    && (semantic || local)
    && !hasUnknownProviderUsage(job.ledger) && !hasUnknownProviderUsage([{trace:state.trace}])
    && spentTokens(job.ledger)<editorialTokenBudget(job.ledger)
    && !job.ledger?.some((e:any)=>e.status==='delivery_observations_requested');
}
