import {editorialPreparationIssues} from '@/lib/audit/preparation-input';
import { savedScopeIssues } from '@/lib/audit/analysis-scope';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import { enqueue, latestJob, publicJob } from '@/lib/editorial/jobs';
import { ensureCaseRegister } from '@/lib/editorial/case-register-build';

// The case register reading (v1.0.121) can take up to three minutes.
export const maxDuration = 300;
import { EDITORIAL_VERSION } from '@/lib/editorial/contracts';
import { REVIEW_CONTRACT } from '@/lib/audit/review-versions';

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
    return NextResponse.json({reviewContract:REVIEW_CONTRACT,job:publicJob(job,submission),...(!job || ['queued','running'].includes(job.status)?{}:{chambersData:submission.chambersData,matters:(submission.chambersData as any)?.matters || submission.matters,status:submission.status})},{headers:{'Cache-Control':'no-store'}});
  } catch {return NextResponse.json({error:'No se pudo consultar el avance. Tus datos se conservan.'},{status:503});}
}
export async function POST(request:NextRequest) {
  const body=await request.json();
  const submission=await owned(body.submissionId);
  if(!submission) return NextResponse.json({error:'Expediente no disponible.'},{status:404});
  const data:any={...(submission.chambersData as any || {}), firm_name: (submission.chambersData as any)?.firm_name || (submission as any).firmName, practice_area: (submission.chambersData as any)?.practice_area || submission.practiceArea};
  const inputIssues=editorialPreparationIssues(data,data.matters || submission.matters || []);
  if(inputIssues.length) return NextResponse.json({code:'INPUT_REQUIRED',error:'Resuelve los datos pendientes antes de preparar los documentos.',issues:inputIssues},{status:422});
  const issues=savedScopeIssues(submission,data);
  if(issues.length) return NextResponse.json({code:issues[0].code,error:issues.map(i=>i.message).join(' '),issues},{status:422});
  try {
    const workers:any[]=await prisma.$queryRaw`SELECT "id" FROM "EditorialWorker" WHERE "version"=${EDITORIAL_VERSION} AND "heartbeat">now()-interval '90 seconds' LIMIT 1`;
    if(!workers.length) return NextResponse.json({code:'WORKER_UNAVAILABLE',error:'El motor editorial no está disponible. No iniciamos llamadas ni gastamos tokens; el expediente se conserva.'},{status:503});
    // v1.0.121: a new generation first reads the case register (one call, saved).
    const registered=body.repair===true ? {submission,trace:null} : await ensureCaseRegister(submission,await latestJob(submission.id));
    return NextResponse.json({job:publicJob(await enqueue(registered.submission,body.retry===true,body.repair===true,registered.trace))},{status:202});
  } catch(error:any) {
    if(error.message==='AUTO_REPAIR_UNAVAILABLE') return NextResponse.json({code:'AUTO_REPAIR_UNAVAILABLE',error:'RankPilot no encontró una reparación automática respaldada por las fuentes para este hallazgo. El expediente se conserva; no necesitas alterar tus datos para resolver un error de generación.'},{status:422});
    return NextResponse.json({error:error.message==='PROVIDER_OUTCOME_UNKNOWN'?'No podemos confirmar el resultado de la llamada anterior. Conservamos el expediente. Pulsa «Actualizar estado» para consultar el avance guardado. Esta consulta no repite la llamada ni inicia otra generación.':'No se pudo iniciar la revisión. El expediente se conserva.'},{status:503});
  }
}
