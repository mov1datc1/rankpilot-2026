import { NextRequest, NextResponse } from 'next/server';
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
    const { submissionId, original_b10, directive } = body;

    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId }
    });

    if (!submission || (submission.userId !== user.id && submission.userId !== resolvedUserId)) {
      return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 403 });
    }

    const chambersData = (submission.chambersData as any) || {};
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';

    const payload = {
      original_b10: chambersData.confirmed_source_b10 ?? chambersData.original_b10 ?? '',
      practice_area: submission.practiceArea || '',
      firm_name: chambersData.firm_name || chambersData.firmName || '',
      directive: directive || '',
      strategic_context: chambersData.strategicContext || {},
      narrative_architecture: chambersData.narrative_architecture || {}
    };

    if(!payload.original_b10.trim()) return NextResponse.json({code:'SOURCE_REQUIRED',error:'Falta la descripción de origen del departamento.'},{status:422});
    const resp = await fetch(`${pythonApiUrl}/optimize/b10`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json({ error: 'Engine optimization failed', details: errText }, { status: resp.status });
    }

    const result = await resp.json();

    if (result.success && result.enhanced_b10) {
      await prisma.$transaction(async tx => {
        const current = await tx.submission.update({where:{id:submissionId},data:{updatedAt:new Date()}});
        const latest:any = current.chambersData || {};
        if ((latest.enhanced_b7 || '') !== (chambersData.enhanced_b7 || '') || (latest.original_b10 || '') !== (chambersData.original_b10 || '') || (latest.confirmed_source_b10 || '') !== (chambersData.confirmed_source_b10 || '')) throw new Error('DRAFT_CONFLICT');
        const revision=Number(latest.draft_revision || 0)+1;
        await tx.submission.update({where:{id:submissionId},data:{chambersData:{...latest,b10_optimization:{source:payload.original_b10.trim(),text:result.enhanced_b10.trim()},enhanced_b7:result.enhanced_b10,enhanced_b10:result.enhanced_b10,b7:result.enhanced_b10,draft_revision:revision,approved_artifact:null,release_verdict:{passed:false,status:'needs_review',errors:['Department narrative edited; review required.']}}}});
        result.revision=revision;
        result.b10_optimization={source:payload.original_b10.trim(),text:result.enhanced_b10.trim()};
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /optimize/b10] Error:', error);
    return NextResponse.json({ error: error.message === 'DRAFT_CONFLICT' ? 'La narrativa cambió durante la optimización. Recarga y reintenta.' : error.message || 'Server error' }, { status: error.message === 'DRAFT_CONFLICT' ? 409 : 500 });
  }
}
