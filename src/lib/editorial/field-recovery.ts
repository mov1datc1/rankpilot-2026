import {stableHash} from './contracts';

export const FIELD_RECOVERY_CONTRACT='field-recovery-v1';
export type RepairStrategy='targeted_correction'|'source_reconstruction';

/** An output paraphrase cannot buy a new allowance for the same source duty.
 * These keys are scoped to the immutable job source hash by the worker.
 */
export function obligationKey(defect:any):string {
  const norm=(v:any)=>String(v ?? '').replace(/\s+/g,' ').trim();
  const field=norm(defect.field_path);
  return stableHash({scope:norm(defect.scope),field,
    entity:/^(candidates|matters)\/\d+(\/|$)/.test(field)?'':norm(defect.matter_id || defect.entity_id)});
}

export function fieldRecoveryPlan(ledger:any[],defects:any[],fieldAttempts:Record<string,number>={}):{
  keys:string[];fields?:string[];strategy?:RepairStrategy;reason?:string
} {
  const concrete=defects.filter(d=>d.owner==='rankpilot' && d.severity==='critical'
    && d.field_path && d.artifact_quote && !String(d.message || '').startsWith('La aceptación editorial no está completa:'));
  if(!concrete.length)return {keys:[],reason:'no_supported_repair'};
  const keys=[...new Set<string>(concrete.map(obligationKey))].sort();
  const fields=[...new Set<string>(concrete.map(d=>String(d.field_path)))].sort();
  const priorByKey=new Map(Object.entries(fieldAttempts).map(([field,count])=>[
    obligationKey({scope:'submission',field_path:field}),Number(count) || 0]));
  const attempts=keys.map(key=>ledger.filter(entry=>entry.supervision?.action==='repair'
    && entry.supervision?.recovery_contract===FIELD_RECOVERY_CONTRACT
    && entry.supervision?.obligation_keys?.includes(key)));
  // Two different methods, at most once each. No reset on rewording or deploy.
  if(attempts.some((rows,index)=>Math.max(rows.length,priorByKey.get(keys[index]) || 0)>=2 || rows.some(row=>row.supervision.repair_strategy==='source_reconstruction')))
    return {keys,reason:'field_recovery_exhausted'};
  return {keys,fields,strategy:attempts.some((rows,index)=>rows.length>0 || (priorByKey.get(keys[index]) || 0)>0)?'source_reconstruction':'targeted_correction'};
}
