import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { stableHash, sourceSnapshot, draftDisposition, ReviewIssue, EDITORIAL_VERSION } from './contracts';
import { deliveryInputHash } from '@/lib/audit/artifact-binding';

export function systemIssue(code:string,message:string,retryable=true):ReviewIssue {
  return {code,rule_id:'RP13',entity_id:null,field_path:null,owner:'rankpilot',action:'retry',retryable,message,source_evidence_ids:[],artifact_claim_ids:[]};
}
export function planDrafting(data:any) {
  const state=data.review_checkpoint?.state;
  if(state?.selection_validated!==true) throw new Error('SELECTION_REJECTED');
  const core=state.strategy.matters.filter((d:any)=>d.disposition==='core').map((d:any)=>d.matter_id);
  const register=new Map((data.matters || []).map((m:any)=>[m.id,m]));
  if(!core.length || core.length>20 || new Set(core).size!==core.length || core.some((id:string)=>!register.has(id))) throw new Error('SELECTION_REJECTED');
  const tasks=['selection'];
  for(const id of core) {
    const disposition=draftDisposition(register.get(id),stableHash(state.strategy));
    // Human prose is preserved and compared against the new sources by the final reviewer.
    if(disposition==='write') tasks.push(`matter:${id}`);
  }
  const source=String(data.confirmed_source_b10 ?? data.original_b10 ?? '').trim();
  const text=String(data.enhanced_b7 || '').trim();
  const record=data.b10_optimization;

  if(source && (!text || text===source || (record && record.text===text && (record.source!==source || record.strategy_hash!==stableHash(state.strategy))))) tasks.push('b10');
  tasks.push('audit','artifact');
  return tasks;
}
export function publicJob(job:any) {
  if(!job) return null;
  const labels:Record<string,string>={selection:'Comparando y seleccionando los asuntos',b10:'Redactando la descripción del departamento',audit:'Preparando el Audit de la misma selección',artifact:'Verificando el Submission y el Audit finales'};
  return {id:job.id,status:job.status,stage:job.stage,message:labels[job.stage] || 'Redactando un asunto seleccionado',completed:job.cursor,total:job.tasks.length,issue:job.issue,updatedAt:job.updatedAt,version:EDITORIAL_VERSION};
}
export async function latestJob(submissionId:string) {
  const rows:any[]=await prisma.$queryRaw`SELECT * FROM "EditorialJob" WHERE "submissionId"=${submissionId} ORDER BY "createdAt" DESC LIMIT 1`;
  return rows[0] || null;
}
export async function enqueue(submission:any,retry=false) {
  return prisma.$transaction(async tx=>{
    // Serialize start/double-click with other starters for this submission.
    await tx.$queryRaw`SELECT "id" FROM "Submission" WHERE "id"=${submission.id} FOR UPDATE`;
    const current=await tx.submission.findUnique({where:{id:submission.id},include:{matters:true}});
    if(!current) throw new Error('NOT_FOUND');
    const rows:any[]=await tx.$queryRaw`SELECT * FROM "EditorialJob" WHERE "submissionId"=${current.id} ORDER BY "createdAt" DESC LIMIT 1`;
    const last=rows[0];
    if(last && ['running','queued'].includes(last.status)) return last;
    const snapshot=sourceSnapshot(current),sourceHash=stableHash(snapshot);
    const resultHash=deliveryInputHash(current,current.chambersData || {});
    if(last?.resultHash===resultHash && last?.sourceHash===sourceHash && ['completed','needs_review'].includes(last.status)) return last;
    if(last?.sourceHash===sourceHash && !retry) return last;
    if(last?.status==='indeterminate' && Date.now()-new Date(last.updatedAt).getTime()<300000) throw new Error('PROVIDER_OUTCOME_UNKNOWN');
    const id=randomUUID();
    const jobs:any[]=await tx.$queryRaw`INSERT INTO "EditorialJob" ("id","submissionId","userId","sourceHash","snapshot") VALUES (${id},${current.id},${current.userId},${sourceHash},${JSON.stringify(snapshot)}::jsonb) RETURNING *`;
    return jobs[0];
  });
}

/** Repairs may change generated prose, never source facts or human-edited text. */
export function targetedRepair(data:any):{tasks:string[];letter:boolean}|null {
  const defects=(data.final_artifact_review?.judge?.defects || []).filter((d:any)=>d.severity==='critical');
  if(!defects.length) return null;
  const ids=new Set<string>();let letter=false;
  for(const defect of defects) {
    if(defect.code!=='UNSUPPORTED_CLAIM' || defect.owner!=='rankpilot' || !defect.source_quote || !defect.artifact_quote || defect.source_quote===defect.artifact_quote) return null;
    const matter=(data.matters || []).find((m:any)=>m.id===defect.matter_id);
    const source=matter ? [matter.rawNotes,matter.source_excerpt,matter.value].filter(Boolean).join(' '):String(data.confirmed_source_b10 ?? data.original_b10 ?? '');
    if(!source.includes(defect.source_quote)) return null;
    if(defect.scope==='letter') {
      if(!Object.values(data.editorial_review?.letter || {}).some(text=>String(text).includes(defect.artifact_quote))) return null;
      letter=true;
    } else if(defect.scope==='submission' && matter?.draft_provenance && matter.draft_provenance.text_hash===stableHash(String(matter.optimizedText || matter.optimized_text || '').trim()) && String(matter.optimizedText || matter.optimized_text || '').includes(defect.artifact_quote)) ids.add(matter.id);
    else return null;
  }
  return {tasks:[...ids].map(id=>`matter:${id}`).concat(['audit','artifact']),letter};
}
