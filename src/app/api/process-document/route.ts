import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentUrl, text, context } = body;
    let { submissionId } = body;

    if (!submissionId && !documentUrl && !text) {
      return NextResponse.json({ error: 'Missing submissionId, documentUrl, or text' }, { status: 400 });
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

    // Auto-create submission if Matter Assistant calls without one
    let submission;
    if (submissionId) {
      submission = await prisma.submission.findUnique({ where: { id: submissionId } });
      if (!submission || (submission.userId !== user.id && submission.userId !== resolvedUserId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    } else {
      // Create a temporary submission from Matter Assistant context
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
      submissionId = submission.id;
    }

    // Call Python backend
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';
    const userInput = documentUrl || text || '';
    const pyResponse = await fetch(`${pythonApiUrl}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_input: userInput,
        thread_id: submissionId,
        is_file: !!documentUrl,
        context: {
          directory: submission.targetDirectory,
          jurisdiction: submission.guideRegion,
          practice_area: submission.practiceArea,
          current_status: submission.currentBand
        }
      })
    });

    let pyData: any = {};
    const rawText = await pyResponse.text();
    try {
      pyData = JSON.parse(rawText);
    } catch (e) {
      console.error("Non-JSON response from Python:", rawText);
      pyData = { error: rawText || pyResponse.statusText };
    }

    if (!pyResponse.ok) {
      console.error(`Python API Error Raw Text:\n${rawText}`);
      throw new Error(`Python API Error: ${rawText}`);
    }
    
    // El motor Python debe retornar la data estructurada.
    const extractedData = pyData.metadata || pyData.data?.metadata;
    const extractedMatters = pyData.matters || pyData.data?.matters;
    const analysisData = pyData.data?.analysis || pyData.analysis;
    const strategicContext = pyData.data?.strategic_context || pyData.strategic_context;

    // Extract department/lawyers/contacts from AI metadata (new structured fields)
    const extractedDept = extractedData?.department || {};
    const extractedLawyers = extractedData?.lawyers || [];
    const extractedContacts = extractedData?.contacts || [];

    // Si encontramos matters, los guardamos en la base de datos
    let createdCount = 0;
    if (extractedMatters && Array.isArray(extractedMatters)) {
      for (const m of extractedMatters) {
        const isOptimized = m.status === 'AI Optimized' || m.optimized_text;
        
        await prisma.matter.create({
          data: {
            submissionId,
            userId: resolvedUserId,
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
            // Chambers-specific fields
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

    // ALWAYS persist analysis, strategicContext, editorial reasoning, AND department/lawyer data into chambersData
    const existingChambersData = (submission.chambersData as any) || {};
    await prisma.submission.update({
      where: { id: submissionId },
      data: { 
        chambersData: {
          ...existingChambersData,
          metadata: extractedData || existingChambersData.metadata,
          analysis: analysisData || existingChambersData.analysis,
          strategicContext: strategicContext || existingChambersData.strategicContext,
          // Editorial Reasoning Engine outputs
          comprehension: pyData.data?.comprehension || existingChambersData.comprehension,
          competitive_identity: pyData.data?.competitive_identity || existingChambersData.competitive_identity,
          hypotheses: pyData.data?.hypotheses || existingChambersData.hypotheses,
          refutation_results: pyData.data?.refutation_results || existingChambersData.refutation_results,
          comparative_analysis: pyData.data?.comparative_analysis || existingChambersData.comparative_analysis,
          editorial_confidence: pyData.data?.editorial_confidence || existingChambersData.editorial_confidence,
          narrative_architecture: pyData.data?.narrative_architecture || existingChambersData.narrative_architecture,
          reasoning_trace: pyData.data?.reasoning_trace || existingChambersData.reasoning_trace,
          // Department/lawyer/contact data from AI extraction
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
        },
        status: 'Submitted'
      }
    });

    // Log the AI interaction for traceability
    await prisma.aILog.create({
      data: {
        userId: resolvedUserId,
        prompt: `Process Document: ${documentUrl}`,
        response: typeof pyData === 'string' ? pyData : JSON.stringify(pyData).substring(0, 5000), // Limit size for DB text column if huge
        durationMs: 0
      }
    });

    return NextResponse.json({ success: true, createdCount, raw: pyData });
  } catch (error: any) {
    console.error('Error processing document in Next API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
