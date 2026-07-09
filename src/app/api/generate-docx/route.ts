import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const submissionId = searchParams.get('id');
    const docType = searchParams.get('type') || 'audit'; // 'audit' or 'submission'

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

    const matters = submission.matters.map(m => ({
        name: m.name,
        client: m.client,
        value: m.value,
        lead_partner: m.leadPartner,
        description: m.optimizedText || m.rawNotes
      }));

    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';

    // 1. Ask Python to generate the report
    const generateRes = await fetch(`${pythonApiUrl}/generate-docx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: submission.id,
        metadata,
        matters,
        chambersData: submission.chambersData,
        doc_type: docType
      })
    });

    if (!generateRes.ok) {
      throw new Error('Failed to generate report in Python backend');
    }

    const generateData = await generateRes.json();

    if (!generateData.success || !generateData.docx_url) {
      throw new Error('Python backend failed to return a valid DOCX path');
    }

    // 2. Ask Python to stream the file back
    const downloadRes = await fetch(`${pythonApiUrl}/download?filepath=${encodeURIComponent(generateData.docx_url)}`);
    
    if (!downloadRes.ok) {
      throw new Error('Failed to download DOCX from Python backend');
    }

    const docxBuffer = await downloadRes.arrayBuffer();

    const prefix = docType === 'submission' ? 'Submission_Form' : 'Strategic_Audit';
    
    return new NextResponse(docxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="RankPilot_${prefix}_${submission.practiceArea.replace(/\s+/g, '_')}.docx"`,
      },
    });

  } catch (error: any) {
    console.error('Error in DOCX generation route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
