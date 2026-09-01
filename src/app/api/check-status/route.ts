import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPipelineErrorPresentation } from '@/lib/pipeline-error-presentation';

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
    const errorPresentation = pipelineError
      ? getPipelineErrorPresentation(pipelineError)
      : null;

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

    return NextResponse.json({
      id: submission.id,
      status: submission.status,
      hasError: !!pipelineError,
      errorMessage: errorPresentation?.message || null,
      errorTitle: errorPresentation?.title || null,
      errorNextStep: errorPresentation?.nextStep || null,
      errorReference: errorPresentation?.reference || null,
      errorCode: errorPresentation?.kind || null,
      canRetry: errorPresentation?.canRetry ?? true,
      matterCount,
    });
  } catch (error: any) {
    console.error('[CHECK STATUS ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
