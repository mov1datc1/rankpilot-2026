import { selectedScope, scopeIssues } from '@/lib/audit/analysis-scope';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import { enqueue, latestJob, publicJob } from '@/lib/editorial/jobs';
import { needsInputReview } from '@/lib/audit/input-review';
import { EDITORIAL_VERSION } from '@/lib/editorial/contracts';

async function owned(id:string|null) {
  const {data:{user}}=await (await createClient()).auth.getUser();
  if(!user || !id) return null;
  const account=user.email ? await prisma.user.findUnique({where:{email:user.email}}):null;
  const submission=await prisma.submission.findUnique({where:{id},include:{matters:true}});
  return submission && [user.id,account?.id].includes(submission.userId) ? submission:null;
}
export async function GET(request:NextRequest) {
  const submission=await owned(request.nextUrl.searchParams.get('submissionId'));
  if(!submission) return NextResponse.json({error:'Expediente no disponible.'},{status:404});
  try {
    const job=await latestJob(submission.id);
    return NextResponse.json({job:publicJob(job),...(!job || ['queued','running'].includes(job.status)?{}:{chambersData:submission.chambersData,matters:(submission.chambersData as any)?.matters || submission.matters,status:submission.status})},{headers:{'Cache-Control':'no-store'}});
  } catch {return NextResponse.json({error:'No se pudo consultar el avance. Tus datos se conservan.'},{status:503});}
}
export async function POST(request:NextRequest) {
  const body=await request.json();
  const submission=await owned(body.submissionId);
  if(!submission) return NextResponse.json({error:'Expediente no disponible.'},{status:404});
  const data:any=submission.chambersData || {};
  const issues=scopeIssues(selectedScope(submission),data.source_reports || []);
  if(issues.length) return NextResponse.json({code:issues[0].code,error:issues.map(i=>i.message).join(' '),issues},{status:422});
  if((data.matters || submission.matters).some(needsInputReview)) return NextResponse.json({code:'INPUT_REQUIRED',error:'Confirma los permisos y montos pendientes.'},{status:422});
  try {
    const workers:any[]=await prisma.$queryRaw`SELECT "id" FROM "EditorialWorker" WHERE "version"=${EDITORIAL_VERSION} AND "heartbeat">now()-interval '90 seconds' LIMIT 1`;
    if(!workers.length) return NextResponse.json({code:'WORKER_UNAVAILABLE',error:'El motor editorial no está disponible. No iniciamos llamadas ni gastamos tokens; el expediente se conserva.'},{status:503});
    return NextResponse.json({job:publicJob(await enqueue(submission,body.retry===true,body.repair===true))},{status:202});
  } catch(error:any) {
    if(error.message==='AUTO_REPAIR_UNAVAILABLE') return NextResponse.json({code:'AUTO_REPAIR_UNAVAILABLE',error:'RankPilot no encontró una reparación automática respaldada por las fuentes para este hallazgo. El expediente se conserva; no necesitas alterar tus datos para resolver un error de generación.'},{status:422});
    return NextResponse.json({error:error.message==='PROVIDER_OUTCOME_UNKNOWN'?'La llamada anterior aún puede seguir activa. Espera unos minutos antes de reintentar para evitar consumo duplicado.':'No se pudo iniciar la revisión. El expediente se conserva.'},{status:503});
  }
}
