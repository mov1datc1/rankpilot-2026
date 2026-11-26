import prisma from '@/lib/prisma';
import { reviewPackage } from '@/lib/audit/review-checkpoint';
import { engineFetch } from './engine';
import { sourceSnapshot, stableHash } from './contracts';
import { registerFresh, registerSourceHash } from './case-register';

/** v1.0.121: read the case register once, just before a NEW generation starts,
 * so the job's source snapshot already contains it and no stage ever sees it
 * change. A case whose last job matches its current sources keeps its saved
 * work untouched: resumptions, repairs and downloads never trigger a reading.
 * Returns the submission to enqueue and the reading's trace when its usage is
 * known (it opens the new job's ledger, so its cost is counted with the case). */
export async function ensureCaseRegister(submission:any, last:any):Promise<{submission:any, trace:any|null}> {
  const data:any={...(submission.chambersData || {})};
  data.matters=data.matters || submission.matters || [];
  if(registerFresh(data)) return {submission,trace:null};
  if(last && (['queued','running'].includes(last.status) || last.sourceHash===stableHash(sourceSnapshot(submission)))) return {submission,trace:null};
  const payload:any=reviewPackage(submission,{...data,firm_name:data.firm_name || submission.firmName,practice_area:data.practice_area || submission.practiceArea},data.matters);
  delete payload.case_register;
  let result:any=null;
  try {
    const response=await engineFetch(`${process.env.PYTHON_API_URL || 'http://127.0.0.1:8000'}/case-register`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({package:payload}),signal:AbortSignal.timeout(170000)});
    result=response.ok ? await response.json() : null;
  } catch(error:any) {
    console.error('[CASE_REGISTER_UNAVAILABLE]',{submissionId:submission.id,reason:String(error?.name || 'Error')});
  }
  // Without a reading the engine uses the rules register of the saved fields.
  if(!result?.success || !result.register) return {submission,trace:null};
  const calls=Array.isArray(result.trace) ? result.trace : [];
  const known=calls.length===1 && calls[0]?.usage && !calls[0].usage.unknown_calls && calls[0].usage_status!=='unknown';
  const register={...result.register,source_hash:registerSourceHash(data),built_at:new Date().toISOString(),
    ...(known ? {} : calls.length ? {unaccounted_trace:calls} : {})};
  const saved=await prisma.submission.updateMany({where:{id:submission.id,updatedAt:submission.updatedAt},
    data:{updatedAt:new Date(),chambersData:{...(submission.chambersData as any || {}),case_register:register}}});
  if(saved.count!==1) return {submission,trace:null};
  const fresh=await prisma.submission.findUnique({where:{id:submission.id},include:{matters:true}});
  return {submission:fresh || submission,trace:known ? calls[0] : null};
}
