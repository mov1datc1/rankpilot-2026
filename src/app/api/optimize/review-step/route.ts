import { projectDevelopment } from '@/lib/editorial/development';
import { selectedScope, scopeIssues } from '@/lib/audit/analysis-scope';
import { engineFetch } from '@/lib/editorial/engine';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { editorialUser } from '@/lib/editorial/identity';
import { needsInputReview } from '@/lib/audit/input-review';
import { deliveryInputHash, RENDERER_VERSION, ARTIFACT_REVIEW_VERSION } from '@/lib/audit/artifact-binding';
import { reviewPackage, reviewInputHash, reviewStepHash, resumeReviewCheckpoint, reviewTaskDisposition, reviewSteps, reviewStepLabels, REVIEW_POLICY_VERSION } from '@/lib/audit/review-checkpoint';

export const maxDuration = 300;

/** One paid role per request; checkpoints survive reloads and retries. */
export async function POST(request: NextRequest) {
  let locked: any = null;
  let checkpoint: any = null;
  try {
    const user = await editorialUser(request);
    if (!user) return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    const account = user.email ? await prisma.user.findUnique({where: {email: user.email}}) : null;
    const { submissionId, reviewStage } = await request.json();
    if (!submissionId) return NextResponse.json({error: 'Missing submissionId'}, {status: 400});
    const submission = await prisma.submission.findUnique({where: {id: submissionId}, include: {matters: true}});
    if (!submission || ![user.id, account?.id].includes(submission.userId)) return NextResponse.json({error: 'Not found'}, {status: 404});
    const data: any = submission.chambersData || {};
    const scopeProblems=scopeIssues(selectedScope(submission),data.source_reports || []);
    if(scopeProblems.length) return NextResponse.json({code:scopeProblems[0].code,error:scopeProblems.map(i=>i.message).join(' '),issues:scopeProblems},{status:422});
    const matters = Array.isArray(data.matters) ? data.matters : submission.matters;
    if (matters.some(needsInputReview)) return NextResponse.json({error: 'Resuelve permisos y montos antes de revisar.'}, {status: 422});
    const payload = reviewPackage(submission, data, matters);
    const saved = data.review_checkpoint;
    if (data.completed_review_policy_version === REVIEW_POLICY_VERSION && data.completed_renderer_version === RENDERER_VERSION && data.completed_artifact_review_version === ARTIFACT_REVIEW_VERSION && data.approved_artifact?.audit_sha256 && data.release_verdict?.passed && data.approved_artifact?.input_hash === deliveryInputHash(submission,data)) {
      return NextResponse.json({success:true,done:true,completed:2,stage:'done',message:'El documento aprobado corresponde a esta versión. Reutilizando la revisión guardada.'});
    }
    // Even after an edit, let the in-flight request finish/expire before another
    // starts. Source edits must not buy two copies of the same role concurrently.
    if (saved?.lease_until > Date.now()) return NextResponse.json({success:true,done:false,busy:true,completed:reviewSteps.indexOf(saved.stage),stage:saved.stage,message:'Hay una etapa en curso. Conservamos los entregables guardados.'},{status:202});
    checkpoint = resumeReviewCheckpoint(payload,saved);
    const stage = checkpoint.stage as keyof typeof reviewStepLabels;
    const disposition=reviewTaskDisposition(reviewStage,stage);
    if(disposition==='reuse') {
      if(saved.input_hash!==checkpoint.input_hash) {
        const updated=await prisma.submission.updateMany({where:{id:submission.id,updatedAt:submission.updatedAt},data:{updatedAt:new Date(),chambersData:{...data,review_checkpoint:checkpoint}}});
        if(updated.count!==1) throw new Error('DRAFT_CONFLICT');
      }
      return NextResponse.json({success:true,cached:true,stage:reviewStage,trace:null,message:'Etapa guardada reutilizada; sin nueva llamada al modelo.'});
    }
    if(disposition!=='run') return NextResponse.json({success:false,code:'REVIEW_STAGE_MISMATCH',error:'La preparación necesita reanudarse desde su última etapa guardada.'},{status:409});
    if (!reviewSteps.includes(stage)) throw new Error('Invalid review stage');
    if (stage === 'done') {
      if (saved.input_hash !== checkpoint.input_hash) {
        const updated = await prisma.submission.updateMany({where:{id:submission.id,updatedAt:submission.updatedAt},data:{updatedAt:new Date(),chambersData:{...data,review_checkpoint:checkpoint}}});
        if (updated.count !== 1) throw new Error('DRAFT_CONFLICT');
      }
      return NextResponse.json({success: true, done: true, completed: 2, stage, message: reviewStepLabels.done});
    }
    checkpoint = {...checkpoint, lease_until: Date.now() + 330000, lease_id: randomUUID(), error: null};
    const changed = await prisma.submission.updateMany({where: {id: submission.id, updatedAt: submission.updatedAt}, data: {updatedAt: new Date(), chambersData: {...data, review_checkpoint: checkpoint}}});
    if (changed.count !== 1) throw new Error('DRAFT_CONFLICT');
    locked = await prisma.submission.findUnique({where: {id: submission.id}});
    if ((locked.chambersData as any)?.review_checkpoint?.lease_id !== checkpoint.lease_id) throw new Error('DRAFT_CONFLICT');
    const response = await engineFetch(`${process.env.PYTHON_API_URL || 'http://127.0.0.1:8000'}/review-step`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(250000),
      body: JSON.stringify({stage, package: payload, state: checkpoint.state}),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      const failure = {code: result.code || 'AI_REVIEW_UNAVAILABLE', error: result.error || 'No se completó esta etapa. El avance se conserva.'};
      await prisma.submission.updateMany({where: {id: submission.id, updatedAt: locked.updatedAt}, data: {updatedAt: new Date(), chambersData: {...(locked.chambersData as any), review_checkpoint: {...checkpoint, lease_until: 0, error: failure}}}});
      locked = null;
      return NextResponse.json(failure, {status: 502});
    }
    const nextStage = result.next_stage;
    if (!reviewSteps.includes(nextStage) || !result.state || reviewSteps.indexOf(nextStage) <= reviewSteps.indexOf(stage)) throw new Error('Invalid review response');
    const step_keys = {...checkpoint.step_keys,[stage]:reviewStepHash(stage,payload,result.state)};
    const projected = stage === 'development' && result.state.development_validated ? projectDevelopment({...locked.chambersData,matters}, result.state) : locked.chambersData;
    const projectedHash = reviewInputHash(reviewPackage(submission,projected,projected.matters || matters));
    const savedResult = await prisma.submission.updateMany({where: {id: submission.id, updatedAt: locked.updatedAt}, data: {updatedAt: new Date(), chambersData: {...projected, review_checkpoint: {...checkpoint, input_hash:projectedHash, step_keys, stage: nextStage, state: result.state, lease_until: 0}}}});
    if (savedResult.count !== 1) throw new Error('DRAFT_CONFLICT');
    locked = null;
    const trace=(result.state.trace?.length || 0)>(checkpoint.state.trace?.length || 0)?result.state.trace.at(-1):null;
    if(result.state.errors?.length) return NextResponse.json({success:false,code:stage==='strategy'?'SELECTION_REJECTED':'DEVELOPMENT_REJECTED',error:result.state.errors.join(' '),trace},{status:422});
    return NextResponse.json({success: true, done: nextStage === 'done', completed: reviewSteps.indexOf(nextStage), stage: nextStage, trace, message: reviewStepLabels[nextStage as keyof typeof reviewStepLabels]});
  } catch (error: any) {
    // A timeout leaves the lease until expiry: a still-running provider call must
    // not overlap a retry. Successful earlier stages remain persisted.
    return NextResponse.json({code: error.message === 'DRAFT_CONFLICT' ? 'DRAFT_CONFLICT' : 'AI_REVIEW_UNAVAILABLE', error: 'La etapa no se completó. Las etapas anteriores están guardadas.'}, {status: error.message === 'DRAFT_CONFLICT' ? 409 : 502});
  }
}
