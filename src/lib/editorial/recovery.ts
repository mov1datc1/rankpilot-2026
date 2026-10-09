/** Recovery belongs to the durable worker, never to a browser click. */
const recoverable = new Set(['INTERRUPTED','EXISTING_CALL','STAGE_FAILED','AI_REVIEW_UNAVAILABLE','DRAFT_CONFLICT','SELECTION_REJECTED','SELECTION_REVIEW_DEFERRED','DEVELOPMENT_REJECTED','GROUNDING_REJECTED','AI_OUTPUT_LIMIT','AI_REVIEW_INVALID']);
const uncertain = new Set(['INTERRUPTED','EXISTING_CALL','STAGE_FAILED','AI_REVIEW_UNAVAILABLE','DRAFT_CONFLICT']);

export function editorialTokenBudget() {
  const configured=Number(process.env.EDITORIAL_TOKEN_BUDGET || 1200000);
  return Number.isFinite(configured) && configured>0 ? configured:1200000;
}
export function spentTokens(ledger:any[]) {
  return (ledger || []).reduce((total:number,item:any)=>total+Number(item.trace?.usage?.total_tokens || 0),0);
}
export function recoveryPlan(job:any,code:string,commit:string,now=Date.now()):{retryAt:Date;attempt:number}|null {
  if(!recoverable.has(code) || job.issue?.owner==='user' || job.issue?.retryable===false || job.cursor>=40 || spentTokens(job.ledger)>=editorialTokenBudget()) return null;
  // Three failures per stage/cursor/build, bounded globally even across deployments.
  const failures=(job.ledger || []).filter((e:any)=>e.issue && e.stage===job.stage && (e.cursor===undefined || e.cursor===job.cursor));
  if(failures.length>=6) return null;
  const attempts=failures.filter((e:any)=>e.worker_commit===commit).length;
  if(attempts>=(code==='AI_OUTPUT_LIMIT'?2:3)) return null;
  // Longer than the engine's 330s lease. Never overlap an unknown provider call.
  const delay=uncertain.has(code)?360000:Math.min(120000,15000*2**attempts);
  return {retryAt:new Date(now+delay),attempt:attempts+1};
}
