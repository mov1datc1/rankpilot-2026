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
      original_b10: original_b10 || chambersData.original_b10 || chambersData.b7 || chambersData.departmentDesc || '',
      practice_area: submission.practiceArea || '',
      firm_name: chambersData.firm_name || chambersData.firmName || '',
      directive: directive || '',
      strategic_context: chambersData.strategicContext || {},
      narrative_architecture: chambersData.narrative_architecture || {}
    };

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
      const updatedChambersData = {
        ...chambersData,
        enhanced_b7: result.enhanced_b10,
        enhanced_b10: result.enhanced_b10,
        b7: result.enhanced_b10
      };

      await prisma.submission.update({
        where: { id: submissionId },
        data: { chambersData: updatedChambersData }
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /optimize/b10] Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
