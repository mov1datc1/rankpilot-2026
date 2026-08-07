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
      }
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const chambersData = submission.chambersData as any;
    const pipelineError = chambersData?._pipeline_error || null;

    return NextResponse.json({
      id: submission.id,
      status: submission.status,
      hasError: !!pipelineError,
      errorMessage: pipelineError?.message || null,
      errorCode: pipelineError?.code || null,
    });
  } catch (error: any) {
    console.error('[CHECK STATUS ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
