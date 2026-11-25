import { targetedRepair } from './jobs';
import { mayRepairAutomatically } from './repair-progress';
import { needsDiagnosticReview, recoveryPlan, editorialTokenBudget, spentTokens, authorizedExtension, hasUnknownProviderUsage } from './recovery';
import {FIELD_RECOVERY_CONTRACT,fieldRecoveryPlan,findingFingerprint,type RepairStrategy} from './field-recovery';
export {findingFingerprint};

type Decision = {
  version: 1;
  action: 'complete' | 'deliver' | 'repair' | 'reassess' | 'needs_input' | 'pause';
  reason: string;
  findings: string[];
  repair?: {tasks:string[];letter:boolean};
  retryAt?: Date;
  recovery_contract?: string;
  obligation_keys?: string[];
  repair_strategy?: RepairStrategy;
  repair_fields?: string[];
};

/** Runs in the durable worker before any further paid correction. It delegates
 * semantic work to the existing source-bound repairer and independent reviewer;
 * it cannot change sources or convert a rejection into approval. */
export function superviseArtifact(job:any,data:any,commit:string,now=Date.now()):Decision {
  const critical=(data.final_artifact_review?.judge?.defects || []).filter((d:any)=>d.severity==='critical');
  // Global acceptance summaries add no independent evidence to repair.
  const concrete=critical.filter((d:any)=>!(d.code==='EDITORIAL_OMISSION' &&
    String(d.message || '').startsWith('La aceptación editorial no está completa:') && !d.source_quote && !d.artifact_quote));
  const findings=[...new Set<string>(concrete.map(findingFingerprint))].sort();
  const decision=(action:Decision['action'],reason:string,extra:Partial<Decision>={}):Decision=>
    ({version:1,action:((action==='pause' || action==='needs_input') && data.available_artifact?.base64
      && data.available_artifact?.audit_base64) ? 'deliver':action,reason,findings,...extra});
  if(data.release_verdict?.passed===true && data.final_artifact_review?.judge?.passed===true && !critical.length)
    return decision('complete','independent_review_passed');
  const needsInput=critical.some((d:any)=>d.owner==='user');
  const sourceDecision=()=>decision('needs_input','source_confirmation_required');
  // Complete independent generated-text corrections once before asking for
  // source input, then verify them with ONE judge so the corrected pair is
  // delivered with the question as an observation (Ángela 18-11: stopping
  // after the correction left no files and no visible question). A second
  // pass cannot buy another correction while that answer is pending.
  if(needsInput && !targetedRepair(data)) return sourceDecision();
  if(needsInput && correctedBeforeInput(job.ledger)) return sourceDecision();
  if(hasUnknownProviderUsage(job.ledger || [])) return decision('pause','provider_outcome_unknown');
  if(authorizedExtension(job.ledger)) return decision('pause','authorized_review_limit');
  if(spentTokens(job.ledger)>=editorialTokenBudget(job.ledger)) return decision('pause','token_budget');
  if(needsDiagnosticReview(data)) {
    const issue={code:'AI_REVIEW_INVALID',owner:'rankpilot',retryable:true};
    const marker={stage:'artifact',cursor:job.cursor,issue,worker_commit:commit};
    const plan=recoveryPlan({...job,stage:'artifact',issue,ledger:[...(job.ledger || []),marker]},issue.code,commit,now);
    return plan ? decision('reassess','diagnostic_without_grounded_failure',{retryAt:plan.retryAt})
      : decision('pause','diagnostic_attempt_limit');
  }
  if(data.review_checkpoint?.state?.case_requirements?.recovery_contract===FIELD_RECOVERY_CONTRACT) {
    const repair=targetedRepair(data);
    const plan=fieldRecoveryPlan(job.ledger || [],concrete,data.review_checkpoint?.state?.field_review_attempts || {});
    if(!repair || !plan.strategy) return needsInput ? sourceDecision():decision('pause',plan.reason || 'no_supported_repair');
    return decision('repair',needsInput?'generated_corrections_before_source_input':'source_bound_field_recovery',{
      repair:withArtifactReview(repair),
      recovery_contract:FIELD_RECOVERY_CONTRACT,obligation_keys:plan.keys,repair_strategy:plan.strategy,repair_fields:plan.fields});
  }
  const attempted=new Set((job.ledger || []).flatMap((entry:any)=>
    entry.supervision?.action==='repair' ? entry.supervision.findings || []:[]));
  if(findings.some(fingerprint=>attempted.has(fingerprint)))
    return needsInput ? sourceDecision() : decision('pause','same_finding_after_repair');
  if(!mayRepairAutomatically(job.ledger || [],data)) return decision('pause','repair_progress_limit');
  const repair=targetedRepair(data);
  return repair ? decision('repair',needsInput?'generated_corrections_before_source_input':'targeted_generated_content',
      {repair:withArtifactReview(repair)})
    : decision('pause','no_supported_repair');
}

export const INPUT_CORRECTION_REASON='generated_corrections_before_source_input';
export function correctedBeforeInput(ledger:any[]=[]) {
  return ledger.some((entry:any)=>entry.supervision?.action==='repair' && entry.supervision?.reason===INPUT_CORRECTION_REASON);
}
/** Every scheduled correction ends in the exact-artifact judge: without it the
 * corrected content can be neither delivered nor shown as reviewed. */
function withArtifactReview(repair:{tasks:string[];letter:boolean}) {
  return repair.tasks.at(-1)==='artifact' ? repair : {...repair,tasks:[...repair.tasks.filter(task=>task!=='artifact'),'artifact']};
}
