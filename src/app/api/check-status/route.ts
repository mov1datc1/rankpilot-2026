import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPipelineErrorPresentation } from '@/lib/pipeline-error-presentation';
import { createClient } from '@/utils/supabase/server';

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    let resolvedUserId = user.id;
    if (user.email) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true },
      });
      if (existingByEmail) resolvedUserId = existingByEmail.id;
    }

    const submission = await prisma.submission.findUnique({
      where: { id },
      select: { 
        id: true, 
        userId: true,
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
    if (submission.userId !== user.id && submission.userId !== resolvedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const chambersData = (submission.chambersData as any) || {};
    const pipelineError = chambersData?._pipeline_error || null;
    const pipelineProgress = chambersData?._pipeline_progress || {};
    const errorPresentation = pipelineError
      ? getPipelineErrorPresentation(pipelineError)
      : null;

    // Calculate matter count from DB relation and chambersData
    const dbMatterCount = submission._count?.matters || 0;
    const jsonMatters = chambersData?.matters || chambersData?.extractedMatters || chambersData?.metadata?.matters || [];
    const jsonMatterCount = Array.isArray(jsonMatters)
      ? jsonMatters.length
      : (chambersData?.metadata?.matters_count || chambersData?.metadata?.total_matters || 0);
    const matterCount = Math.max(
      dbMatterCount,
      jsonMatterCount,
      Number(pipelineProgress.matter_count || 0),
    );
    const startedAt = pipelineProgress.started_at || null;
    const elapsedSeconds = startedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
      : Number(pipelineProgress.elapsed_seconds || 0);
    const progressPayload = {
      progress: Number(pipelineProgress.progress || (submission.status === 'Submitted' ? 100 : 0)),
      progressStage: pipelineProgress.stage || null,
      progressLabel: pipelineProgress.stage_label || null,
      processingStartedAt: startedAt,
      progressUpdatedAt: pipelineProgress.updated_at || null,
      estimatedTotalMinutes: Number(pipelineProgress.estimated_total_minutes || 0),
      elapsedSeconds,
    };

    // If submission is Submitted, clear any non-fatal transient error messages
    if (submission.status === 'Submitted') {
      return NextResponse.json({
        id: submission.id,
        status: submission.status,
        hasError: false,
        errorMessage: null,
        errorCode: null,
        matterCount,
        ...progressPayload,
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
      ...progressPayload,
    });
  } catch (error: any) {
    console.error('[CHECK STATUS ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
