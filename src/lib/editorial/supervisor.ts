import { stableHash } from './contracts';
import { targetedRepair } from './jobs';
import { mayRepairAutomatically } from './repair-progress';
import { needsDiagnosticReview, recoveryPlan, editorialTokenBudget, spentTokens, authorizedExtension, hasUnknownProviderUsage } from './recovery';
import {FIELD_RECOVERY_CONTRACT,fieldRecoveryPlan,type RepairStrategy} from './field-recovery';

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

/** Track a disputed fact, not the reviewer's changing explanation. Evidence
 * remains in the source-bound checkpoint; the ledger stores only fingerprints. */
export function findingFingerprint(defect:any):string {
  const text=(value:any)=>String(value ?? '').replace(/\s+/g,' ').trim();
  return stableHash(Object.fromEntries(['code','owner','scope','matter_id','field_path',
    'source_quote','artifact_quote','conflict_resolution'].map(key=>[key,text(defect[key])])));
}

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
  // source input. Do not repurchase an artifact judge while input is missing.
  if(needsInput && !targetedRepair(data)) return sourceDecision();
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
      repair:needsInput?{...repair,tasks:repair.tasks.filter(task=>task!=='artifact')}:repair,
      recovery_contract:FIELD_RECOVERY_CONTRACT,obligation_keys:plan.keys,repair_strategy:plan.strategy,repair_fields:plan.fields});
  }
  const attempted=new Set((job.ledger || []).flatMap((entry:any)=>
    entry.supervision?.action==='repair' ? entry.supervision.findings || []:[]));
  if(findings.some(fingerprint=>attempted.has(fingerprint)))
    return needsInput ? sourceDecision() : decision('pause','same_finding_after_repair');
  if(!mayRepairAutomatically(job.ledger || [],data)) return decision('pause','repair_progress_limit');
  const repair=targetedRepair(data);
  return repair ? decision('repair',needsInput?'generated_corrections_before_source_input':'targeted_generated_content',
      {repair:needsInput?{...repair,tasks:repair.tasks.filter(task=>task!=='artifact')}:repair})
    : decision('pause','no_supported_repair');
}
