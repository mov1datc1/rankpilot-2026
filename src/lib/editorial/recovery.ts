/** Recovery belongs to the durable worker, never to a browser click. */
const recoverable = new Set(['INTERRUPTED','EXISTING_CALL','STAGE_FAILED','AI_REVIEW_UNAVAILABLE','DRAFT_CONFLICT','SELECTION_REVIEW_DEFERRED','DEVELOPMENT_REJECTED','GROUNDING_REJECTED','AI_OUTPUT_LIMIT','AI_REVIEW_INVALID']);
const uncertain = new Set(['INTERRUPTED','EXISTING_CALL','STAGE_FAILED','AI_REVIEW_UNAVAILABLE','DRAFT_CONFLICT']);

/** Extensions are private ledger events recorded only after explicit approval. */
export function authorizedExtension(ledger:any[]=[]) {
  return [...ledger].reverse().find((e:any)=>e.status==='authorized_extension' && e.authorization?.approved_by &&
    Number.isSafeInteger(e.authorization.additional_tokens) && e.authorization.additional_tokens>0 &&
    Number.isSafeInteger(e.authorization.spent_tokens) && e.authorization.spent_tokens>=0 &&
    e.authorization.final_reviews===1);
}
export function authorizedReviewUsed(ledger:any[]=[]) {
  const grant=authorizedExtension(ledger);
  return !!grant && ledger.slice(ledger.indexOf(grant)+1).some(e=>e.stage==='artifact' && (e.trace || e.issue));
}
export function editorialTokenBudget(ledger:any[]=[]) {
  const configured=Number(process.env.EDITORIAL_TOKEN_BUDGET || 1200000);
  const base=Number.isFinite(configured) && configured>0 ? configured:1200000;
  const grant=authorizedExtension(ledger);
  return grant ? Math.max(base,grant.authorization.spent_tokens+grant.authorization.additional_tokens):base;
}
export function spentTokens(ledger:any[]) {
  return (ledger || []).reduce((total:number,item:any)=>total+Number(item.trace?.usage?.total_tokens || 0),0);
}
export function recoveryPlan(job:any,code:string,commit:string,now=Date.now()):{retryAt:Date;attempt:number}|null {
  if(!recoverable.has(code) || job.issue?.owner==='user' || job.issue?.retryable===false || job.cursor>=40 || spentTokens(job.ledger)>=editorialTokenBudget(job.ledger) || authorizedReviewUsed(job.ledger)) return null;
  // Three failures per stage/cursor/build, bounded globally even across deployments.
  const failures=(job.ledger || []).filter((e:any)=>e.issue && e.stage===job.stage && (e.cursor===undefined || e.cursor===job.cursor));
  if(failures.length>=6) return null;
  const attempts=failures.filter((e:any)=>e.worker_commit===commit).length;
  if(attempts>=(code==='AI_OUTPUT_LIMIT'?2:3)) return null;
  // Longer than the engine's 330s lease. Never overlap an unknown provider call.
  const delay=uncertain.has(code)?360000:Math.min(120000,15000*2**attempts);
  return {retryAt:new Date(now+delay),attempt:attempts+1};
}

/** A global rejection with no concrete critical finding is a reviewer failure,
 * never a source-confirmation request. Reassess it; never turn it into approval. */
export function needsDiagnosticReview(data:any):boolean {
  const judge=data?.final_artifact_review?.judge;
  if(!judge) return false;
  const critical=(judge.defects || []).filter((d:any)=>d.severity==='critical');
  const failedAcceptance=judge.acceptance?.some((c:any)=>c.status==='failed');
  return critical.length>0 && critical.every((d:any)=>d.owner!=='user' && (
    (failedAcceptance && d.code==='EDITORIAL_OMISSION' &&
      String(d.message || '').startsWith('La aceptación editorial no está completa:') && !d.artifact_quote && !d.source_quote) ||
    (d.owner==='rankpilot' && d.retryable===true && d.code==='TEMPORAL_FINDING_UNRESOLVED' &&
      d.temporal_basis==='missing_metadata' && d.artifact_claim_kind==='template_label' && !d.source_quote)
  ));
}
