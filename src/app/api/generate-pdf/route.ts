import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const submissionId = searchParams.get('id');

    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submission ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let resolvedUserId = user.id;
    if (user.email) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });
      if (existingByEmail) {
        resolvedUserId = existingByEmail.id;
      }
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { matters: true }
    });

    if (!submission || (submission.userId !== user.id && submission.userId !== resolvedUserId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Prepare data for Python
    const metadata = {
      firm_name: 'Your Firm', // TODO: Pull from user profile or submission settings
      practice_area: submission.practiceArea,
      location: submission.guideRegion
    };

    const matters = submission.matters
      .filter(m => m.status === 'AI Optimized' && m.optimizedText)
      .map(m => ({
        name: m.name,
        client: m.client,
        value: m.value,
        lead_partner: m.leadPartner,
        description: m.optimizedText
      }));

    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';

    // 1. Ask Python to generate the report
    const generateRes = await fetch(`${pythonApiUrl}/generate-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: submission.id,
        metadata,
        matters
      })
    });

    if (!generateRes.ok) {
      throw new Error('Failed to generate report in Python backend');
    }

    const generateData = await generateRes.json();

    if (!generateData.success || !generateData.pdf_url) {
      throw new Error('Python backend failed to return a valid PDF path');
    }

    // 2. Ask Python to stream the file back
    const downloadRes = await fetch(`${pythonApiUrl}/download?filepath=${encodeURIComponent(generateData.pdf_url)}`);
    
    if (!downloadRes.ok) {
      throw new Error('Failed to download PDF from Python backend');
    }

    const pdfBuffer = await downloadRes.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="RankPilot_Report_${submission.practiceArea.replace(/\s+/g, '_')}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('Error in PDF generation route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
