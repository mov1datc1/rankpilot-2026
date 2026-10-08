import { draftSourceHash, stableHash } from './contracts';
import { createHash } from 'node:crypto';

export const DEVELOPMENT_VERSION = 'editorial-development-v1';
const hash=(text:string)=>createHash('sha256').update(JSON.stringify(text)).digest('hex');

/** Apply generated proposals without changing the source roster or evidence.
 * Previous drafts remain available for recovery. A changed human draft with
 * known provenance is preserved and must pass the same final coverage review.
 */
export function projectDevelopment(data:any, state:any) {
  const development=state.development;
  if(state.development_validated!==true || development?.version!==DEVELOPMENT_VERSION) throw new Error('DEVELOPMENT_REJECTED');
  const core=new Set(state.strategy.matters.filter((d:any)=>d.disposition==='core').map((d:any)=>d.matter_id));
  const drafts=new Map<string,any>((development.matters || []).map((d:any)=>[d.matter_id,d]));
  if(drafts.size!==core.size || [...core].some(id=>!drafts.has(String(id)))) throw new Error('DEVELOPMENT_REJECTED');
  const previous:any[]=[];
  const matters=(data.matters || []).map((m:any)=>{
    const proposal=drafts.get(m.id);if(!proposal)return m;
    const old=String(m.optimizedText || m.optimized_text || '').trim();
    if(m.draft_provenance?.text_hash && m.draft_provenance.text_hash!==hash(old))return m;
    if(old && old!==proposal.text)previous.push({matter_id:m.id,text:old,provenance:m.draft_provenance || null});
    return {...m,optimizedText:proposal.text,optimized_text:proposal.text,editorial_completion_status:proposal.completion_status || '',status:'Optimized',draft_provenance:{origin:'generated',source_hash:draftSourceHash(m),text_hash:stableHash(proposal.text.trim()),strategy_hash:stableHash(state.strategy),development_version:DEVELOPMENT_VERSION}};
  });
  return {...data,matters,editorial_development:development,
    editorial_previous_drafts:previous.length?[...(data.editorial_previous_drafts || []),{version:DEVELOPMENT_VERSION,matters:previous,b10:data.enhanced_b7 || '',c2:data.enhanced_c2 || ''}]:data.editorial_previous_drafts,
    enhanced_b7:development.b10,enhanced_b10:development.b10,enhanced_c2:development.c2,
    b10_optimization:{text:development.b10,source:data.confirmed_source_b10 ?? data.original_b10 ?? '',strategy_hash:stableHash(state.strategy)},
    completed_review_input_hash:null,approved_artifact:null,final_review_stale:true,
    release_verdict:{passed:false,status:'awaiting_artifact_review',errors:[]}};
}
