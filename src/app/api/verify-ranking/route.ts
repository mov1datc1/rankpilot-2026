import { engineFetch } from '@/lib/editorial/engine';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const {data:{user}}=await (await createClient()).auth.getUser();
    if(!user) return NextResponse.json({error:'Not authenticated'},{status:401});
    const body=await request.json();
    if(typeof body.submissionId!=='string' || !(body.edition==='current' || /^20\d{2}$/.test(String(body.edition || '')))) return NextResponse.json({error:'Indica la edición con cuatro dígitos o selecciona la tabla actual.'},{status:400});
    const account=user.email?await prisma.user.findUnique({where:{email:user.email}}):null;
    const submission=await prisma.submission.findUnique({where:{id:body.submissionId}});
    if(!submission || ![user.id,account?.id].includes(submission.userId)) return NextResponse.json({error:'Not found'},{status:404});
    const previous=submission.chambersData as any || {};
    const declaredBand=typeof body.declaredBand==='string'?body.declaredBand.trim():submission.currentBand;
    if(declaredBand && declaredBand.length>80) return NextResponse.json({error:'La posición declarada es demasiado larga.'},{status:400});
    if(body.expectedRevision!==Number(previous.draft_revision || 0)) return NextResponse.json({error:'El borrador cambió. Recarga antes de consultar.'},{status:409});
    const country=typeof body.country==='string'?body.country.trim():'';
    if(!country || country.length>100) return NextResponse.json({error:'Indica el país de la tabla que deseas consultar.'},{status:400});
    const response=await engineFetch(`${process.env.PYTHON_API_URL || 'http://127.0.0.1:8000'}/verify-ranking`,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(45000),body:JSON.stringify({firm_name:previous.firm_name || previous.firmName || '',directory:submission.targetDirectory,practice_area:submission.practiceArea,jurisdiction:country,current_band:declaredBand,ranking_edition:String(body.edition)})});
    if(!response.ok) return NextResponse.json({error:'La consulta oficial no está disponible. El borrador se conserva.'},{status:502});
    const result=await response.json();
    if(!result.success || !result.ranking_verification?.status) return NextResponse.json({error:'La consulta no devolvió evidencia válida.'},{status:502});
    const data={...previous,ranking_edition:String(body.edition),ranking_jurisdiction:country,ranking_verification:result.ranking_verification,ranking_claim:declaredBand || null,ranking_claim_history:[...(previous.ranking_claim_history || []),{declared_band:declaredBand,previous_band:submission.currentBand,edition:String(body.edition),jurisdiction:country,checked_at:result.ranking_verification.checked_at}],draft_revision:Number(previous.draft_revision || 0)+1,approved_artifact:null,release_verdict:{passed:false,status:'needs_review',errors:['Se actualizó la evidencia de ranking; requiere revisión final.']}};
    const updated=await prisma.submission.updateMany({where:{id:submission.id,updatedAt:submission.updatedAt},data:{chambersData:data,currentBand:declaredBand || '',status:'Draft'}});
    if(updated.count!==1) return NextResponse.json({error:'El borrador cambió durante la consulta. Recarga antes de reintentar.'},{status:409});
    return NextResponse.json({success:true,chambersData:data});
  } catch {return NextResponse.json({error:'No se pudo verificar el ranking. El borrador se conserva.'},{status:502});}
}
