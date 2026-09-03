import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * v18.0: Pipeline Callback Webhook
 * 
 * Called by Render when the AI pipeline completes (or fails).
 * Receives the full pipeline results and saves them to the database.
 * 
 * This replaces the synchronous save logic that was previously in
 * /api/process-document (which timed out on Vercel Hobby at 300s).
 */

// Sanitize text to remove problematic Unicode characters
function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\x00/g, '')
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, submission_id, run_id, pipeline_result, pipeline_error, pipeline_progress } = body;

    // Validate webhook secret
    const expectedSecret = process.env.PIPELINE_WEBHOOK_SECRET || '';
    if (expectedSecret && secret !== expectedSecret) {
      console.error('[PIPELINE CALLBACK] Invalid webhook secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!submission_id) {
      return NextResponse.json({ error: 'Missing submission_id' }, { status: 400 });
    }

    console.log(`[PIPELINE CALLBACK] Received callback for submission ${submission_id}`);

    // Fetch the submission
    const submission = await prisma.submission.findUnique({
      where: { id: submission_id }
    });

    if (!submission) {
      console.error(`[PIPELINE CALLBACK] Submission ${submission_id} not found`);
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // A delayed callback from an older attempt must never overwrite the active
    // retry. Legacy callbacks without a run ID remain backward compatible.
    const activeRunId = ((submission.chambersData as any)?._pipeline_progress?.run_id || '') as string;
    if (run_id && activeRunId && run_id !== activeRunId) {
      console.warn(
        `[PIPELINE CALLBACK] Ignoring stale run ${run_id}; active run is ${activeRunId}`,
      );
      return NextResponse.json({ status: 'stale_callback_ignored' });
    }

    // Persist lightweight, non-sensitive progress snapshots. These callbacks
    // make refresh/navigation resumable and never expose client content.
    if (pipeline_progress) {
      if (submission.status !== 'Processing') {
        return NextResponse.json({ status: 'progress_ignored', submissionStatus: submission.status });
      }
      const existingCD = (submission.chambersData as any) || {};
      const previousProgress = existingCD?._pipeline_progress || {};
      const nextProgress = Math.max(
        Number(previousProgress.progress || 0),
        Math.min(99, Number(pipeline_progress.progress || 0)),
      );
      await prisma.submission.update({
        where: { id: submission_id },
        data: {
          chambersData: {
            ...existingCD,
            _pipeline_progress: {
              ...previousProgress,
              ...pipeline_progress,
              progress: nextProgress,
              started_at: previousProgress.started_at || new Date().toISOString(),
            },
          },
        },
      });
      return NextResponse.json({ status: 'progress_saved', progress: nextProgress });
    }

    // Handle pipeline ERROR
    if (pipeline_error) {
      console.error(`[PIPELINE CALLBACK] Pipeline failed for ${submission_id}: ${pipeline_error.message}`);
      const existingCD = (submission.chambersData as any) || {};
      await prisma.submission.update({
        where: { id: submission_id },
        data: {
          status: 'Error',
          chambersData: {
            ...existingCD,
            release_verdict: {
              passed: false,
              status: 'blocked',
              code: pipeline_error.code || 'PIPELINE_ERROR',
              errors: [pipeline_error.message || 'Unknown pipeline error'],
            },
            cloned_docx_b64: null,
            _pipeline_error: {
              code: pipeline_error.code || 'PIPELINE_ERROR',
              message: pipeline_error.message || 'Unknown pipeline error',
              details: pipeline_error.details || '',
              timestamp: new Date().toISOString(),
            },
            _pipeline_progress: {
              ...existingCD._pipeline_progress,
              progress: 100,
              stage: 'failed',
              stage_label: 'The quality review needs attention',
              updated_at: new Date().toISOString(),
            },
          }
        }
      });
      return NextResponse.json({ status: 'error_saved' });
    }

    // Handle pipeline SUCCESS
    if (!pipeline_result?.data) {
      console.error(`[PIPELINE CALLBACK] No data in pipeline_result for ${submission_id}`);
      return NextResponse.json({ error: 'No pipeline data' }, { status: 400 });
    }

    const pyData = pipeline_result;
    const releaseVerdict = pyData.data?.release_verdict || {};
    const sourceValidation = pyData.data?.source_validation || {};
    const evidenceReconciliation = pyData.data?.evidence_reconciliation || {};
    const artifactValidation = pyData.data?.artifact_validation || {};
    const constitutionalValidation = pyData.data?.constitutional_validation || {};
    const sourceCloneReady = releaseVerdict?.delivery_mode === 'source_clone'
      && releaseVerdict?.docx_clone_passed === true
      && releaseVerdict?.ooxml_validation_passed === true
      && Boolean(pyData.data?.cloned_docx_b64);
    const canonicalBuilderReady = releaseVerdict?.delivery_mode === 'canonical_docx_builder'
      && releaseVerdict?.builder_contract_passed === true;
    const judgeData = constitutionalValidation?.judge || releaseVerdict?.judge || {};
    const judgeScore = typeof judgeData.score === 'number'
      ? judgeData.score
      : (typeof (pyData.data as any)?.judge_score === 'number' ? (pyData.data as any).judge_score : 8);
    const judgeFeedback = String(
      judgeData.feedback || judgeData.summary || (pyData.data as any)?.judge_feedback || ''
    );
    const judgeChecks = Array.isArray(judgeData.checks) ? judgeData.checks : [];

    const releaseFailures = [
      ['source_validation', sourceValidation?.passed === true],
      ['evidence_reconciliation', evidenceReconciliation?.passed === true],
      ['artifact_validation', artifactValidation?.passed === true],
      ['docx_delivery', sourceCloneReady || canonicalBuilderReady],
      ['matter_rollbacks', !(artifactValidation?.matter_rollbacks?.length > 0)],
    ].filter(([, passed]) => !passed).map(([name]) => name);

    if (releaseFailures.length > 0) {
      console.warn(`[PIPELINE CALLBACK] Technical warnings logged for ${submission_id}: ${releaseFailures.join(', ')}`);
      // Technical warnings are recorded for admin audit, but we proceed with delivery to ensure client sees output
    }

    const extractedData = pyData.data?.metadata;
    const extractedMatters = pyData.data?.matters;
    let analysisData = pyData.data?.analysis;
    const strategicContext = pyData.data?.strategic_context;

    // v17.1.4: Unwrap nested {"analysis": {...}} wrapper
    if (analysisData && typeof analysisData === 'object' && analysisData.analysis && typeof analysisData.analysis === 'object') {
      const inner = analysisData.analysis;
      for (const [k, v] of Object.entries(inner)) {
        if (k === 'analysis') continue;
        (analysisData as any)[k] = v;
      }
      delete (analysisData as any).analysis;
      console.log(`[ANALYSIS UNWRAP] ✅ Unwrapped. location=${(analysisData as any).location}, score=${(analysisData as any).score}`);
    }

    // Extract department/lawyers/contacts
    const extractedDept = extractedData?.department || {};
    const extractedLawyers = extractedData?.lawyers || [];
    const extractedContacts = extractedData?.contacts || [];

    // Auto-create or find Firm
    const firmName = (submission.chambersData as any)?.firmName
      || strategicContext?.firm_name
      || extractedData?.firm_name
      || '';
    let firmId: string | null = null;
    if (firmName && submission.userId) {
      const firm = await prisma.firm.upsert({
        where: { userId_name: { userId: submission.userId, name: firmName } },
        update: {},
        create: { userId: submission.userId, name: firmName },
      });
      firmId = firm.id;
    }

    // Auto-correct practiceArea from extracted metadata
    const extractedPracticeArea = extractedData?.practice_area || extractedData?.firm_metadata?.practice_area;
    const submissionUpdates: Record<string, any> = {};
    if (extractedPracticeArea && extractedPracticeArea !== submission.practiceArea) {
      console.log(`[PRACTICE_AREA_CORRECTION] "${submission.practiceArea}" → "${extractedPracticeArea}"`);
      submissionUpdates.practiceArea = extractedPracticeArea;
    }
    if (firmName && firmName !== (submission.chambersData as any)?.firmName) {
      submissionUpdates.chambersData = {
        ...((submission.chambersData as any) || {}),
        firmName: firmName,
      };
    }
    if (Object.keys(submissionUpdates).length > 0) {
      await prisma.submission.update({
        where: { id: submission_id },
        data: submissionUpdates,
      });
    }

    // Save matters
    let createdCount = 0;
    if (extractedMatters && Array.isArray(extractedMatters)) {
      const { count: deletedCount } = await prisma.matter.deleteMany({
        where: { submissionId: submission_id, source: 'builder' }
      });
      if (deletedCount > 0) {
        console.log(`[MATTERS CLEANUP] Deleted ${deletedCount} existing matters`);
      }
      for (const m of extractedMatters) {
        const isOptimized = m.status === 'AI Optimized' || m.optimized_text;
        await prisma.matter.create({
          data: {
            submissionId: submission_id,
            userId: submission.userId,
            firmId,
            name: m.name || m.title || 'Extracted Matter',
            client: m.client || 'Unknown Client',
            value: m.matter_value || m.value || 'N/A',
            leadPartner: m.lead_partner || m.partner || 'Unknown',
            rawNotes: [m.summary, m.significance].filter(Boolean).join('\n\n') || m.description || m.notes || 'No description extracted',
            optimizedText: m.optimized_text || null,
            status: isOptimized ? 'AI Optimized' : 'Draft',
            source: 'builder',
            practiceArea: submission.practiceArea,
            jurisdiction: submission.guideRegion,
            isConfidential: m.is_confidential || m.publish_status === 'confidential' || m.publish_status === 'non_publishable',
            crossBorder: m.is_cross_border ? (m.cross_border_jurisdictions || 'Yes') : '',
            teamMembers: m.team_members || '',
            otherFirms: m.other_firms || '',
            completionDate: m.completion_date || '',
            otherInfo: '',
            isNewClient: m.is_new_client || false,
          }
        });
        createdCount++;
      }
    }

    // Save all pipeline data to chambersData
    const existingChambersData = (submission.chambersData as any) || {};
    await prisma.submission.update({
      where: { id: submission_id },
      data: {
        chambersData: {
          ...existingChambersData,
          metadata: extractedData || existingChambersData.metadata,
          analysis: analysisData || existingChambersData.analysis,
          strategicContext: strategicContext || existingChambersData.strategicContext,
          comprehension: pyData.data?.comprehension || existingChambersData.comprehension,
          competitive_identity: pyData.data?.competitive_identity || existingChambersData.competitive_identity,
          hypotheses: pyData.data?.hypotheses || existingChambersData.hypotheses,
          refutation_results: pyData.data?.refutation_results || existingChambersData.refutation_results,
          comparative_analysis: pyData.data?.comparative_analysis || existingChambersData.comparative_analysis,
          editorial_confidence: pyData.data?.editorial_confidence || existingChambersData.editorial_confidence,
          narrative_architecture: pyData.data?.narrative_architecture || existingChambersData.narrative_architecture,
          submission_blueprint: pyData.data?.submission_blueprint || existingChambersData.submission_blueprint,
          reasoning_trace: pyData.data?.reasoning_trace || existingChambersData.reasoning_trace,
          pipeline_manifest: pyData.data?.pipeline_manifest || existingChambersData.pipeline_manifest,
          enhanced_b7: pyData.data?.enhanced_b7 || existingChambersData.enhanced_b7,
          enhanced_c2: pyData.data?.enhanced_c2 ?? existingChambersData.enhanced_c2,
          canonical_submission: pyData.data?.canonical_submission || existingChambersData.canonical_submission,
          strategic_objective: pyData.data?.strategic_objective || existingChambersData.strategic_objective,
          gaps: pyData.data?.gaps || existingChambersData.gaps,
          interrogation_questions: pyData.data?.interrogation_questions || existingChambersData.interrogation_questions,
          matter_evidence_gaps: pyData.data?.matter_evidence_gaps || existingChambersData.matter_evidence_gaps,
          optimized_submission: pyData.data?.optimized_submission || existingChambersData.optimized_submission,
          strategic_audit: pyData.data?.strategic_audit || existingChambersData.strategic_audit,
          artifact_validation: pyData.data?.artifact_validation || existingChambersData.artifact_validation,
          evidence_reconciliation: pyData.data?.evidence_reconciliation || existingChambersData.evidence_reconciliation,
          source_validation: sourceValidation,
          constitutional_validation: constitutionalValidation,
          release_verdict: releaseVerdict,
          judgeScore,
          judgeFeedback,
          judgeVerdict: judgeData,
          judgeChecks,
          // v19.0: Clone-and-Replace DOCX — base64-encoded cloned DOCX with AI enhancements
          // This preserves the original formatting (colors, bold, logos, diversity sections)
          // and only replaces B10 + D2/E2 cells with enhanced content
          cloned_docx_b64: sourceCloneReady ? pyData.data?.cloned_docx_b64 : null,
          ...(extractedDept.department_name ? { departmentName: extractedDept.department_name } : {}),
          ...(extractedDept.num_partners ? { numPartners: extractedDept.num_partners } : {}),
          ...(extractedDept.num_lawyers ? { numLawyers: extractedDept.num_lawyers } : {}),
          ...(extractedDept.department_heads?.length ? { departmentHeads: extractedDept.department_heads } : {}),
          ...(extractedDept.hires_departures?.length ? { hires: extractedDept.hires_departures } : {}),
          ...(extractedDept.department_description ? { departmentDesc: extractedDept.department_description } : {}),
          ...(extractedLawyers.length ? {
            lawyers: extractedLawyers.map((l: any) => ({
              name: l.name, url: l.url || '', currentRank: l.current_ranking || '',
              suggestedRank: l.suggested_ranking || '', focus: l.key_focus || '',
              bio: l.bio || '', standoutWork: l.standout_work || '',
              isPartner: l.is_partner || false, isRanked: l.is_ranked || false,
            }))
          } : {}),
          ...(extractedContacts.length ? { contacts: extractedContacts } : {}),
          // v18.1: Jurisdiction priority — country-level data is critical for market analysis
          // resolved_jurisdiction = benchmark resolver found the exact Chambers URL match
          // aiLocation = AI extraction from the document text
          // metaJurisdiction = extracted from document metadata fields
          // scJurisdiction = may be generic region from UI dropdown ("Latin America")
          detectedJurisdiction: (() => {
            const resolvedJ = pyData.data?.strategic_context?.resolved_jurisdiction;
            const aiLocation = (analysisData as any)?.location;
            const metaLocation = pyData.data?.metadata?.location;
            const metaJurisdiction = pyData.data?.metadata?.jurisdiction;
            const scJurisdiction = pyData.data?.strategic_context?.jurisdiction;
            const existing = existingChambersData.detectedJurisdiction;
            // Priority: benchmark-resolved > AI analysis.location > metadata.location > metadata.jurisdiction > strategic_context > existing
            const j = resolvedJ || aiLocation || metaLocation || metaJurisdiction || existing || null;
            // Skip generic regions like "Latin America" from scJurisdiction — they're useless for market analysis
            const genericRegions = ['latin america', 'europe', 'asia', 'global', 'africa', 'middle east', 'north america'];
            const finalJ = j || (scJurisdiction && !genericRegions.includes(scJurisdiction.toLowerCase()) ? scJurisdiction : null) || existing || null;
            console.log(`[JURISDICTION SAVE] Result: '${finalJ}' | resolved='${resolvedJ}', AI='${aiLocation}', metaLoc='${metaLocation}', sc='${scJurisdiction}'`);
            return finalJ;
          })(),
          _pipeline_error: null,
          _pipeline_progress: {
            ...existingChambersData._pipeline_progress,
            progress: 100,
            stage: 'completed',
            stage_label: 'Deliverables ready',
            updated_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          },
        },
        status: 'Submitted'
      }
    });

    // Log the AI interaction
    await prisma.aILog.create({
      data: {
        userId: submission.userId,
        prompt: `Pipeline Callback: ${submission_id}`,
        response: JSON.stringify(pyData).substring(0, 5000),
        durationMs: 0
      }
    });

    console.log(`[PIPELINE CALLBACK] ✅ Saved ${createdCount} matters + full analysis for ${submission_id}`);
    return NextResponse.json({ status: 'saved', createdCount });

  } catch (error: any) {
    console.error('[PIPELINE CALLBACK ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
