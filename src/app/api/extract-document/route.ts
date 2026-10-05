import { processingFeedback } from '@/lib/ux/processing-feedback';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionId, documentUrl, text, context } = body;
    const confidentialityOnly = body.mode === 'confidentiality_review';
    if (confidentialityOnly && !submissionId) return NextResponse.json({error: 'Submission requerido.'}, {status: 400});

    const userInput = documentUrl || text || '';
    if (!userInput && !submissionId && !body.sources?.length) {
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
          currentBand: context?.currentBand || '',
          status: 'Draft',
          chambersData: context || {}
        }
      });
    }

    const sources = confidentialityOnly ? ((submission.chambersData as any)?.sources || []) : body.sources || context?.sources || [];
    const sourceInput = (confidentialityOnly ? '' : userInput) || submission.documentUrl || (sources.length > 0 ? sources[0].url : '');
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
      const failure = await extractResponse.json().catch(()=>({}));
      const status = extractResponse.status >= 400 && extractResponse.status < 500 ? extractResponse.status : 502;
      const code = failure.code || (status===409?'DRAFT_CONFLICT':'EXTRACTION_UNAVAILABLE');
      return NextResponse.json({code,error:processingFeedback({...failure,code},status,'extract'),source_errors:failure.source_errors || []},{status});
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
    if (!Array.isArray(extractedMatters) || extractedMatters.length === 0) {
      return NextResponse.json({ error: 'No se identificaron asuntos. Tu borrador anterior se conserva.', code: 'NO_LEGAL_MATTERS' }, { status: 422 });
    }
    if (extractData.partial || extractData.source_errors?.length) {
      return NextResponse.json({ error: 'No se pudieron leer todas las fuentes. Tu borrador se conserva; corrige los archivos indicados y reintenta.', code: 'PARTIAL_EXTRACTION', source_errors: extractData.source_errors }, { status: 422 });
    }
    if (extractData.ingestion_quality?.status !== 'ready_for_review' || extractData.ingestion_quality?.matters_found !== extractedMatters.length) {
      return NextResponse.json({code: 'EXTRACTION_VALIDATION_REQUIRED', error: processingFeedback({code: 'EXTRACTION_VALIDATION_REQUIRED'}, 422)}, {status: 422});
    }
    const extractedDept = extractData.department || {};
    // Read-only reconciliation: the existing wizard saves selected changes with revision checks.
    if (confidentialityOnly) {
      if (extractData.confidentiality_contract_version !== 1) return NextResponse.json({error: 'El motor de confidencialidad se está actualizando. Reintenta en unos minutos.'}, {status: 503});
      return NextResponse.json({success: true, matters: extractedMatters});
    }
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
    const finalPracticeArea = calibratedPractice || cleanExtractedPractice || 'General Practice';

    // ═══ JUDGE SOL EXTRACTION SANITY & SURGICAL HEALER ═══
    const { judgeSolExtractionAudit } = await import('@/lib/audit/extraction-auditor');
    const extractionAudit = judgeSolExtractionAudit({
      matters: extractedMatters,
      practiceArea: finalPracticeArea,
      firmName: extractedMeta.firm_name || context?.firm_name || ''
    });
    const healedMatters = extractionAudit.healedMatters;

    const createdMatters = await prisma.$transaction(async (tx) => {
    // Acquire the submission revision before replacing any existing rows.
    const locked = await tx.submission.updateMany({
      where: { id: submission.id, updatedAt: submission.updatedAt },
      data: { updatedAt: new Date() }
    });
    if (locked.count !== 1) throw new Error('DRAFT_CONFLICT: El borrador cambió durante la extracción. Recarga y reintenta.');
    // Replace the register atomically only after complete successful extraction.
    await tx.matter.deleteMany({
      where: { submissionId: submission.id }
    });

    // Create matters in database with surgically cleaned client names and validated confidentiality
    const createdMatters = [];
    for (let idx = 0; idx < healedMatters.length; idx++) {
      const m = healedMatters[idx];
      const isConf = m.confidentialityConfirmed === false || m.publish_status === 'confirmation_required' || m.confidentialityStatus === 'confirmation_required' || Boolean(m.isConfidential);
      const created = await tx.matter.create({
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
          otherInfo: m.press_link || (m.otherInfo && !m.otherInfo.startsWith('[Relevance:') ? m.otherInfo : null),
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
      release_verdict: { passed: false, status: 'needs_review', errors: ['Source evidence changed; validation required.'] },
      canonical_matter_selection: null,
      cloned_docx_b64: null,
      approved_artifact: null,
      confirmed_source_b10: null,
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
      original_c2: extractData.original_c2 || '',
      sources,
      source_reports: extractData.source_reports || [],
      ingestion_quality: extractData.ingestion_quality || null,
      draft_revision: Number(existingChambers.draft_revision || 0) + 1,
      original_b10: extractedB10,
      enhanced_b7: extractedB10,
      b7: extractedB10,
      department: extractedDept,
      lawyers: extractedLawyers,
      matters: createdMatters.map((m, idx) => {
        const healedM = healedMatters[idx] || {};
        const isConf = Boolean(m.isConfidential);
        const unconfirmed = healedM.confidentialityConfirmed === false || healedM.publish_status === 'confirmation_required' || healedM.confidentialityStatus === 'confirmation_required';
        return {
          id: m.id,
          name: m.name,
          title: m.name,
          client: m.client,
          source_document: healedM.source_document || '',
          clientDescription: healedM.clientDescription || '',
          value: m.value,
          leadPartner: m.leadPartner,
          lead_partner: m.leadPartner,
          rawNotes: m.rawNotes,
          summary: m.rawNotes,
          isConfidential: isConf,
          confidential: isConf,
          confidentialityStatus: unconfirmed ? 'confirmation_required' : (isConf ? 'confidential' : 'publishable'),
          confidentialityConfirmed: !unconfirmed,
          publish_status: unconfirmed ? 'confirmation_required' : (isConf ? 'non_publishable' : 'publishable'),
          publishStatus: isConf ? 'confidential' : 'publishable',
          valueConflict: healedM.valueConflict || '',
          source_label: healedM.source_label || healedM.sourceLabel || '',
          source_excerpt: healedM.source_excerpt || '',
          confidentialityEvidence: healedM.confidentialityEvidence || null,
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
    await tx.submission.update({
      where: { id: submission.id },
      data: {
        status: 'Draft',
        documentUrl: sourceInput.startsWith('http') ? sourceInput : submission.documentUrl,
        practiceArea: finalPracticeArea,
        chambersData: updatedChambersData,
        updatedAt: new Date()
      }
    });

    return createdMatters;
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
    }, { status: String(error.message).startsWith('DRAFT_CONFLICT') ? 409 : 500 });
  }
}
