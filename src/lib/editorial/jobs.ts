import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { stableHash, sourceSnapshot, draftDisposition, ReviewIssue, EDITORIAL_VERSION } from './contracts';
import { deliveryInputHash } from '@/lib/audit/artifact-binding';
import { bindGeneratedFindings } from './artifact-findings';
import { recoveryPlan, hasUnknownProviderUsage } from './recovery';
import { isStoppedSelection } from '@/lib/audit/review-actions';
import { canResumeEditorialResidual } from './residual-recovery';
import {canResumeSelectionDiagnostic,canResumeSelectionProgress,canReplaySelectionRepair} from './selection-recovery';
import {canRecheckDevelopment,canRecheckFieldContext,FIELD_CONTEXT_VERSION} from './development-recheck';
import {SELECTION_DIAGNOSTIC_CONTRACT} from '@/lib/audit/review-versions';
import {editorialNextAction} from './next-action';
import {canResumeLegacyDevelopment} from './legacy-development-recovery';
import {canResumeBudgetReview,capacityRecoveryCheckpoint} from './budget-continuation';
import {editorialTokenBudget} from './recovery';

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
export function publicJob(job:any, submission?:any) {
  if(!job) return null;
  const sourceMatches=submission && typeof job.sourceHash==='string' ? stableHash(sourceSnapshot(submission))===job.sourceHash : null;
  const labels:Record<string,string>={selection:'Comparando y seleccionando los asuntos',development:'Desarrollando Submission, candidaturas y posicionamiento',b10:'Redactando la descripción del departamento',audit:'Preparando el Audit de la misma selección',artifact:'Verificando el Submission y el Audit finales'};
  const recovering=['queued','running'].includes(job.status) && (job.issue?.owner==='rankpilot' || [...(job.ledger || [])].reverse().find((e:any)=>e.supervision)?.supervision?.action==='repair');
  const active=['queued','running'].includes(job.status);
  const waiting=job.status==='queued';
  const paused=!active && job.status!=='completed';
  const total=job.tasks.length===1 && job.tasks[0]==='selection' ? 4 : job.tasks.length;
  const lastDecision=job.ledger?.at(-1)?.supervision;
  const pauseReason=sourceMatches===false ? null : paused && lastDecision?.action==='pause' ? lastDecision.reason : isStoppedSelection(job) ? (job.issue.code==='SELECTION_REJECTED'?'selection_rejected':job.issue.code==='SELECTION_DIAGNOSTIC_INVALID'?'selection_diagnostic_invalid':'selection_review_unavailable') : job.status==='failed' && job.issue?.owner==='rankpilot' ? 'stage_stopped' : null;
  const message=paused?'La preparación está pausada. Tu información y el avance están guardados.':waiting?'Preparación en espera. Continuará automáticamente; puedes salir y volver.':labels[job.stage] || 'Redactando un asunto seleccionado';
  const canResumeSelection=!!submission && sourceMatches===true && canResumeSelectionDiagnostic(job,submission.chambersData,job.sourceHash,process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || 'local');
  const canResumeRepair=!!submission && sourceMatches===true && canResumeEditorialResidual(job,submission.chambersData,job.sourceHash,process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || 'local');
  const canResumeLegacy=!!submission && sourceMatches===true && canResumeLegacyDevelopment(job,submission.chambersData,job.sourceHash,process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || 'local');
  const canRecheckContext=!!submission && sourceMatches===true && canRecheckFieldContext(job,submission.chambersData,job.sourceHash,process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || 'local');
  const canRecheck=!canResumeLegacy && !canRecheckContext && !canResumeRepair && !!submission && sourceMatches===true && canRecheckDevelopment(job,submission.chambersData,job.sourceHash,process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || 'local');
  const canResumeProgress=!!submission && sourceMatches===true && canResumeSelectionProgress(job,submission.chambersData,job.sourceHash,process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || 'local');
  const canReplay=!!submission && sourceMatches===true && canReplaySelectionRepair(job,submission.chambersData,job.sourceHash,process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || 'local');
  const canResumeBudget=!!submission && sourceMatches===true
    && job.resultHash===deliveryInputHash(submission,submission.chambersData || {})
    && canResumeBudgetReview(job,submission.chambersData,job.sourceHash);
  const canResumeResidual=canResumeBudget || canResumeLegacy || canRecheckContext || canRecheck || canResumeSelection || canResumeProgress || canReplay || canResumeRepair;
  return {id:job.id,status:job.status,stage:job.stage,recovering,waiting,message,pauseReason,sourceMatches,canResumeResidual,nextAction:editorialNextAction(job,{sourceMatches,canResume:canResumeResidual}),canResumeSelectionDiagnostic:canResumeSelection,canResumeSelectionProgress:canResumeProgress,canReplaySelectionRepair:canReplay,canRecheckDevelopment:canRecheck,canRecheckFieldContext:canRecheckContext,completed:job.cursor,total,startedAt:job.createdAt,issue:publicJobIssue(job.issue),updatedAt:job.updatedAt,version:EDITORIAL_VERSION};
}
/** Provider/validator diagnostics stay in the private ledger, not user actions. */
export function publicJobIssue(issue:any) {
  if(!issue || issue.owner==='user') return issue;
  return {...issue,message:'La preparación está pausada. Tu información y el avance están guardados. No necesitas modificar ni volver a subir el documento.'};
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
    if(last?.sourceHash===sourceHash && hasUnknownProviderUsage(last.ledger)) throw new Error('PROVIDER_OUTCOME_UNKNOWN');
    // A rejected bounded selection cannot buy a fresh allowance via retry=true.
    // A later software release also must not reactivate this historical attempt.
    const resultHash=deliveryInputHash(current,current.chambersData || {});
    const build=process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || 'local';
    if(retry && last?.resultHash===resultHash && canResumeBudgetReview(last,current.chambersData,sourceHash)) {
      const cursor=last.cursor-1;
      const marker={stage:'artifact',cursor,status:'capacity_continuation_requested',capacity:editorialTokenBudget(last.ledger),worker_commit:build,source_hash:sourceHash};
      const checkpoint=capacityRecoveryCheckpoint(last,current.chambersData);
      await tx.submission.update({where:{id:current.id},data:{chambersData:{...(current.chambersData as any),review_checkpoint:checkpoint}}});
      const resumed:any[]=await tx.$queryRaw`UPDATE "EditorialJob" SET "status"='queued',"cursor"=${cursor},"issue"=NULL,"leaseToken"=NULL,"leaseUntil"=now(),"ledger"="ledger" || ${JSON.stringify([marker])}::jsonb,"updatedAt"=now() WHERE "id"=${last.id} AND "status"='needs_review' RETURNING *`;
      return resumed[0] || last;
    }
    if(retry && canResumeSelectionProgress(last,current.chambersData,sourceHash,build)) {
      const marker={stage:last.stage,cursor:last.cursor,status:'selection_progress_recovery_requested',worker_commit:build,source_hash:sourceHash};
      const resumed:any[]=await tx.$queryRaw`UPDATE "EditorialJob" SET "status"='queued',"issue"=NULL,"leaseToken"=NULL,"leaseUntil"=now(),"ledger"="ledger" || ${JSON.stringify([marker])}::jsonb,"updatedAt"=now() WHERE "id"=${last.id} AND "status"='failed' RETURNING *`;
      return resumed[0] || last;
    }
    if(retry && canReplaySelectionRepair(last,current.chambersData,sourceHash,build)) {
      const marker={stage:last.stage,cursor:last.cursor,status:'selection_repair_cache_replay_requested',worker_commit:build,source_hash:sourceHash};
      const resumed:any[]=await tx.$queryRaw`UPDATE "EditorialJob" SET "status"='queued',"issue"=NULL,"leaseToken"=NULL,"leaseUntil"=now(),"ledger"="ledger" || ${JSON.stringify([marker])}::jsonb,"updatedAt"=now() WHERE "id"=${last.id} AND "status"='failed' RETURNING *`;
      return resumed[0] || last;
    }
    if(last?.sourceHash===sourceHash && last?.issue?.code==='SELECTION_REJECTED') return last;
    if(retry && canResumeLegacyDevelopment(last,current.chambersData,sourceHash,build)) {
      const marker={stage:last.stage,cursor:last.cursor,status:'legacy_development_recovery_requested',worker_commit:build,source_hash:sourceHash};
      const resumed:any[]=await tx.$queryRaw`UPDATE "EditorialJob" SET "status"='queued',"issue"=NULL,"leaseToken"=NULL,"leaseUntil"=now(),"ledger"="ledger" || ${JSON.stringify([marker])}::jsonb,"updatedAt"=now() WHERE "id"=${last.id} AND "status"='failed' RETURNING *`;
      return resumed[0] || last;
    }
    if(retry && canRecheckFieldContext(last,current.chambersData,sourceHash,build)) {
      const marker={stage:last.stage,cursor:last.cursor,status:'field_context_review_requested',context_version:FIELD_CONTEXT_VERSION,worker_commit:build,source_hash:sourceHash};
      const resumed:any[]=await tx.$queryRaw`UPDATE "EditorialJob" SET "status"='queued',"issue"=NULL,"leaseToken"=NULL,"leaseUntil"=now(),"ledger"="ledger" || ${JSON.stringify([marker])}::jsonb,"updatedAt"=now() WHERE "id"=${last.id} AND "status"='failed' RETURNING *`;
      return resumed[0] || last;
    }
    if(retry && canRecheckDevelopment(last,current.chambersData,sourceHash,build) && !canResumeEditorialResidual(last,current.chambersData,sourceHash,build)) {
      const marker={stage:last.stage,cursor:last.cursor,status:'development_recheck_requested',worker_commit:build,source_hash:sourceHash};
      const resumed:any[]=await tx.$queryRaw`UPDATE "EditorialJob" SET "status"='queued',"issue"=NULL,"leaseToken"=NULL,"leaseUntil"=now(),"ledger"="ledger" || ${JSON.stringify([marker])}::jsonb,"updatedAt"=now() WHERE "id"=${last.id} AND "status"='failed' RETURNING *`;
      return resumed[0] || last;
    }
    if(retry && canResumeSelectionDiagnostic(last,current.chambersData,sourceHash,build)) {
      const marker={stage:last.stage,cursor:last.cursor,status:'selection_diagnostic_recovery_requested',
        diagnostic_contract:SELECTION_DIAGNOSTIC_CONTRACT,worker_commit:build,source_hash:sourceHash};
      const resumed:any[]=await tx.$queryRaw`UPDATE "EditorialJob" SET "status"='queued',"issue"=NULL,"leaseToken"=NULL,"leaseUntil"=now(),"ledger"="ledger" || ${JSON.stringify([marker])}::jsonb,"updatedAt"=now() WHERE "id"=${last.id} AND "status"='failed' RETURNING *`;
      return resumed[0] || last;
    }
    if(retry && canResumeEditorialResidual(last,current.chambersData,sourceHash,build)) {
      const marker={stage:last.stage,cursor:last.cursor,status:'residual_recovery_requested',worker_commit:build,source_hash:sourceHash};
      const resumed:any[]=await tx.$queryRaw`UPDATE "EditorialJob" SET "status"='queued',"issue"=NULL,"leaseToken"=NULL,"leaseUntil"=now(),"ledger"="ledger" || ${JSON.stringify([marker])}::jsonb,"updatedAt"=now() WHERE "id"=${last.id} AND "status"='failed' RETURNING *`;
      return resumed[0] || last;
    }
    // Resume a stopped repair after a code fix at its exact cursor. Keep the
    // complete ledger and budget; never restart extraction or selection.
    if(last?.status==='failed' && last.sourceHash===sourceHash && last.ledger?.some((e:any)=>e.status==='repair_requested')) {
      if(retry && last.issue?.code==='DEVELOPMENT_REJECTED' && last.ledger.at(-1)?.worker_commit!==build && recoveryPlan(last,last.issue.code,build)) {
        const resumed:any[]=await tx.$queryRaw`UPDATE "EditorialJob" SET "status"='queued',"leaseToken"=NULL,"leaseUntil"=now(),"updatedAt"=now() WHERE "id"=${last.id} AND "status"='failed' RETURNING *`;
        return resumed[0] || last;
      }
      return last;
    }
    // A terminal failed stage has already used its bounded automatic recovery.
    // Another browser click cannot replace its ledger with an empty budget.
    if(last?.sourceHash===sourceHash && last?.status==='failed') return last;
    // A stopped attempt cannot acquire a fresh repair allowance by another click.
    if(last?.sourceHash===sourceHash && last?.resultHash===resultHash && last?.ledger?.at(-1)?.supervision?.action==='pause') return last;
    if(waitingForSourceInput(last,current.chambersData,sourceHash)) return last;
    const repair=requestRepair && last?.status==='needs_review' && last.resultHash===resultHash ? targetedRepair(current.chambersData) : null;
    if(requestRepair && last?.status==='needs_review' && last.resultHash===resultHash && !repair) throw new Error('AUTO_REPAIR_UNAVAILABLE');
    if(!repair && last?.resultHash===resultHash && last?.sourceHash===sourceHash && ['completed','needs_review'].includes(last.status)) return last;
    if(last?.sourceHash===sourceHash && !retry) return last;
    // Elapsed time is not evidence of provider completion or zero usage.
    if(last?.status==='indeterminate' && last.sourceHash===sourceHash) throw new Error('PROVIDER_OUTCOME_UNKNOWN');
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
  },{timeout:30000,maxWait:10000});
}

