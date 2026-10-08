import { selectedScope, scopeIssues } from '@/lib/audit/analysis-scope';
import { normalizeLetterSections } from '@/lib/audit/letter-sections';
import { engineFetch } from '@/lib/editorial/engine';
import { needsInputReview } from '@/lib/audit/input-review';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import { reviewPackage, reviewInputHash, REVIEW_POLICY_VERSION } from '@/lib/audit/review-checkpoint';
import { processingFeedback } from '@/lib/ux/processing-feedback';
import { NextRequest, NextResponse } from 'next/server';
import { Packer } from 'docx';
import prisma from '@/lib/prisma';
import { editorialUser } from '@/lib/editorial/identity';
import { getDeliveryState } from '@/lib/audit/delivery-state';
import { artifactHash, deliveryInputHash, RENDERER_VERSION, ARTIFACT_REVIEW_VERSION } from '@/lib/audit/artifact-binding';
import { buildAuditDoc } from '@/app/api/generate-docx/audit-builder';
import { buildSubmissionDoc } from '@/app/api/generate-docx/submission-builder';

export const maxDuration = 300;

const reviewOutputHash = (review:any) => reviewInputHash({strategy:review.strategy,letter:review.letter,judge:review.judge,ranking_verification:review.ranking_verification,selection_validated:review.selection_validated,selection_review:review.selection_review,selection_review_validated:review.selection_review_validated,development:review.development,development_validated:review.development_validated,release_verdict:review.release_verdict,render_gate:review.render_gate});

