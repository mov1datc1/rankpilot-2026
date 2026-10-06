import { selectedScope, scopeIssues } from '@/lib/audit/analysis-scope';
import { engineFetch } from '@/lib/editorial/engine';
import { draftSourceHash, stableHash } from '@/lib/editorial/contracts';
import { NextRequest, NextResponse } from 'next/server';
import { needsInputReview } from '@/lib/audit/input-review';
import prisma from '@/lib/prisma';
import { editorialUser } from '@/lib/editorial/identity';

export const maxDuration=300;

export async function POST(request: NextRequest) {
  try {
    const user = await editorialUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let resolvedUserId = user.id;
    if (user.email) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true }
      });
      if (existingByEmail) resolvedUserId = existingByEmail.id;
    }

    const body = await request.json();
    const { submissionId, matterId, directive, matter: inlineMatter } = body;

    if (!submissionId || (!matterId && !inlineMatter)) {
      return NextResponse.json({ error: 'Missing submissionId or matter' }, { status: 400 });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { matters: true }
    });

    if (!submission || (submission.userId !== user.id && submission.userId !== resolvedUserId)) {
      return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 403 });
    }

    // A browser draft is not a replacement for the persisted source register.
    const chambersData = (submission.chambersData as any) || {};
    const scopeProblems=scopeIssues(selectedScope(submission),chambersData.source_reports || []);
    if(scopeProblems.length) return NextResponse.json({code:scopeProblems[0].code,error:scopeProblems.map(i=>i.message).join(' '),issues:scopeProblems},{status:422});
    const stableId = matterId || inlineMatter?.id;
    const sourceMatter = (chambersData.matters || submission.matters).find((m:any)=>m.id===stableId);
    const dbMatter = submission.matters.find(m=>m.id===stableId);
    if (!stableId || !sourceMatter || !dbMatter) return NextResponse.json({error:'Guarda el asunto antes de optimizarlo.'},{status:409});
    const targetMatter = {...dbMatter,...sourceMatter};
    if (needsInputReview(targetMatter)) return NextResponse.json({error:'Confirma los permisos y resuelve los montos en el asistente antes de optimizar.'}, {status:422});

    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';

    const payload = {
      matter: targetMatter,
      directive: directive || '',
      practice_area: submission.practiceArea || '',
      directory: submission.targetDirectory,
      jurisdiction: submission.guideRegion,
      firm_name: chambersData.firm_name || chambersData.firmName || '',
      thesis: chambersData.review_checkpoint?.state?.strategy?.thesis || chambersData.narrative_architecture?.thesis_statement || ''
    };

    const resp = await engineFetch(`${pythonApiUrl}/optimize/matter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(240000)
    });

    if (!resp.ok) {
      const failure=await resp.json().catch(()=>({code:'AI_REVIEW_UNAVAILABLE',error:'No se completó la redacción.'}));
      return NextResponse.json(failure,{status:resp.status});
    }

    const result = await resp.json();

    if (result.success && result.optimized_text) {
      const stableId = matterId || targetMatter.id;
      if (!stableId) return NextResponse.json({error:'Guarda el asunto antes de optimizarlo.'}, {status:409});
      await prisma.$transaction(async tx => {
        // Updating the row acquires a transaction-scoped lock. Read JSON after acquiring it.
        const current = await tx.submission.update({where:{id:submissionId},data:{updatedAt:new Date()}});
        const latest:any = current.chambersData || {};
        const register = Array.isArray(latest.matters) ? latest.matters : submission.matters;
        const before = (chambersData.matters || submission.matters).find((m:any)=>m.id===stableId);
        const now = register.find((m:any)=>m.id===stableId);
        if (!now || !before || JSON.stringify(now) !== JSON.stringify(before)) throw new Error('DRAFT_CONFLICT');
        const updated = register.map((m:any)=>m.id===stableId ? {...m,optimizedText:result.optimized_text,optimized_text:result.optimized_text,status:'Optimized',draft_provenance:{source_hash:draftSourceHash(m),text_hash:stableHash(result.optimized_text.trim()),origin:'generated',strategy_hash:stableHash(chambersData.review_checkpoint?.state?.strategy || {})}} : m);
        await tx.matter.updateMany({where:{id:stableId,submissionId},data:{optimizedText:result.optimized_text,status:'Optimized'}});
        const revision = Number(latest.draft_revision || 0)+1;
        await tx.submission.update({where:{id:submissionId},data:{chambersData:{...latest,matters:updated,draft_revision:revision,approved_artifact:null,release_verdict:{passed:false,status:'needs_review',errors:['Matter edited; review required.']}}}});
        result.revision=revision;
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /optimize/matter] Error:', error);
    return NextResponse.json({ error: error.message === 'DRAFT_CONFLICT' ? 'El asunto cambió durante la optimización. Recarga antes de reintentar.' : error.message || 'Server error' }, { status: error.message === 'DRAFT_CONFLICT' ? 409 : 500 });
  }
}
