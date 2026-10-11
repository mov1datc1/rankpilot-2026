import { stableHash } from './contracts';
import { targetedRepair } from './jobs';
import { mayRepairAutomatically } from './repair-progress';
import { needsDiagnosticReview, recoveryPlan, editorialTokenBudget, spentTokens } from './recovery';

type Decision = {
  version: 1;
  action: 'complete' | 'repair' | 'reassess' | 'needs_input' | 'pause';
  reason: string;
  findings: string[];
  repair?: {tasks:string[];letter:boolean};
  retryAt?: Date;
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
    ({version:1,action,reason,findings,...extra});
  if(data.release_verdict?.passed===true && data.final_artifact_review?.judge?.passed===true && !critical.length)
    return decision('complete','independent_review_passed');
  if(critical.some((d:any)=>d.owner==='user')) return decision('needs_input','source_confirmation_required');
  if(spentTokens(job.ledger)>=editorialTokenBudget()) return decision('pause','token_budget');
  if(needsDiagnosticReview(data)) {
    const issue={code:'AI_REVIEW_INVALID',owner:'rankpilot',retryable:true};
    const marker={stage:'artifact',cursor:job.cursor,issue,worker_commit:commit};
    const plan=recoveryPlan({...job,stage:'artifact',issue,ledger:[...(job.ledger || []),marker]},issue.code,commit,now);
    return plan ? decision('reassess','diagnostic_without_grounded_failure',{retryAt:plan.retryAt})
      : decision('pause','diagnostic_attempt_limit');
  }
  const attempted=new Set((job.ledger || []).flatMap((entry:any)=>
    entry.supervision?.action==='repair' ? entry.supervision.findings || []:[]));
  if(findings.some(fingerprint=>attempted.has(fingerprint)))
    return decision('pause','same_finding_after_repair');
  if(!mayRepairAutomatically(job.ledger || [],data)) return decision('pause','repair_progress_limit');
  const repair=targetedRepair(data);
  return repair ? decision('repair','targeted_generated_content',{repair})
    : decision('pause','no_supported_repair');
}
