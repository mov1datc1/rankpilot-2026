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

    const sources = body.sources || context?.sources || [];
    const sourceInput = userInput || submission.documentUrl || (sources.length > 0 ? sources[0].url : '');
    if (!sourceInput && sources.length === 0) {
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
        sources: sources,
        context: {
          directory: submission.targetDirectory,
          jurisdiction: submission.guideRegion,
          practice_area: submission.practiceArea,
          firm_name: context?.firm_name || '',
          sources: sources,
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

    const sanitizePractice = (val?: string) => {
      if (!val) return '';
      const trimmed = val.trim();
      if (trimmed.length > 80 || trimmed.includes('\n') || trimmed.includes('?') || trimmed.includes('SOURCE DOCUMENT') || trimmed.startsWith('===') || trimmed.startsWith('---')) {
        return '';
      }
      return trimmed;
    };

    const cleanExtractedPractice = sanitizePractice(extractedMeta.extracted_practice_area || extractedMeta.practice_area);
    const calibratedPractice = sanitizePractice(extractedMeta.calibrated_practice_area) || sanitizePractice(submission.practiceArea);
    const finalPracticeArea = cleanExtractedPractice || calibratedPractice || 'General Practice';

    // ═══ JUDGE SOL EXTRACTION SANITY & SURGICAL HEALER ═══
    const { judgeSolExtractionAudit } = await import('@/lib/audit/extraction-auditor');
    const extractionAudit = judgeSolExtractionAudit({
      matters: extractedMatters,
      practiceArea: finalPracticeArea,
      firmName: extractedMeta.firm_name || context?.firm_name || ''
    });
    const healedMatters = extractionAudit.healedMatters;

    // Delete any old draft matters for this submission before populating
    await prisma.matter.deleteMany({
      where: { submissionId: submission.id }
    });

    // Create matters in database with surgically cleaned client names and validated confidentiality
    const createdMatters = [];
    for (let idx = 0; idx < healedMatters.length; idx++) {
      const m = healedMatters[idx];
      const isConf = Boolean(m.isConfidential);
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
          isConfidential: isConf,
          otherInfo: m.valueConflict || m.otherInfo || m.press_link || (m.practiceRelevanceRationale ? `[Relevance: ${m.practiceRelevanceScore}% - ${m.primaryDetectedPractice}] ${m.practiceRelevanceRationale}` : null),
          crossBorder: m.crossBorder || '',
          teamMembers: m.teamMembers || m.team_members || '',
          otherFirms: m.otherFirms || '',
          completionDate: m.completionDate || '',
          source: 'builder',
          practiceArea: finalPracticeArea,
          jurisdiction: extractedMeta.location || submission.guideRegion
        }
      });
      createdMatters.push({
        ...created,
        practiceRelevanceScore: m.practiceRelevanceScore,
        practiceClassification: m.practiceClassification,
        primaryDetectedPractice: m.primaryDetectedPractice
      });
    }

    // Merge into chambersData
    const existingChambers = (submission.chambersData as any) || {};
    const updatedChambersData = {
      ...existingChambers,
      judge_sol_extraction_audit: extractionAudit.reviewAudit,
      firm_name: extractedMeta.firm_name || existingChambers.firm_name || '',
      firmName: extractedMeta.firm_name || existingChambers.firmName || '',
      metadata: {
        ...(existingChambers.metadata || {}),
        firm_name: extractedMeta.firm_name || existingChambers.firm_name || '',
        practice_area: finalPracticeArea,
        extracted_practice_area: cleanExtractedPractice,
        calibrated_practice_area: calibratedPractice,
        location: extractedMeta.location || submission.guideRegion
      },
      original_b10: extractedB10 || existingChambers.original_b10 || '',
      enhanced_b7: extractedB10 || existingChambers.enhanced_b7 || '',
      b7: extractedB10 || existingChambers.b7 || '',
      department: extractedDept,
      lawyers: extractedLawyers,
      matters: createdMatters.map((m, idx) => {
        const healedM = healedMatters[idx] || {};
        const isConf = Boolean(m.isConfidential);
        return {
          id: m.id,
          name: m.name,
          title: m.name,
          client: m.client,
          clientDescription: healedM.clientDescription || '',
          value: m.value,
          leadPartner: m.leadPartner,
          lead_partner: m.leadPartner,
          rawNotes: m.rawNotes,
          summary: m.rawNotes,
          isConfidential: isConf,
          confidential: isConf,
          confidentialityStatus: isConf ? 'confidential' : 'publishable',
          confidentialityConfirmed: true,
          publish_status: isConf ? 'non_publishable' : 'publishable',
          publishStatus: isConf ? 'confidential' : 'publishable',
          valueConflict: healedM.valueConflict || '',
          source_label: healedM.source_label || healedM.sourceLabel || '',
          crossBorder: m.crossBorder,
          teamMembers: m.teamMembers,
          team_members: m.teamMembers,
          otherFirms: m.otherFirms,
          completionDate: m.completionDate,
          optimizedText: m.optimizedText || '',
          optimized_text: m.optimizedText || '',
          practiceRelevanceScore: healedM.practiceRelevanceScore ?? 75,
          practiceClassification: healedM.practiceClassification ?? 'core',
          primaryDetectedPractice: healedM.primaryDetectedPractice ?? finalPracticeArea,
          practiceRelevanceRationale: healedM.practiceRelevanceRationale ?? ''
        };
      })
    };

    // Update submission record
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: 'Draft',
        documentUrl: sourceInput.startsWith('http') ? sourceInput : submission.documentUrl,
        practiceArea: finalPracticeArea,
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
