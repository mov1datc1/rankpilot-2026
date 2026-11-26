import { randomUUID } from 'node:crypto';
import { REVIEW_POLICY_VERSION } from '@/lib/audit/review-checkpoint';
import {editorialIdentity} from './identity';

/** How long a lost answer is looked for. The wait is shorter than the 330-second
 * stage lease minus the longest request (250 seconds), so no second call can
 * overlap. Contract tests shorten the step; production never changes it. */
export const engineResultPolicy={waitMs:60000,stepMs:2000};
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

/** v1.0.120: the answer the engine already finished for this request id, or null.
 * It only reads: it never starts, repeats or pays for a role. An engine that does
 * not hold the answer (older version, restart) says so and the caller keeps the
 * previous behaviour. */
export async function savedEngineResult(url:string,requestId:string,authorization:string|null):Promise<Response|null> {
  const lookup=new URL(`/request-result/${requestId}`,url).toString();
  const deadline=Date.now()+engineResultPolicy.waitMs;
  let misses=0;
  while(Date.now()<deadline) {
    try {
      const found=await fetch(lookup,{headers:authorization?{Authorization:authorization}:{},signal:AbortSignal.timeout(20000)});
      if(found.status===200) {
        const body=await found.arrayBuffer();
        const headers=new Headers({'Content-Type':found.headers.get('Content-Type') || 'application/json'});
        const policy=found.headers.get('X-RankPilot-Policy');
        if(policy)headers.set('X-RankPilot-Policy',policy);
        return new Response(body,{status:Number(found.headers.get('X-RankPilot-Original-Status')) || 200,headers});
      }
      // 202: the role is still running, keep waiting. Anything else: not held.
      if(found.status===202)misses=0;
      else if(++misses>=3)return null;
    } catch {
      if(++misses>=3)return null;
    }
    await pause(engineResultPolicy.stepMs);
  }
  return null;
}

/** Service credential stays server-side; never forward browser headers. */
export async function engineFetch(url:string,init:RequestInit={}) {
  const headers=new Headers(init.headers);
  const token=process.env.AI_ENGINE_SERVICE_TOKEN;
  headers.delete('X-RankPilot-Token-Allowance');
  const allowance=editorialIdentity.getStore()?.tokenAllowance;
  if(typeof allowance==='number' && Number.isSafeInteger(allowance) && allowance>=0)headers.set('X-RankPilot-Token-Allowance',String(allowance));
  if(token) headers.set('Authorization',`Bearer ${token}`);
  // Every paid request carries its own id: the engine keeps the finished answer
  // under it, so a connection lost on the way back is read again, not re-bought.
  const tracked=String(init.method || 'GET').toUpperCase()==='POST';
  const requestId=randomUUID();
  if(tracked)headers.set('X-RankPilot-Request-Id',requestId);
  let response:Response;
  try {
    const live=await fetch(url,{...init,headers});
    if(tracked) {
      // Read the body here: a connection that breaks while the caller reads the
      // answer is the same lost answer as one that breaks before the headers.
      const body=await live.arrayBuffer();
      const kept=new Headers(live.headers);
      kept.delete('Content-Encoding');kept.delete('Content-Length');
      response=new Response([204,205,304].includes(live.status)?null:body,{status:live.status,statusText:live.statusText,headers:kept});
    } else response=live;
  } catch(error:any) {
    const saved=tracked?await savedEngineResult(url,requestId,headers.get('Authorization')).catch(()=>null):null;
    // The reason was never recorded before v1.0.120. No source or generated text here.
    console.error('[ENGINE_TRANSPORT_FAILED]',{path:new URL(url).pathname,reason:String(error?.name || 'Error'),
      cause:String(error?.cause?.code || error?.cause?.message || error?.message || '').slice(0,160),recovered:!!saved});
    if(!saved)throw error;
    response=saved;
  }
  if(response.ok && process.env.NODE_ENV==='production' && response.headers.get('X-RankPilot-Policy')!==REVIEW_POLICY_VERSION) throw new Error('POLICY_VERSION_MISMATCH');
  return response;
}
