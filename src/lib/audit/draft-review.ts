import { reviewInputHash, reviewPackage } from './review-checkpoint';

/** A saved, source-current writer proposal may be inspected without approval.
 * Source edits invalidate this projection; it never changes the stored case. */
export function currentReviewDraft(submission:any,data:any) {
  const checkpoint=data.review_checkpoint,state=checkpoint?.state;
  const matters=data.matters || submission.matters || [];
  if(checkpoint?.stage!=='done' || !state?.selection_validated || !state?.selection_review_validated
    || !state?.development_validated || !state?.writer_validated
    || checkpoint.input_hash!==reviewInputHash(reviewPackage(submission,data,matters))) return null;
  const decisions=state.strategy?.matters || [];
  const ids=new Set(matters.map((m:any)=>m.id));
  if(decisions.length!==ids.size || new Set(decisions.map((d:any)=>d.matter_id)).size!==ids.size
    || decisions.some((d:any)=>!ids.has(d.matter_id))) return null;
  const core=decisions.filter((d:any)=>d.disposition==='core').map((d:any)=>d.matter_id);
  if(!core.length || core.length>20 || !core.includes(state.strategy.hero_matter_id))return null;
  return {...data,approved_artifact:null,release_verdict:{passed:false,status:'draft',errors:[]},
    editorial_review:state,editorial_development:state.development,
    hero_matter_id:state.strategy.hero_matter_id,
    canonical_matter_selection:{core_matter_ids:core,hero_matter_id:state.strategy.hero_matter_id,
      reserve_matter_ids:decisions.filter((d:any)=>d.disposition==='reserve').map((d:any)=>d.matter_id),
      excluded_matter_ids:decisions.filter((d:any)=>d.disposition==='excluded').map((d:any)=>d.matter_id)}};
}
