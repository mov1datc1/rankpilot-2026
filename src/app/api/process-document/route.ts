import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { submissionId, documentUrl } = await request.json();

    if (!submissionId || !documentUrl) {
      return NextResponse.json({ error: 'Missing submissionId or documentUrl' }, { status: 400 });
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

    const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission || (submission.userId !== user.id && submission.userId !== resolvedUserId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Call Python backend
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';
    const pyResponse = await fetch(`${pythonApiUrl}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_input: documentUrl,
        thread_id: submissionId,
        is_file: true,
        context: {
          directory: submission.targetDirectory,
          jurisdiction: submission.guideRegion,
          practice_area: submission.practiceArea,
          current_status: submission.currentBand
        }
      })
    });

    const pyData = await pyResponse.json();

    if (!pyResponse.ok) {
      const errorDetail = pyData.traceback || pyData.error || pyResponse.statusText;
      console.error(`Python API Error Traceback:\n${errorDetail}`);
      throw new Error(`Python API Error: ${pyData.error || pyResponse.statusText} - See Server Logs for Traceback`);
    }
    
    // El motor Python debe retornar la data estructurada. Vamos a parsear la respuesta.
    // Si langgraph devuelve el output, estará en pyData.data.response o pyData directly
    const extractedData = pyData.metadata || pyData.data?.metadata;
    const extractedMatters = pyData.matters || pyData.data?.matters;
    const analysisData = pyData.data?.analysis;
    const strategicContext = pyData.data?.strategic_context;

    // Si encontramos matters, los guardamos en la base de datos
    let createdCount = 0;
    if (extractedMatters && Array.isArray(extractedMatters)) {
      for (const m of extractedMatters) {
        await prisma.matter.create({
          data: {
            submissionId,
            name: m.name || m.title || 'Extracted Matter',
            client: m.client || 'Unknown Client',
            value: m.value || 'N/A',
            leadPartner: m.lead_partner || m.partner || 'Unknown',
            rawNotes: [m.summary, m.significance].filter(Boolean).join('\n\n') || m.description || m.notes || 'No description extracted',
            status: 'Draft'
          }
        });
        createdCount++;
      }
    }

    // Actualizamos el submission con metadata extraída y análisis estratégico
    if (extractedData || analysisData) {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { 
          chambersData: {
            metadata: extractedData,
            analysis: analysisData,
            strategicContext: strategicContext
          }
        }
      });
    }

    return NextResponse.json({ success: true, createdCount, raw: pyData });
  } catch (error: any) {
    console.error('Error processing document in Next API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
