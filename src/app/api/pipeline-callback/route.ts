import { NextResponse } from 'next/server';
/** Retired: the durable worker persists its own fenced results. */
export async function POST() {
  return NextResponse.json({code:'STUDIO_REQUIRED',error:'El flujo anterior fue retirado. Abre Submission Studio para continuar con el expediente guardado.'},{status:410});
}
