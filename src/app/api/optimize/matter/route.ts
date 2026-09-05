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

    // Find matter from DB or inline
    let targetMatter = inlineMatter;
    if (matterId) {
      const dbMatter = submission.matters.find(m => m.id === matterId);
      if (dbMatter) {
        targetMatter = {
          ...dbMatter,
          ...inlineMatter
        };
      }
    }

    if (!targetMatter) {
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 });
    }

    const chambersData = (submission.chambersData as any) || {};
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
      signal: AbortSignal.timeout(30000)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json({ error: 'Engine matter optimization failed', details: errText }, { status: resp.status });
    }

    const result = await resp.json();

    if (result.success && result.optimized_text) {
      // 1. Update in prisma Matter table if matterId exists
      if (matterId) {
        await prisma.matter.update({
          where: { id: matterId },
          data: {
            optimizedText: result.optimized_text,
            status: 'Approved'
          }
        });
      }

      // 2. Update inside submission.chambersData.matters array
      const currentChambersMatters = chambersData.matters || [];
      const updatedChambersMatters = currentChambersMatters.map((m: any) => {
        if ((matterId && m.id === matterId) || (m.client && m.client === targetMatter.client)) {
          return {
            ...m,
            optimized_text: result.optimized_text,
            optimizedText: result.optimized_text
          };
        }
        return m;
      });

      const updatedChambersData = {
        ...chambersData,
        matters: updatedChambersMatters
      };

      await prisma.submission.update({
        where: { id: submissionId },
        data: { chambersData: updatedChambersData }
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /optimize/matter] Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
