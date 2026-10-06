import { NextRequest, NextResponse } from 'next/server';
import { POST as extract } from '@/app/api/extract-document/route';

export const maxDuration=300;
/** Compatibility entry: ingestion only, followed by the same Studio workflow. */
export async function POST(request:NextRequest) {
  const body=await request.json();
  const response=await extract(new NextRequest(request.url,{method:'POST',headers:request.headers,body:JSON.stringify({...body,documentUrl:body.documentUrl || body.url})}));
  const result=await response.json();
  return NextResponse.json({...result,...(result.success?{status:'needs_input',studioUrl:`/reports/${result.submissionId}?validate=true`}:{})},{status:response.status});
}
