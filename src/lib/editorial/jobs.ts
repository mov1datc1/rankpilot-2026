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
  const tasks=['selection','development','audit','artifact'];
  return tasks;
}
export function publicJob(job:any) {
  if(!job) return null;
  const labels:Record<string,string>={selection:'Comparando y seleccionando los asuntos',development:'Desarrollando Submission, candidaturas y posicionamiento',b10:'Redactando la descripción del departamento',audit:'Preparando el Audit de la misma selección',artifact:'Verificando el Submission y el Audit finales'};
  const recovering=['queued','running'].includes(job.status) && job.issue?.owner==='rankpilot';
  return {id:job.id,status:job.status,stage:job.stage,recovering,message:recovering?'RankPilot está recuperando la preparación automáticamente':labels[job.stage] || 'Redactando un asunto seleccionado',completed:job.cursor,total:job.tasks.length,issue:publicJobIssue(job.issue),updatedAt:job.updatedAt,version:EDITORIAL_VERSION};
}
/** Provider/validator diagnostics stay in the private ledger, not user actions. */
export function publicJobIssue(issue:any) {
  if(!issue || issue.owner==='user') return issue;
  return {...issue,message:'La preparación requiere una comprobación interna de RankPilot. Tus datos y el avance están guardados. No necesitas corregir textos ni volver a subir el documento.'};
}
export async function latestJob(submissionId:string) {
  const rows:any[]=await prisma.$queryRaw`SELECT * FROM "EditorialJob" WHERE "submissionId"=${submissionId} ORDER BY "createdAt" DESC LIMIT 1`;
  return rows[0] || null;
}
export async function enqueue(submission:any,retry=false,requestRepair=false) {
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
    const repair=requestRepair && last?.status==='needs_review' && last.resultHash===resultHash ? targetedRepair(current.chambersData) : null;
    if(requestRepair && last?.status==='needs_review' && last.resultHash===resultHash && !repair) throw new Error('AUTO_REPAIR_UNAVAILABLE');
    if(!repair && last?.resultHash===resultHash && last?.sourceHash===sourceHash && ['completed','needs_review'].includes(last.status)) return last;
    if(last?.sourceHash===sourceHash && !retry) return last;
    if(last?.status==='indeterminate' && Date.now()-new Date(last.updatedAt).getTime()<300000) throw new Error('PROVIDER_OUTCOME_UNKNOWN');
    const tasks=repair?.tasks || ['selection'];
    const ledger=repair ? [{stage:'artifact',status:'repair_requested'}] : [];
    if(repair) {
      const data:any=current.chambersData;
      const checkpoint=structuredClone(data.review_checkpoint);
      if(!checkpoint?.state) throw new Error('AUTO_REPAIR_UNAVAILABLE');
      checkpoint.state.repair_feedback=data.final_artifact_review.judge.defects;
      if(repair.tasks.includes('development')) {checkpoint.state.development_validated=false;}
      if(repair.letter) {checkpoint.state.writer_validated=false;checkpoint.state.letter_repair_requested=true;delete checkpoint.step_keys.writer;}
      await tx.submission.update({where:{id:current.id},data:{chambersData:{...data,completed_review_input_hash:null,review_checkpoint:checkpoint}}});
    }
    const id=randomUUID();
    const jobs:any[]=await tx.$queryRaw`INSERT INTO "EditorialJob" ("id","submissionId","userId","sourceHash","snapshot","tasks","stage","ledger") VALUES (${id},${current.id},${current.userId},${sourceHash},${JSON.stringify(snapshot)}::jsonb,${JSON.stringify(tasks)}::jsonb,${tasks[0]},${JSON.stringify(ledger)}::jsonb) RETURNING *`;
    return jobs[0];
  });
}

/** Repairs may change generated prose, never source facts or human-edited text. */
export function targetedRepair(data:any):{tasks:string[];letter:boolean}|null {
  const containedConflict=(d:any)=>d.code==='SOURCE_CONFLICT' && (
    (d.conflict_resolution==='omit_nonessential_descriptor' && d.field_path==='client_sector' && d.conflicting_artifact_term && String(d.artifact_quote || '').toLowerCase().includes(String(d.conflicting_artifact_term).toLowerCase())) ||
    (d.conflict_resolution==='preserve_source_aliases' && d.field_path==='client' && d.scope==='letter'));
  const defects=(data.final_artifact_review?.judge?.defects || []).filter((d:any)=>
    d.severity==='critical' || (d.owner==='rankpilot' && d.artifact_quote &&
      ((d.code==='EDITORIAL_STYLE' && d.field_path) || containedConflict(d))));
  if(!defects.length) return null;
  if(data.editorial_development) {
    const generated=defects.filter((d:any)=>d.owner==='rankpilot' &&
      (['EDITORIAL_OMISSION','UNSUPPORTED_CLAIM','EDITORIAL_STYLE','SELECTION_MISMATCH','PUBLICATION_PERMISSION'].includes(d.code) || containedConflict(d)));
    const concrete=generated.filter((d:any)=>!String(d.message || '').startsWith('La aceptación editorial no está completa:'));
    const targets=concrete.length?concrete:generated;
    if(targets.some((d:any)=>d.scope==='submission')) return {tasks:['development','audit','artifact'],letter:true};
    if(targets.length && targets.every((d:any)=>d.scope==='letter')) return {tasks:['audit','artifact'],letter:true};
  }
  const ids=new Set<string>();let letter=false;let b10=false;
  for(const defect of defects) {
    if(defect.code!=='UNSUPPORTED_CLAIM' || defect.owner!=='rankpilot' || !defect.source_quote || !defect.artifact_quote || defect.source_quote===defect.artifact_quote) continue;
    const matter=(data.matters || []).find((m:any)=>m.id===defect.matter_id);
    const source=matter ? [matter.rawNotes,matter.source_excerpt,matter.value].filter(Boolean).join(' '):String(data.confirmed_source_b10 ?? data.original_b10 ?? '');
    if(!source.includes(defect.source_quote)) continue;
    if(defect.scope==='letter') {
      if(!Object.values(data.editorial_review?.letter || {}).some(text=>String(text).includes(defect.artifact_quote))) continue;
      letter=true;
    } else if(defect.scope==='submission' && matter?.draft_provenance && matter.draft_provenance.text_hash===stableHash(String(matter.optimizedText || matter.optimized_text || '').trim()) && String(matter.optimizedText || matter.optimized_text || '').includes(defect.artifact_quote)) ids.add(matter.id);
    else if(defect.scope==='submission' && !matter && data.b10_optimization?.text===data.enhanced_b7 && String(data.enhanced_b7 || '').includes(defect.artifact_quote)) b10=true;
  }
  if(!ids.size && !letter && !b10) return null;
  return {tasks:[...ids].map(id=>`matter:${id}`).concat(b10?['b10','audit','artifact']:['audit','artifact']),letter};
}
