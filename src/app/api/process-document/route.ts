import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

// Sanitize text to remove problematic Unicode characters
function sanitizeText(text: string): string {
  if (!text) return '';
  // Remove null bytes and control characters
  return text
    .replace(/\x00/g, '')
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    // Remove lone surrogates
    .replace(/[\uD800-\uDFFF]/g, '');
}

// Safe JSON parse with multiple fallback strategies
function safeJsonParse(text: string, fallback: any = {}): any {
  if (!text) return fallback;
  const cleaned = text.trim();
  
  // Strategy 1: Direct parse
  try { return JSON.parse(cleaned); } catch {}
  
  // Strategy 2: Sanitize then parse
  try { return JSON.parse(sanitizeText(cleaned)); } catch {}
  
  // Strategy 3: Remove BOM and retry
  try { return JSON.parse(cleaned.replace(/^\uFEFF/, '')); } catch {}
  
  // Strategy 4: Extract JSON object
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  
  console.error('[safeJsonParse] All strategies failed. First 300 chars:', cleaned.substring(0, 300));
  return fallback;
}

function createErrorResponse(errorCode: string, userMessage: string, technicalDetails: string, status: number = 500) {
  return NextResponse.json({
    error: userMessage,
    errorCode,
    details: technicalDetails,
    supportMessage: 'Si el problema persiste, por favor reporta este error al equipo de soporte con el c\u00f3digo de error.',
    timestamp: new Date().toISOString(),
  }, { status });
}

export async function POST(request: NextRequest) {
  let submissionId: string = '';
  let submission: any = null;
  
  try {
    const body = await request.json();
    const { documentUrl, text, context } = body;
    submissionId = body.submissionId || '';

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
    pyData = safeJsonParse(rawText, { error: rawText || pyResponse.statusText });

    if (!pyResponse.ok) {
      console.error(`[PYTHON API ERROR] Status: ${pyResponse.status}, Thread: ${submissionId}`);
      console.error(`[PYTHON API ERROR] Raw response (first 500 chars): ${rawText.substring(0, 500)}`);
      
      const errorCode = pyData.error_code || 'PIPELINE_ERROR';
      const userMsg = pyData.error || 'El motor de IA encontr\u00f3 un error al procesar tu documento.';
      
      // CRITICAL: Save partial data even on error so the report shows something useful
      try {
        const partialData = pyData.data || {};
        const existingCD = (submission.chambersData as any) || {};
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: 'Error',
            chambersData: {
              ...existingCD,
              // Save whatever the pipeline managed to extract before failing
              ...(partialData.metadata ? { metadata: partialData.metadata } : {}),
              ...(partialData.analysis ? { analysis: partialData.analysis } : {}),
              ...(partialData.strategic_context ? { strategicContext: partialData.strategic_context } : {}),
              ...(partialData.comprehension ? { comprehension: partialData.comprehension } : {}),
              ...(partialData.competitive_identity ? { competitive_identity: partialData.competitive_identity } : {}),
              ...(partialData.hypotheses ? { hypotheses: partialData.hypotheses } : {}),
              ...(partialData.refutation_results ? { refutation_results: partialData.refutation_results } : {}),
              ...(partialData.comparative_analysis ? { comparative_analysis: partialData.comparative_analysis } : {}),
              ...(partialData.editorial_confidence ? { editorial_confidence: partialData.editorial_confidence } : {}),
              ...(partialData.narrative_architecture ? { narrative_architecture: partialData.narrative_architecture } : {}),
              ...(partialData.reasoning_trace ? { reasoning_trace: partialData.reasoning_trace } : {}),
              // Store the error for the report page to display
              _pipeline_error: {
                code: errorCode,
                message: userMsg,
                details: pyData.details || '',
                timestamp: new Date().toISOString(),
              }
            }
          }
        });
      } catch (saveErr) {
        console.error('[PARTIAL SAVE ERROR]', saveErr);
      }
      
      return createErrorResponse(
        errorCode,
        userMsg,
        `Python API responded with status ${pyResponse.status}`,
      );
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

    // Auto-create or find Firm for library organization
    const firmName = (submission.chambersData as any)?.firmName
      || strategicContext?.firm_name
      || extractedData?.firm_name
      || '';
    let firmId: string | null = null;
    if (firmName && resolvedUserId) {
      const firm = await prisma.firm.upsert({
        where: { userId_name: { userId: resolvedUserId, name: firmName } },
        update: {},
        create: { userId: resolvedUserId, name: firmName },
      });
      firmId = firm.id;
    }

    // Si encontramos matters, los guardamos en la base de datos
    let createdCount = 0;
    if (extractedMatters && Array.isArray(extractedMatters)) {
      for (const m of extractedMatters) {
        const isOptimized = m.status === 'AI Optimized' || m.optimized_text;
        
        await prisma.matter.create({
          data: {
            submissionId,
            userId: resolvedUserId,
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
    console.error('[PROCESS DOCUMENT ERROR]', error);
    
    // Save error state to DB so the report page shows an error instead of blank
    try {
      if (submissionId) {
        const existingCD = (submission?.chambersData as any) || {};
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: 'Error',
            chambersData: {
              ...existingCD,
              _pipeline_error: {
                code: 'SYSTEM_ERROR',
                message: error.message || 'Error inesperado en el procesamiento',
                timestamp: new Date().toISOString(),
              }
            }
          }
        });
      }
    } catch (saveErr) {
      console.error('[ERROR STATE SAVE FAILED]', saveErr);
    }
    
    // Categorize error for user-facing message
    let errorCode = 'UNKNOWN_ERROR';
    let userMessage = 'Ocurri\u00f3 un error inesperado al procesar tu documento.';
    
    if (error.message?.includes('Unicode') || error.message?.includes('unicode')) {
      errorCode = 'UNICODE_ERROR';
      userMessage = 'El documento contiene caracteres especiales que no pudieron ser procesados. Intenta guardar el documento como UTF-8 y s\u00fabelo de nuevo.';
    } else if (error.message?.includes('fetch') || error.message?.includes('ECONNREFUSED')) {
      errorCode = 'AI_ENGINE_OFFLINE';
      userMessage = 'El motor de IA no est\u00e1 disponible en este momento. Por favor, intenta de nuevo en unos minutos.';
    } else if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
      errorCode = 'TIMEOUT';
      userMessage = 'El procesamiento del documento tard\u00f3 demasiado. Intenta con un documento m\u00e1s peque\u00f1o o int\u00e9ntalo de nuevo.';
    }
    
    return createErrorResponse(errorCode, userMessage, error.message);
  }
}
