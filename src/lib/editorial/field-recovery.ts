import {stableHash} from './contracts';

export const FIELD_RECOVERY_CONTRACT='field-recovery-v1';
export type RepairStrategy='targeted_correction'|'source_reconstruction';

export function fieldMethodCount(attempts:Record<string,number>,path:string):number {
  return Math.max(0,...Object.entries(attempts).filter(([field])=>field===path
    || field.startsWith(path+'/') || path.startsWith(field+'/')).map(([,count])=>Number(count)||0));
}

/** An output paraphrase cannot buy a new allowance for the same source duty.
 * These keys are scoped to the immutable job source hash by the worker.
 */
export function obligationKey(defect:any):string {
  const norm=(v:any)=>String(v ?? '').replace(/\s+/g,' ').trim();
  const field=norm(defect.field_path);
  return stableHash({scope:norm(defect.scope),field,
    entity:/^(candidates|matters)\/\d+(\/|$)/.test(field)?'':norm(defect.matter_id || defect.entity_id)});
}

/** Track a disputed fact, not the reviewer's changing explanation. Evidence
 * remains in the source-bound checkpoint; the ledger stores only fingerprints. */
export function findingFingerprint(defect:any):string {
  const text=(value:any)=>String(value ?? '').replace(/\s+/g,' ').trim();
  return stableHash(Object.fromEntries(['code','owner','scope','matter_id','field_path',
    'source_quote','artifact_quote','conflict_resolution'].map(key=>[key,text(defect[key])])));
}

/** Corrections the final judge may order on one field, and in one job. */
export const JUDGE_REPAIRS_PER_FIELD=2;
export const MAX_JUDGE_REPAIR_CYCLES=3;

/** v1.0.119. The final judge quotes the exact sentence and states its correction,
 * so that correction is applied even when the field was already repaired during
 * drafting for another reason. Real run 7dcf6fc6 (v1.0.116): the drafting review
 * had repaired C2 once, so the judge's first finding on C2 went straight to a whole
 * reconstruction, and its second, different finding found the allowance spent and
 * was delivered uncorrected.
 *
 * The bounds stay finite: two judge-ordered repairs per field (one when drafting
 * already used both of its methods there), three judge cycles per job, and the
 * cumulative token cap enforced by the supervisor. A finding that returns with the
 * same fingerprint after its correction is the only case that changes method.
 */
export function fieldRecoveryPlan(ledger:any[],defects:any[],fieldAttempts:Record<string,number>={}):{
  keys:string[];fields?:string[];strategy?:RepairStrategy;reason?:string
} {
  const concrete=defects.filter(d=>d.owner==='rankpilot' && d.severity==='critical'
    && d.field_path && d.artifact_quote && !String(d.message || '').startsWith('La aceptación editorial no está completa:'));
  if(!concrete.length)return {keys:[],reason:'no_supported_repair'};
  const keys=[...new Set<string>(concrete.map(obligationKey))].sort();
  const fields=[...new Set<string>(concrete.map(d=>String(d.field_path)))].sort();
  const ordered=ledger.filter(entry=>entry.supervision?.action==='repair'
    && entry.supervision?.recovery_contract===FIELD_RECOVERY_CONTRACT);
  if(ordered.length>=MAX_JUDGE_REPAIR_CYCLES) return {keys,reason:'field_recovery_exhausted'};
  // A job migrated from the earlier contract recorded its judge-ordered repairs only as
  // field attempts: they keep counting as the judge's, so no method is handed out twice.
  const migrated=ledger.some(entry=>entry.supervision?.action==='repair' && !entry.supervision?.recovery_contract);
  let returned=false;
  for(const key of keys) {
    const rows=ordered.filter(entry=>entry.supervision.obligation_keys?.includes(key));
    const own=concrete.filter(defect=>obligationKey(defect)===key);
    const recorded=Math.max(0,...own.map(defect=>defect.scope==='submission'
      ? fieldMethodCount(fieldAttempts,String(defect.field_path)):0));
    // Attempts recorded for the field include the judge's own; the rest were drafting's.
    const drafting=migrated ? 0:recorded-rows.length;
    const judged=migrated ? Math.max(rows.length,recorded):rows.length;
    const allowance=drafting>=2 ? 1:JUDGE_REPAIRS_PER_FIELD;
    // Two judge-ordered repairs, and a reconstruction is always the last method.
    if(judged>=allowance || rows.some(row=>row.supervision.repair_strategy==='source_reconstruction'))
      return {keys,reason:'field_recovery_exhausted'};
    const attempted=new Set(rows.flatMap(row=>row.supervision.findings || []));
    if((migrated && judged>0) || own.some(defect=>attempted.has(findingFingerprint(defect)))) returned=true;
  }
  return {keys,fields,strategy:returned?'source_reconstruction':'targeted_correction'};
}