/** One completion authority: source register → bounded editorial review → exact artifact. */
export async function POST(request: NextRequest) {
  const started=Date.now();
  const remaining=()=>Math.max(1,270000-(Date.now()-started));
  try {
    const user = await editorialUser(request);
    if (!user) return NextResponse.json({error:'Not authenticated'}, {status:401});
    const account = user.email ? await prisma.user.findUnique({where:{email:user.email}}) : null;
    const body = await request.json();
    if (!body.submissionId) return NextResponse.json({error:'Missing submissionId'}, {status:400});
    const submission = await prisma.submission.findUnique({where:{id:body.submissionId},include:{matters:true}});
    if (!submission || ![user.id,account?.id].includes(submission.userId)) return NextResponse.json({error:'Not found'}, {status:404});
    const previous = submission.chambersData as any || {};
    const scopeProblems=scopeIssues(selectedScope(submission),previous.source_reports || []);
    if(scopeProblems.length) return NextResponse.json({code:scopeProblems[0].code,error:scopeProblems.map(i=>i.message).join(' '),issues:scopeProblems},{status:422});
    const stored = Array.isArray(previous.matters) ? previous.matters : submission.matters;
    if (stored.some(needsInputReview)) return NextResponse.json({error:'Resuelve los permisos y montos pendientes en el asistente antes de la revisión final.'}, {status:422});
    const draft = Array.isArray(body.matters) ? body.matters : stored;
    const ids = draft.map((m:any) => m.id);
    if (!draft.length || ids.some((id:any)=>!id) || new Set(ids).size !== ids.length) return NextResponse.json({error:'El expediente debe contener asuntos con IDs únicos.'}, {status:422});
    // Completion edits prose, never changes the evidence universe or source facts.
    if (draft.length !== stored.length || draft.some((m:any)=>!stored.some((s:any)=>s.id===m.id))) return NextResponse.json({error:'El registro cambió. Guarda y revisa los asuntos antes de completar.'}, {status:409});
    const draftsById = new Map(draft.map((m:any)=>[m.id,m]));
    const matters = stored.map((m:any) => {
      const proposed:any=draftsById.get(m.id);
      return {...m, optimizedText:proposed.optimizedText || proposed.optimized_text || m.optimizedText || '', optimized_text:proposed.optimizedText || proposed.optimized_text || m.optimized_text || ''};
    });
    if (draft.some((m:any)=>{
      const saved:any=stored.find((s:any)=>s.id===m.id);
      return (m.optimizedText || m.optimized_text || '') !== (saved?.optimizedText || saved?.optimized_text || '');
    })) return NextResponse.json({error:'La versión optimizada cambió. Guarda o recarga el borrador antes de revisar.'},{status:409});
    const b10 = typeof body.b10Text === 'string' ? body.b10Text : previous.enhanced_b7 || previous.original_b10 || '';
    if (previous.enhanced_b7 && b10 !== previous.enhanced_b7) return NextResponse.json({error:'La narrativa cambió. Guarda o recarga antes de completar.'},{status:409});
    const inputHash = reviewInputHash(reviewPackage(submission, previous, stored));
    const checkpoint = previous.review_checkpoint;
    const cachedReview = checkpoint?.input_hash === inputHash && checkpoint.stage === 'done' ? checkpoint.state : null;
    const sameReview = previous.completed_review_policy_version === REVIEW_POLICY_VERSION && previous.completed_renderer_version === RENDERER_VERSION && previous.completed_artifact_review_version === ARTIFACT_REVIEW_VERSION && (!cachedReview || previous.completed_review_result_hash === reviewOutputHash(cachedReview));
    if (sameReview && previous.approved_artifact?.input_hash === deliveryInputHash(submission, previous) && previous.release_verdict?.passed) {
      return NextResponse.json({success:true,status:submission.status,submission,chambersData:previous,matters:stored,b10,release:previous.release_verdict,cached:true});
    }
    if (body.checkpoint && !cachedReview) return NextResponse.json({code:'DRAFT_CONFLICT',error:'Completa las etapas de revisión del borrador actual antes de generar el Word.'},{status:409});
    if (sameReview && previous.completed_review_input_hash === inputHash && previous.final_artifact_review?.judge) {
      return NextResponse.json({success:true,status:submission.status,submission,chambersData:previous,matters:stored,b10,release:previous.release_verdict,cached:true});
    }
    if (body.checkpoint) {
      if (checkpoint.lease_until > Date.now()) return NextResponse.json({success:true,pending:true,message:'La revisión del Word ya está en curso.'},{status:202});
      const claimed = {...checkpoint,lease_until:Date.now()+330000,lease_id:randomUUID()};
      const lock = await prisma.submission.updateMany({where:{id:submission.id,updatedAt:submission.updatedAt},data:{updatedAt:new Date(),chambersData:{...previous,review_checkpoint:claimed}}});
      if (lock.count !== 1) throw new Error('DRAFT_CONFLICT');
      const latest = await prisma.submission.findUnique({where:{id:submission.id}});
      if (!latest || (latest.chambersData as any)?.review_checkpoint?.lease_id !== claimed.lease_id) throw new Error('DRAFT_CONFLICT');
      submission.updatedAt = latest.updatedAt;
      previous.review_checkpoint = claimed;
    }
    let review:any;
    if (cachedReview) {
      review = {success:true,...cachedReview};
    } else {
      return NextResponse.json({code:'EDITORIAL_PIPELINE_REQUIRED',error:'Prepara el Submission y Audit para completar la elaboración y revisión del expediente.'},{status:409});
    }
    if (!review.success || !review.release_verdict) return NextResponse.json({error:'Respuesta de revisión incompleta. El borrador se conserva.'}, {status:502});
    if(review.selection_validated && !review.selection_review_validated) return NextResponse.json({code:'EDITORIAL_PIPELINE_REQUIRED',error:'Falta contrastar la interpretación y selección con las fuentes antes de preparar los documentos.'},{status:409});
    if(review.selection_validated && (!review.development_validated || review.development?.version!=='editorial-development-v1')) return NextResponse.json({code:'EDITORIAL_PIPELINE_REQUIRED',error:'Falta desarrollar y validar el Submission completo antes de aprobar la entrega.'},{status:409});
    const originalReviewHash = reviewOutputHash(review);
    review = {...review,letter:normalizeLetterSections(review.letter)};
    const decisions = review.strategy?.matters || [];
    const selectionValidated = review.selection_validated === true;
    const data:any = {
      ...previous,completed_review_policy_version:REVIEW_POLICY_VERSION,completed_renderer_version:RENDERER_VERSION,completed_artifact_review_version:ARTIFACT_REVIEW_VERSION,matters,enhanced_b7:b10,enhanced_b10:b10,completed_review_input_hash:inputHash,completed_review_result_hash:originalReviewHash,
      ...(previous.review_checkpoint ? {review_checkpoint:{...previous.review_checkpoint,lease_until:0}} : {}),
      cloned_docx_b64:null,approved_artifact:null,final_artifact_review:null,final_review_stale:false,review_responses:[],
      draft_revision:Number(previous.draft_revision || 0)+1,
      canonical_matter_selection:selectionValidated ? {core_matter_ids:decisions.filter((d:any)=>d.disposition==='core').map((d:any)=>d.matter_id),reserve_matter_ids:decisions.filter((d:any)=>d.disposition==='reserve').map((d:any)=>d.matter_id),excluded_matter_ids:decisions.filter((d:any)=>d.disposition==='excluded').map((d:any)=>d.matter_id),hero_matter_id:review.strategy?.hero_matter_id || null} : null,
      hero_matter_id:selectionValidated ? review.strategy?.hero_matter_id || null : null,
      editorial_development:review.development || previous.editorial_development,
      editorial_review:{...review,selection_validated:selectionValidated},ranking_verification:review.ranking_verification,ranking_claim:submission.currentBand || null,
      analysis:{summary:review.letter?.executive_assessment || '',score:null,matter_evaluations:decisions},
      judgeScore:null,judgeFeedback:(review.release_verdict.errors || []).join(' '),judgeVerdict:review.judge,
      release_verdict:review.release_verdict,
    };
    if(data.review_checkpoint) data.review_checkpoint.input_hash=reviewInputHash(reviewPackage(submission,data,matters));
    data.completed_review_input_hash=reviewInputHash(reviewPackage(submission,data,matters));
    // Deterministic gates permit rendering; only the exact-artifact judge can
    // approve delivery. Never persist a provisional approval before that judge.
    const readiness=getDeliveryState(review.render_gate ? {...data,release_verdict:review.render_gate} : data,matters);
    data.release_verdict={passed:false,status:'needs_review',errors:readiness.errors};
    if (readiness.approved) {
      try {
        const doc=buildSubmissionDoc(previous.firm_name || previous.firmName || '',submission.practiceArea,data,{...submission,chambersData:data,matters},'optimized');
        const buffer=await Packer.toBuffer(doc);
        const auditDoc=buildAuditDoc(previous.firm_name || previous.firmName || '',submission.practiceArea,data.analysis,{},review.letter,{...submission,chambersData:{...data,artifact_pair_revision:inputHash},matters});
        const auditBuffer=await Packer.toBuffer(auditDoc);
        const auditArchive=await JSZip.loadAsync(auditBuffer);
        const renderedAudit=(await auditArchive.file('word/document.xml')!.async('string')).replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
        const archive=await JSZip.loadAsync(buffer);
        const parts=Object.keys(archive.files).filter(name=>/^word\/(document|header\d+|footer\d+)\.xml$/.test(name));
        const rendered=(await Promise.all(parts.map(async name=>`${name}: ${(await archive.files[name].async('string')).replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')}`))).join('\n');
        const finalResponse=await engineFetch(`${process.env.PYTHON_API_URL || 'http://127.0.0.1:8000'}/verify-rendered-package`,{
          method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(remaining()),
          body:JSON.stringify({package:{...reviewPackage(submission,previous,matters),ranking_verification:review.ranking_verification,rendered_artifact:rendered,rendered_audit:renderedAudit},strategy:review.strategy,letter:review.letter,allow_repair:false,output_recovery:body.outputRecovery===true})
        });
        const finalReview=await finalResponse.json();
        if(!finalResponse.ok && finalReview.code==='AI_OUTPUT_LIMIT') {
          // The provider returned a terminal response, so this lease can safely
          // be released. Timeouts with unknown outcomes retain their lease.
          const released=await prisma.submission.updateMany({where:{id:submission.id,updatedAt:submission.updatedAt},data:{updatedAt:new Date(),chambersData:{...previous,review_checkpoint:{...previous.review_checkpoint,lease_until:0}}}});
          if(released.count!==1) throw new Error('DRAFT_CONFLICT');
          return NextResponse.json({success:false,code:finalReview.code,error:'La revisión necesita recuperar una respuesta incompleta. Tus documentos guardados se conservan.',trace:finalReview.trace || null},{status:502});
        }
        if(!finalResponse.ok) throw new Error(processingFeedback(finalReview,finalResponse.status,'review'));
        data.final_artifact_review=finalReview;
        if(!finalReview.success || !finalReview.judge?.passed || finalReview.judge.defects?.some((d:any)=>d.severity==='critical')) throw new Error(finalReview.judge?.defects?.map((d:any)=>d.message).join('; ') || 'El archivo final requiere correcciones.');
        data.release_verdict={passed:true,status:'passed',errors:[]};
        data.judgeVerdict=finalReview.judge;
        if(finalReview.letter) {data.editorial_review={...review,letter:finalReview.letter};data.analysis.summary=finalReview.letter.executive_assessment || '';}
        data.approved_artifact={base64:buffer.toString('base64'),sha256:artifactHash(buffer),audit_base64:auditBuffer.toString('base64'),audit_sha256:artifactHash(auditBuffer),revision_id:inputHash,input_hash:deliveryInputHash(submission,data),directory:submission.targetDirectory};
      } catch (error:any) {
        data.release_verdict={passed:false,status:'needs_review',errors:data.final_artifact_review?.judge?.defects?.filter((d:any)=>d.severity==='critical').map((d:any)=>d.message) || [`El documento no superó la validación final: ${error.message}`]};
      }
    }
    const updated=await prisma.$transaction(async tx=>{
      const lock=await tx.submission.updateMany({where:{id:submission.id,updatedAt:submission.updatedAt},data:{updatedAt:new Date()}});
      if(lock.count!==1) throw new Error('DRAFT_CONFLICT');
      for(const m of matters) await tx.matter.updateMany({where:{id:m.id,submissionId:submission.id},data:{optimizedText:m.optimizedText,status:'Optimized'}});
      return tx.submission.update({where:{id:submission.id},data:{status:data.release_verdict.passed?'Optimized':'Draft',chambersData:data},include:{matters:true}});
    });
    return NextResponse.json({success:true,status:updated.status,submission:updated,chambersData:data,matters,b10,c2:data.enhanced_c2 || '',judgeScore:null,judgeFeedback:data.judgeFeedback,repairsCount:0,repairsLog:[],release:data.release_verdict});
  } catch(error:any) {
    console.error('[Editorial completion]',error);
    return NextResponse.json({error:error.message==='DRAFT_CONFLICT'?'El borrador cambió durante la revisión. Recarga antes de reintentar.':'No se pudo completar la revisión; el borrador se conserva.'},{status:error.message==='DRAFT_CONFLICT'?409:500});
  }
}
