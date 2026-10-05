import { NextRequest, NextResponse } from 'next/server';
import { needsInputReview } from '@/lib/audit/input-review';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
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
      firm_name: chambersData.firm_name || chambersData.firmName || '',
      thesis: chambersData.narrative_architecture?.thesis_statement || ''
    };

    const resp = await fetch(`${pythonApiUrl}/optimize/matter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json({ error: 'Engine matter optimization failed', details: errText }, { status: resp.status });
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
        const updated = register.map((m:any)=>m.id===stableId ? {...m,optimizedText:result.optimized_text,optimized_text:result.optimized_text,status:'Optimized'} : m);
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
