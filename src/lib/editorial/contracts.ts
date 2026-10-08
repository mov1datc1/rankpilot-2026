import { createHash } from 'node:crypto';
import { reviewPackage, REVIEW_POLICY_VERSION } from '@/lib/audit/review-checkpoint';

export const EDITORIAL_VERSION = 'rankpilot-pipeline-v3.2';
/** A rolling deployment must not mix old renderers with a new engine. */
export function engineMatchesWorker(health:any, expectedFingerprint:string) {
  return health?.version===EDITORIAL_VERSION && /^[a-f0-9]{64}$/.test(expectedFingerprint) && health.engine_fingerprint===expectedFingerprint;
}
export type JobStatus = 'queued'|'running'|'completed'|'needs_review'|'failed'|'indeterminate'|'superseded';
export interface ReviewIssue {
  code:string; rule_id:string; entity_id:string|null; field_path:string|null;
  owner:'rankpilot'|'user'; action:'retry'|'confirm'|'review'; retryable:boolean;
  message:string; source_evidence_ids:string[]; artifact_claim_ids:string[];
}
export function stableHash(value:unknown):string {
  const stable=(v:any):any=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(stable):v && typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}
export function sourceSnapshot(submission:any) {
  const data=submission.chambersData || {};
  const payload=reviewPackage(submission,data,data.matters || submission.matters || []);
  delete (payload as any).editorial_development;
  delete (payload as any).b10_draft; delete (payload as any).c2_draft;
  payload.matters=payload.matters.map((m:any)=>{
    const {optimizedText,optimized_text,status,draft_provenance,createdAt,updatedAt,...source}=m;
    return source;
  });
  return {version:EDITORIAL_VERSION,policy_version:REVIEW_POLICY_VERSION,payload};
}
export function draftSourceHash(matter:any) {
  const {optimizedText,optimized_text,status,draft_provenance,createdAt,updatedAt,...source}=matter;
  return stableHash(source);
}
export function draftDisposition(matter:any,strategyHash?:string):'write'|'reuse'|'review' {
  const text=String(matter.optimizedText || matter.optimized_text || '').trim();
  if(!text) return 'write';
  const provenance=matter.draft_provenance;
  // Legacy and human drafts are retained for the final source comparison.
  if(!provenance) return 'reuse';
  if(provenance.source_hash===draftSourceHash(matter) && (!strategyHash || provenance.strategy_hash===strategyHash)) return 'reuse';
  return provenance.text_hash===stableHash(text) ? 'write':'review';
}
