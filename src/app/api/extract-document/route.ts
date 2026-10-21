import { selectedScope, scopeIssues } from '@/lib/audit/analysis-scope';
import { engineFetch } from '@/lib/editorial/engine';
import { processingFeedback } from '@/lib/ux/processing-feedback';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionId, documentUrl, text, context } = body;
    const confidentialityOnly = body.mode === 'confidentiality_review';
    const appendSources = body.mode === 'supplement';
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
    if (!submissionId) {
      const issues=scopeIssues(selectedScope({...context,guideRegion:context?.jurisdiction}));
      if(issues.length) return NextResponse.json({code:'SCOPE_REQUIRED',error:issues.map(i=>i.message).join(' '),issues},{status:422});
      if(!String(context?.guideRegion || '').trim()) return NextResponse.json({code:'SCOPE_REQUIRED',error:'Selecciona la guía/región antes de continuar.'},{status:422});
    }
    if (submissionId) {
      submission = await prisma.submission.findUnique({ where: { id: submissionId } });
      if (!submission || (submission.userId !== user.id && submission.userId !== resolvedUserId)) {
        return NextResponse.json({ error: 'Submission not found or unauthorized' }, { status: 403 });
      }
    } else {
      submission = await prisma.submission.create({
        data: {
          userId: resolvedUserId,
          targetDirectory: context.directory,
          practiceArea: context.practiceArea || context.practice_area,
          guideRegion: context.jurisdiction,
          currentBand: context?.currentBand || '',
          status: 'Draft',
          chambersData: context || {}
        }
      });
    }

    const selected=selectedScope({ ...submission, modality: context?.modality || (submission.chambersData as any)?.modality });
    const missingScope=scopeIssues(selected, [], context?.modality || selected.modality);
    if(missingScope.length) return NextResponse.json({code:'SCOPE_REQUIRED',error:missingScope.map(i=>i.message).join(' '),issues:missingScope},{status:422});

    const sources = confidentialityOnly ? ((submission.chambersData as any)?.sources || []) : body.sources || context?.sources || [];
    const sourceInput = (confidentialityOnly ? '' : userInput) || submission.documentUrl || (sources.length > 0 ? sources[0].url : '');
    if (!sourceInput && sources.length === 0) {
      return NextResponse.json({ error: 'No source document available to extract' }, { status: 400 });
    }

    // Call Python FastAPI /extract endpoint
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';
    console.log(`[EXTRACT-DOCUMENT] Calling ${pythonApiUrl}/extract for submission ${submission.id}...`);

    const extractResponse = await engineFetch(`${pythonApiUrl}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_input: sourceInput,
        sources: sources,
        context: {
          ...context,
          reconcile_source: !confidentialityOnly,
          guide_region: submission.chambersData?.guideRegion || '',
          guideRegion: submission.chambersData?.guideRegion || '',
          directory: submission.targetDirectory,
          jurisdiction: submission.guideRegion,
          practice_area: submission.practiceArea,
          firm_name: context?.firm_name || '',
          sources: sources
        }
      })
    });

    if (!extractResponse.ok) {
      const failure = await extractResponse.json().catch(()=>({}));
      const status = extractResponse.status >= 400 && extractResponse.status < 500 ? extractResponse.status : 502;
      const code = failure.code || (status===409?'DRAFT_CONFLICT':'EXTRACTION_UNAVAILABLE');
      return NextResponse.json({code,error:processingFeedback({...failure,code},status,'extract'),source_errors:failure.source_errors || [],issues:failure.issues || [],usage:failure.usage || null,retryable:failure.retryable ?? false},{status});
    }

    const extractData = await extractResponse.json();
    if (!extractData.success) {
      return NextResponse.json({
        error: extractData.error || 'Fallo durante la extracción del documento',
        details: extractData.details
      }, { status: 500 });
    }

    const scopeConflicts=scopeIssues(selected,extractData.source_reports || [], context?.modality || selected.modality);
    if(scopeConflicts.length) return NextResponse.json({code:'SCOPE_CONFLICT',error:scopeConflicts.map(i=>i.message).join(' '),issues:scopeConflicts},{status:422});
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
    const reports=extractData.source_reports;
    if(!Array.isArray(reports) || !reports.length || reports.some((r:any)=>r.source_reconciliation?.version!=='source-reconciliation-v1' || !['reviewed','fallback_deterministic'].includes(r.source_reconciliation?.status) || !(r.source_reconciliation.source_characters>0) || r.source_reconciliation.covered_characters!==r.source_reconciliation.source_characters || r.source_reconciliation.matters_reviewed!==r.matter_count)) {
      return NextResponse.json({code:'EXTRACTION_VALIDATION_REQUIRED',error:processingFeedback({code:'EXTRACTION_VALIDATION_REQUIRED'},422)},{status:422});
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
    const calibratedPractice = sanitizePractice(submission.practiceArea);
    const finalPracticeArea = submission.practiceArea;

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
    if(!appendSources) await tx.matter.deleteMany({
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
          jurisdiction: submission.guideRegion
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
        location: submission.guideRegion,
        extracted_location: extractedMeta.location || ''
      },
      original_c2: extractData.original_c2 || '',
      sources,
      source_reports: extractData.source_reports || [],
      source_fact_review: {
        firm_name: extractedMeta.firm_name || '', practice_area: cleanExtractedPractice, location: extractedMeta.location || '',
        original_b10: extractedB10, original_c2: extractData.original_c2 || '',
        extractionResolutions: {} as Record<string,any>,
        extraction_issues: (extractData.source_reports || []).flatMap((r:any)=>r.administration_issues || []),
        extraction_evidence: (extractData.source_reports || []).map((r:any)=>({source:r.source,fields:r.administration_evidence || {}}))
      },
      ingestion_quality: extractData.ingestion_quality || null,
      analysis_scope: selected,
      modality: context?.modality || existingChambers.modality || selected.modality || '',
      draft_revision: Number(existingChambers.draft_revision || 0) + 1,
      original_b10: extractedB10,
      enhanced_b7: extractedB10,
      b7: extractedB10,
      department: extractedDept,
      departmentName: extractData.filing_details?.departmentName ?? '',
      numPartners: (extractData.filing_details?.numPartners !== undefined && extractData.filing_details?.numPartners !== '')
        ? extractData.filing_details.numPartners
        : (extractedLawyers.filter((l: any) => l.isPartner || l.role === 'Partner').length || ''),
      numLawyers: (extractData.filing_details?.numLawyers !== undefined && extractData.filing_details?.numLawyers !== '')
        ? extractData.filing_details.numLawyers
        : (extractedLawyers.filter((l: any) => !l.isPartner && l.role !== 'Partner').length || ''),
      contacts: extractData.filing_details?.contacts || [],
      departmentHeads: extractData.filing_details?.departmentHeads || (extractData.filing_field_status?.departmentHeads === 'conflicting' ? [] : extractedDept.department_heads || []),
      filing_evidence: extractData.filing_evidence || {},
      filing_field_status: extractData.filing_field_status || {},
      filing_reviewed: false,
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
          extraction_evidence: healedM.extraction_evidence || {},
          extraction_issues: healedM.extraction_issues || [],
          extraction_review_version: healedM.extraction_review_version || '',
          original_code_extraction: healedM.original_code_extraction || {},
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

    if(appendSources) {
      // Add evidence without replacing prior IDs, decisions or human prose.
      const original=existingChambers.matters || await tx.matter.findMany({where:{submissionId:submission.id,id:{notIn:createdMatters.map(m=>m.id)}}});
      updatedChambersData.matters=[...original,...updatedChambersData.matters];
      updatedChambersData.sources=[...(existingChambers.sources || []),...sources];
      updatedChambersData.source_reports=[...(existingChambers.source_reports || []),...(extractData.source_reports || [])];
      if(existingChambers.source_fact_review) {
        const previous=existingChambers.source_fact_review;
        const incoming=updatedChambersData.source_fact_review;
        const resolutions={...(previous.extractionResolutions || {})};
        for(const issue of incoming.extraction_issues) delete resolutions[issue.field];
        updatedChambersData.source_fact_review={...incoming,...previous,
          extraction_issues:[...(previous.extraction_issues || []),...incoming.extraction_issues],
          extraction_evidence:[...(previous.extraction_evidence || []),...incoming.extraction_evidence],
          extractionResolutions:resolutions};
      }
      for(const key of ['original_b10','enhanced_b7','b7','confirmed_source_b10','original_c2','department','lawyers']) {
        if(existingChambers[key]!==undefined) (updatedChambersData as any)[key]=existingChambers[key];
      }
    }

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
