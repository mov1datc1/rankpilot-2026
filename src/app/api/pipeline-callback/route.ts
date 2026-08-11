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
    const { secret, submission_id, pipeline_result, pipeline_error } = body;

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
            _pipeline_error: {
              code: pipeline_error.code || 'PIPELINE_ERROR',
              message: pipeline_error.message || 'Unknown pipeline error',
              details: pipeline_error.details || '',
              timestamp: new Date().toISOString(),
            }
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
            isConfidential: m.is_confidential || false,
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
          // v19.0: Clone-and-Replace DOCX — base64-encoded cloned DOCX with AI enhancements
          // This preserves the original formatting (colors, bold, logos, diversity sections)
          // and only replaces B10 + D2/E2 cells with enhanced content
          cloned_docx_b64: pyData.data?.cloned_docx_b64 || existingChambersData.cloned_docx_b64 || null,
          ...(extractedDept.department_name ? { departmentName: extractedDept.department_name } : {}),
          ...(extractedDept.num_partners ? { numPartners: extractedDept.num_partners } : {}),
          ...(extractedDept.num_lawyers ? { numLawyers: extractedDept.num_lawyers } : {}),
          ...(extractedDept.department_heads?.length ? { departmentHeads: extractedDept.department_heads } : {}),
          ...(extractedDept.hires_departures?.length ? { hires: extractedDept.hires_departures } : {}),
          ...(extractedDept.department_description ? { departmentDesc: extractedDept.department_description } : {}),
          ...(extractedLawyers.length ? {
            lawyers: extractedLawyers.map((l: any) => ({
              name: l.name, url: l.url || '', currentRank: l.current_ranking || 'Not Ranked',
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