/** Repeated clicks cannot buy another correction while the same source answer
 * is pending after the independent generated fields were repaired. */
export function waitingForSourceInput(job:any,data:any,sourceHash:string):boolean {
  return job?.status==='needs_review' && job.sourceHash===sourceHash
    && (job.ledger || []).some((entry:any)=>entry.supervision?.reason==='generated_corrections_before_source_input')
    && (data?.final_artifact_review?.judge?.defects || []).some((d:any)=>d.severity==='critical' && d.owner==='user');
}

/** Repairs may change generated prose, never source facts or human-edited text. */
export function targetedRepair(data:any):{tasks:string[];letter:boolean}|null {
  const containedConflict=(d:any)=>d.code==='SOURCE_CONFLICT' && (
    (d.conflict_resolution==='omit_nonessential_descriptor' && (d.source_field_path || d.field_path)==='client_sector' && d.conflicting_artifact_term && String(d.artifact_quote || '').toLowerCase().includes(String(d.conflicting_artifact_term).toLowerCase())) ||
    (d.conflict_resolution==='preserve_source_aliases' && d.field_path==='client' && d.scope==='letter') ||
    (d.conflict_resolution==='qualify_disputed_outcome' && (d.source_field_path || d.field_path)==='outcome' && d.qualification_validated===true && ['submission','letter'].includes(d.scope)));
  const defects=bindGeneratedFindings(data.final_artifact_review?.judge?.defects || [],data.editorial_development).filter((d:any)=>
    d.severity==='critical' || (d.owner==='rankpilot' && d.artifact_quote &&
      ((d.code==='UNSUPPORTED_CLAIM' && d.source_quote && d.field_path) || (d.code==='EDITORIAL_STYLE' && d.field_path) || containedConflict(d))));
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
