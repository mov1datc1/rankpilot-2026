import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configuredUrl = process.env.PYTHON_API_URL;
  if (!configuredUrl) {
    return NextResponse.json(
      { status: 'unavailable', version: null, service: 'ai-engine' },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${configuredUrl.replace(/\/$/, '')}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return NextResponse.json(
        { status: 'unavailable', version: null, service: 'ai-engine' },
        { status: 503 },
      );
    }
    const health = await response.json();
    return NextResponse.json({
      status: health?.status === 'online' ? 'online' : 'unavailable',
      version: health?.version || null,
      service: 'ai-engine',
    });
  } catch {
    return NextResponse.json(
      { status: 'unavailable', version: null, service: 'ai-engine' },
      { status: 503 },
    );
  }
}
