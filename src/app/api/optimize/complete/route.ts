import { needsInputReview } from '@/lib/audit/input-review';
import JSZip from 'jszip';
import { NextRequest, NextResponse } from 'next/server';
import { Packer } from 'docx';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { getDeliveryState } from '@/lib/audit/delivery-state';
import { artifactHash, deliveryInputHash } from '@/lib/audit/artifact-binding';
import { buildSubmissionDoc } from '@/app/api/generate-docx/submission-builder';

export const maxDuration = 300;

/** One completion authority: source register → bounded editorial review → exact artifact. */
export async function POST(request: NextRequest) {
  const started=Date.now();
  const remaining=()=>Math.max(1,270000-(Date.now()-started));
  try {
    const supabase = await createClient();
    const {data:{user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error:'Not authenticated'}, {status:401});
    const account = user.email ? await prisma.user.findUnique({where:{email:user.email}}) : null;
    const body = await request.json();
    if (!body.submissionId) return NextResponse.json({error:'Missing submissionId'}, {status:400});
    const submission = await prisma.submission.findUnique({where:{id:body.submissionId},include:{matters:true}});
    if (!submission || ![user.id,account?.id].includes(submission.userId)) return NextResponse.json({error:'Not found'}, {status:404});
    const previous = submission.chambersData as any || {};
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
    const reviewResponse = await fetch(`${process.env.PYTHON_API_URL || 'http://127.0.0.1:8000'}/review-package`, {
      method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(Math.min(180000,remaining())),
      body:JSON.stringify({directory:submission.targetDirectory,practice_area:submission.practiceArea,jurisdiction:submission.guideRegion,firm_name:previous.firm_name || previous.firmName || '',research_period:previous.research_period || null,current_band:submission.currentBand,ranking_edition:previous.ranking_edition,ranking_jurisdiction:previous.ranking_jurisdiction,preferred_hero_id:previous.user_selected_hero_id || null,
        b10_source:previous.confirmed_source_b10 ?? previous.original_b10 ?? '',b10_draft:b10,c2_source:previous.original_c2 || '',c2_draft:previous.enhanced_c2 || '',lawyers:previous.lawyers || [],matters})
    });
    if (!reviewResponse.ok) return NextResponse.json({error:'La revisión editorial no se completó. El borrador anterior se conserva.'}, {status:502});
    const review = await reviewResponse.json();
    if (!review.success || !review.release_verdict) return NextResponse.json({error:'Respuesta de revisión incompleta. El borrador se conserva.'}, {status:502});
    const decisions = review.strategy?.matters || [];
    const data:any = {
      ...previous,matters,enhanced_b7:b10,enhanced_b10:b10,
      cloned_docx_b64:null,approved_artifact:null,
      draft_revision:Number(previous.draft_revision || 0)+1,
      canonical_matter_selection:{core_matter_ids:decisions.filter((d:any)=>d.disposition==='core').map((d:any)=>d.matter_id),reserve_matter_ids:decisions.filter((d:any)=>d.disposition==='reserve').map((d:any)=>d.matter_id),excluded_matter_ids:decisions.filter((d:any)=>d.disposition==='excluded').map((d:any)=>d.matter_id),hero_matter_id:review.strategy?.hero_matter_id || null},
      hero_matter_id:review.strategy?.hero_matter_id || null,
      editorial_review:review,ranking_verification:review.ranking_verification,ranking_claim:submission.currentBand || null,
      analysis:{summary:review.letter?.executive_assessment || '',score:null,matter_evaluations:decisions},
      judgeScore:null,judgeFeedback:(review.release_verdict.errors || []).join(' '),judgeVerdict:review.judge,
      release_verdict:review.release_verdict,
    };
    const readiness=getDeliveryState(data,matters);
    data.release_verdict={...data.release_verdict,passed:readiness.approved,status:readiness.approved?'passed':'needs_review',errors:readiness.errors};
    if (readiness.approved) {
      try {
        const doc=buildSubmissionDoc(previous.firm_name || previous.firmName || '',submission.practiceArea,data,{...submission,chambersData:data,matters},'optimized');
        const buffer=await Packer.toBuffer(doc);
        const archive=await JSZip.loadAsync(buffer);
        const parts=Object.keys(archive.files).filter(name=>/^word\/(document|header\d+|footer\d+)\.xml$/.test(name));
        const rendered=(await Promise.all(parts.map(async name=>`${name}: ${(await archive.files[name].async('string')).replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')}`))).join('\n');
        const finalResponse=await fetch(`${process.env.PYTHON_API_URL || 'http://127.0.0.1:8000'}/verify-rendered-package`,{
          method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(remaining()),
          body:JSON.stringify({package:{directory:submission.targetDirectory,practice_area:submission.practiceArea,research_period:previous.research_period || null,current_band:submission.currentBand,ranking_verification:review.ranking_verification,b10_source:previous.confirmed_source_b10 ?? previous.original_b10 ?? '',matters,lawyers:previous.lawyers || [],rendered_artifact:rendered},strategy:review.strategy,letter:review.letter})
        });
        if(!finalResponse.ok) throw new Error('La revisión del archivo final no está disponible.');
        const finalReview=await finalResponse.json();
        if(!finalReview.success || !finalReview.judge?.passed || finalReview.judge.defects?.some((d:any)=>d.severity==='critical')) throw new Error(finalReview.judge?.defects?.map((d:any)=>d.message).join('; ') || 'El archivo final requiere correcciones.');
        data.final_artifact_review=finalReview;
        if(finalReview.letter) {data.editorial_review={...review,letter:finalReview.letter};data.analysis.summary=finalReview.letter.executive_assessment || '';}
        data.approved_artifact={base64:buffer.toString('base64'),sha256:artifactHash(buffer),input_hash:deliveryInputHash(submission,data),directory:submission.targetDirectory};
      } catch (error:any) {
        data.release_verdict={passed:false,status:'needs_review',errors:[`El documento no superó la validación final: ${error.message}`]};
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
