import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionId, documentUrl, text, context } = body;

    const userInput = documentUrl || text || '';
    if (!userInput && !submissionId) {
      return NextResponse.json({ error: 'Missing documentUrl, text, or submissionId' }, { status: 400 });
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

    let submission: any = null;
    if (submissionId) {
      submission = await prisma.submission.findUnique({ where: { id: submissionId } });
      if (!submission || (submission.userId !== user.id && submission.userId !== resolvedUserId)) {
        return NextResponse.json({ error: 'Submission not found or unauthorized' }, { status: 403 });
      }
    } else {
      submission = await prisma.submission.create({
        data: {
          userId: resolvedUserId,
          targetDirectory: context?.directory || 'Chambers',
          practiceArea: context?.practiceArea || 'General',
          guideRegion: context?.jurisdiction || 'Global',
          currentBand: context?.currentBand || 'Unranked',
          status: 'Draft',
          chambersData: context || {}
        }
      });
    }

    const sourceInput = userInput || submission.documentUrl || '';
    if (!sourceInput) {
      return NextResponse.json({ error: 'No source document available to extract' }, { status: 400 });
    }

    // Call Python FastAPI /extract endpoint
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';
    console.log(`[EXTRACT-DOCUMENT] Calling ${pythonApiUrl}/extract for submission ${submission.id}...`);

    const extractResponse = await fetch(`${pythonApiUrl}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_input: sourceInput,
        context: {
          directory: submission.targetDirectory,
          jurisdiction: submission.guideRegion,
          practice_area: submission.practiceArea,
          firm_name: context?.firm_name || '',
          ...context
        }
      })
    });

    if (!extractResponse.ok) {
      const errText = await extractResponse.text();
      console.error(`[EXTRACT-DOCUMENT] Python extraction failed:`, errText);
      return NextResponse.json({
        error: 'El motor de extracción no pudo procesar el documento.',
        details: errText
      }, { status: 500 });
    }

    const extractData = await extractResponse.json();
    if (!extractData.success) {
      return NextResponse.json({
        error: extractData.error || 'Fallo durante la extracción del documento',
        details: extractData.details
      }, { status: 500 });
    }

    const extractedMeta = extractData.metadata || {};
    const extractedB10 = extractData.original_b10 || '';
    const extractedMatters: any[] = extractData.matters || [];
    const extractedDept = extractData.department || {};
    const extractedLawyers = extractData.lawyers || [];

    // Delete any old draft matters for this submission before populating
    await prisma.matter.deleteMany({
      where: { submissionId: submission.id }
    });

    // Create matters in database
    const createdMatters = [];
    for (let idx = 0; idx < extractedMatters.length; idx++) {
      const m = extractedMatters[idx];
      const created = await prisma.matter.create({
        data: {
          submissionId: submission.id,
          userId: resolvedUserId,
          name: m.name || m.title || `Matter ${idx + 1}`,
          client: m.client || '',
          value: m.value || '',
          leadPartner: m.leadPartner || m.lead_partner || '',
          rawNotes: m.rawNotes || m.summary || '',
          optimizedText: m.optimizedText || '',
          status: 'Draft',
          isConfidential: Boolean(m.isConfidential),
          crossBorder: m.crossBorder || '',
          teamMembers: m.teamMembers || m.team_members || '',
          otherFirms: m.otherFirms || '',
          completionDate: m.completionDate || '',
          source: 'builder',
          practiceArea: extractedMeta.practice_area || submission.practiceArea,
          jurisdiction: extractedMeta.location || submission.guideRegion
        }
      });
      createdMatters.push(created);
    }

    // Merge into chambersData
    const existingChambers = (submission.chambersData as any) || {};
    const updatedChambersData = {
      ...existingChambers,
      firm_name: extractedMeta.firm_name || existingChambers.firm_name || '',
      firmName: extractedMeta.firm_name || existingChambers.firmName || '',
      metadata: {
        ...(existingChambers.metadata || {}),
        firm_name: extractedMeta.firm_name || '',
        practice_area: extractedMeta.practice_area || submission.practiceArea,
        location: extractedMeta.location || submission.guideRegion
      },
      original_b10: extractedB10 || existingChambers.original_b10 || '',
      enhanced_b7: extractedB10 || existingChambers.enhanced_b7 || '',
      b7: extractedB10 || existingChambers.b7 || '',
      department: extractedDept,
      lawyers: extractedLawyers,
      matters: createdMatters.map(m => ({
        id: m.id,
        name: m.name,
        title: m.name,
        client: m.client,
        value: m.value,
        leadPartner: m.leadPartner,
        lead_partner: m.leadPartner,
        rawNotes: m.rawNotes,
        summary: m.rawNotes,
        isConfidential: m.isConfidential,
        publish_status: m.isConfidential ? 'non_publishable' : 'publishable',
        crossBorder: m.crossBorder,
        teamMembers: m.teamMembers,
        team_members: m.teamMembers,
        otherFirms: m.otherFirms,
        completionDate: m.completionDate,
        optimizedText: m.optimizedText || '',
        optimized_text: m.optimizedText || ''
      }))
    };

    // Update submission record
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: 'Draft',
        documentUrl: sourceInput.startsWith('http') ? sourceInput : submission.documentUrl,
        practiceArea: extractedMeta.practice_area || submission.practiceArea,
        chambersData: updatedChambersData,
        updatedAt: new Date()
      }
    });

    console.log(`[EXTRACT-DOCUMENT] Successfully extracted ${createdMatters.length} matters for submission ${submission.id}`);

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      mattersCount: createdMatters.length,
      firmName: extractedMeta.firm_name,
      practiceArea: extractedMeta.practice_area
    });

  } catch (error: any) {
    console.error('[EXTRACT-DOCUMENT ERROR]:', error);
    return NextResponse.json({
      error: 'Error procesando la extracción del documento',
      details: error.message
    }, { status: 500 });
  }
}
