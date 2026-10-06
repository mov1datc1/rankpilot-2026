import { NextResponse } from 'next/server';

/** Legacy PDF generation did not use the approved artifact pair. */
export async function GET() {
  return NextResponse.json({code:'STUDIO_REQUIRED',error:'La entrega se prepara desde Submission Studio. Descarga allí el Submission y el Audit DOCX de la misma revisión.'},{status:410});
}
