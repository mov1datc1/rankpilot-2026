import { NextRequest, NextResponse } from 'next/server';
import { updateSubmissionDocumentUrl } from '@/app/actions/documents';

export async function POST(request: NextRequest) {
  try {
    const { id, url } = await request.json();
    
    if (!id || !url) {
      return NextResponse.json({ error: 'Missing id or url' }, { status: 400 });
    }

    const result = await updateSubmissionDocumentUrl(id, url);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
