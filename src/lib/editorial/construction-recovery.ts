import {hasUnknownProviderUsage,spentTokens,editorialTokenBudget} from './recovery';

export const PLAN_COMPARISON_RECOVERY='reserve-comparison-slots-v1';
const missing='Faltan comparaciones de reservas frente a su alternativa pertinente del núcleo.';
const visibility='Falta una comparación visible de frontera en el Audit.';

/** Resume a retained partial plan once, at its existing cursor and source hash.
 * The engine validates the complete retained response before any completion call.
 * Reading status never queues work; only the explicit continue action does. */
export function canResumeConstructionPlan(job:any,data:any,sourceHash:string,commit:string):boolean {
  const s=data?.review_checkpoint?.state,p=s?.repair_continuation,plan=p?.rejected_response;
  if(!job || job.status!=='failed' || job.stage!=='development' || job.tasks?.[job.cursor]!=='development'
    || job.sourceHash!==sourceHash || job.issue?.code!=='DEVELOPMENT_REJECTED' || job.issue?.owner!=='rankpilot'
    || !commit || commit==='local' || !job.ledger?.length || job.ledger.at(-1)?.worker_commit===commit
    || job.ledger.some((e:any)=>e.status==='construction_plan_recovery_requested')
    || s?.selection_validated!==true || s.selection_review_validated!==true
    || p?.version!=='editorial-construction-v1' || p.failed_unit?.kind!=='plan' || p.plan_comparison_recovery
    || !p.source_key || !p.content_hash || p.completed_units?.length || p.pending_groups?.length
    || !Array.isArray(plan?.comparisons) || !Array.isArray(plan?.matters) || !Array.isArray(plan?.candidates)
    || !String(p.validation_error || '').split('; ').every(e=>[missing,visibility].includes(e))
    || !String(p.validation_error).includes(missing)
    || hasUnknownProviderUsage(job.ledger) || hasUnknownProviderUsage([{trace:s.trace}])
    || !s.trace?.length || spentTokens(job.ledger)>=editorialTokenBudget(job.ledger))return false;
  const decisions=s.strategy?.matters || [];
  const core=new Set(decisions.filter((d:any)=>d.disposition==='core').map((d:any)=>d.matter_id));
  const reserves=new Set(decisions.filter((d:any)=>d.disposition==='reserve').map((d:any)=>d.matter_id));
  const compared=plan.comparisons.map((c:any)=>c.alternative_id);
  return core.size>0 && reserves.size>compared.length && new Set(compared).size===compared.length
    && plan.comparisons.every((c:any)=>reserves.has(c.alternative_id) && core.has(c.selected_id))
    && plan.matters.length===core.size && new Set(plan.matters.map((m:any)=>m.matter_id)).size===core.size
    && plan.matters.every((m:any)=>core.has(m.matter_id));
}
