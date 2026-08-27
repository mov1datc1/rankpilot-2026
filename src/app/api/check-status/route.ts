import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * v18.0: Status Polling Endpoint
 * 
 * Called by the frontend every 10 seconds to check if the pipeline
 * has completed. Returns the current submission status.
 * 
 * Statuses: 'Processing' | 'Submitted' | 'Error' | 'Draft'
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  try {
    const submission = await prisma.submission.findUnique({
      where: { id },
      select: { 
        id: true, 
        status: true,
        chambersData: true,
        _count: {
          select: { matters: true }
        }
      }
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const chambersData = (submission.chambersData as any) || {};
    const pipelineError = chambersData?._pipeline_error || null;
    let sanitizedError = pipelineError?.message || null;

    // Calculate matter count from DB relation and chambersData
    const dbMatterCount = submission._count?.matters || 0;
    const jsonMatters = chambersData?.matters || chambersData?.extractedMatters || chambersData?.metadata?.matters || [];
    const jsonMatterCount = Array.isArray(jsonMatters)
      ? jsonMatters.length
      : (chambersData?.metadata?.matters_count || chambersData?.metadata?.total_matters || 0);
    const matterCount = Math.max(dbMatterCount, jsonMatterCount);

    // If submission is Submitted, clear any non-fatal transient error messages
    if (submission.status === 'Submitted') {
      return NextResponse.json({
        id: submission.id,
        status: submission.status,
        hasError: false,
        errorMessage: null,
        errorCode: null,
        matterCount,
      });
    }

    if (sanitizedError) {
      const lower = sanitizedError.toLowerCase();
      if (
        lower.includes('429') ||
        lower.includes('quota') ||
        lower.includes('credit') ||
        lower.includes('rate_limit') ||
        lower.includes('openai') ||
        lower.includes('insufficient') ||
        lower.includes('balance')
      ) {
        sanitizedError = 'El servidor de IA está experimentando un ajuste de capacidad temporal. Por favor reintenta en unos momentos o consulta tus entregables.';
      } else if (lower.includes('{') || lower.includes('traceback') || lower.includes('code:')) {
        sanitizedError = 'El procesamiento del servidor requirió tiempo adicional. Por favor reintenta o consulta tus entregables.';
      }
    }

    return NextResponse.json({
      id: submission.id,
      status: submission.status,
      hasError: !!pipelineError,
      errorMessage: sanitizedError,
      errorCode: pipelineError?.code ? 'SERVER_CAPACITY_RETRY' : null,
      matterCount,
    });
  } catch (error: any) {
    console.error('[CHECK STATUS ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
