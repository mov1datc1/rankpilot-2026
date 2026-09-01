import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

// v18.0: Async architecture — no maxDuration needed.
// Pipeline runs on Render in background, results come via webhook.

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
    const { documentUrl, text, context, originalFileName } = body;
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
      // If submission is already Submitted or Processing, don't restart pipeline
      if (submission.status === 'Submitted') {
        console.log(`[PROCESS-DOCUMENT] Submission ${submissionId} is already Completed — returning status`);
        return NextResponse.json({
          success: true,
          status: 'submitted',
          submissionId,
          message: 'Submission already completed.'
        });
      }
      if (submission.status === 'Processing') {
        console.log(`[PROCESS-DOCUMENT] Submission ${submissionId} is already Processing — skipping re-trigger`);
        return NextResponse.json({
          success: true,
          status: 'processing',
          submissionId,
          message: 'Submission is already processing.'
        });
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

    // v18.0: ASYNC ARCHITECTURE — Fire-and-forget to Render
    // Vercel Hobby times out at 300s. Pipeline takes 8-15 min.
    // Solution: Call /process-async, Render processes in background,
    // then POSTs results to /api/pipeline-callback webhook.
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';
    const persistedDocumentUrl = submission?.documentUrl || '';
    const userInput = documentUrl || persistedDocumentUrl || text || '';
    if (!userInput) {
      return NextResponse.json({
        error: 'No source document is available for this submission.',
        errorCode: 'SOURCE_NOT_AVAILABLE',
      }, { status: 400 });
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rankpilot-2026.vercel.app';
    const callbackUrl = `${siteUrl}/api/pipeline-callback`;
    const webhookSecret = process.env.PIPELINE_WEBHOOK_SECRET || '';
    const processingStartedAt = new Date().toISOString();
    const existingChambersData = (submission.chambersData as any) || {};

    // Atomically claim the job. Two tabs/refreshes may arrive together; only
    // one request is allowed to enqueue work in Render.
    const claim = await prisma.submission.updateMany({
      where: {
        id: submissionId,
        status: { notIn: ['Processing', 'Submitted'] },
      },
      data: { status: 'Processing' },
    });
    if (claim.count === 0) {
      return NextResponse.json({
        success: true,
        status: 'processing',
        submissionId,
        message: 'Submission is already processing.',
      });
    }

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        chambersData: {
          ...existingChambersData,
          _pipeline_error: null,
          _pipeline_progress: {
            progress: 2,
            stage: 'queued',
            stage_label: 'Preparando el trabajo en segundo plano',
            matter_count: 0,
            estimated_total_minutes: 25,
            started_at: processingStartedAt,
            updated_at: processingStartedAt,
          },
        },
      }
    });

    // Fire-and-forget: send to Render's async endpoint
    const pyResponse = await fetch(`${pythonApiUrl}/process-async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_input: userInput,
        thread_id: submissionId,
        is_file: Boolean(documentUrl || persistedDocumentUrl),
        context: {
          directory: submission.targetDirectory,
          jurisdiction: submission.guideRegion,
          practice_area: submission.practiceArea,
          current_status: submission.currentBand,
          primary_objective: (submission.chambersData as any)?.primaryObjective || '',
          secondary_objective: (submission.chambersData as any)?.secondaryObjective || '',
          original_file_name: originalFileName || ''
        },
        callback_url: callbackUrl,
        webhook_secret: webhookSecret,
      })
    });

    if (!pyResponse.ok) {
      const errorText = await pyResponse.text();
      console.error(`[PROCESS-ASYNC ERROR] Render rejected: ${pyResponse.status} — ${errorText.substring(0, 500)}`);
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'Error' }
      });
      return createErrorResponse(
        'AI_ENGINE_OFFLINE',
        'El motor de IA no está disponible. Intenta de nuevo en unos minutos.',
        `Render /process-async returned ${pyResponse.status}`,
      );
    }

    console.log(`[PROCESS-ASYNC] ✅ Pipeline accepted by Render for submission ${submissionId}`);

    return NextResponse.json({ 
      success: true, 
      status: 'processing',
      submissionId,
      message: 'Pipeline started. Polling for status.' 
    });
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
