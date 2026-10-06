import { REVIEW_POLICY_VERSION } from '@/lib/audit/review-checkpoint';
/** Service credential stays server-side; never forward browser headers. */
export async function engineFetch(url:string,init:RequestInit={}) {
  const headers=new Headers(init.headers);
  const token=process.env.AI_ENGINE_SERVICE_TOKEN;
  if(token) headers.set('Authorization',`Bearer ${token}`);
  const response=await fetch(url,{...init,headers});
  if(response.ok && process.env.NODE_ENV==='production' && response.headers.get('X-RankPilot-Policy')!==REVIEW_POLICY_VERSION) throw new Error('POLICY_VERSION_MISMATCH');
  return response;
}
