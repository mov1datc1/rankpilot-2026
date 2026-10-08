import { recoverClientLegalName } from './extraction-auditor';
import { projectConfirmedLawyerRole } from './lawyer-role';
import { createHash } from 'node:crypto';

import { REVIEW_POLICY_VERSION } from './review-versions';
export { REVIEW_POLICY_VERSION } from './review-versions';

export const reviewSteps = ['strategy', 'development', 'writer', 'done'] as const;
export const reviewStepLabels = {
  strategy: 'Comparando los asuntos y seleccionando el portafolio…',
  development: 'Desarrollando el Submission y las candidaturas con sus fuentes…',
  writer: 'Redactando el Audit con la selección guardada…',
  done: 'Revisando las fuentes, el Audit y el documento Word final…',
};

/** Only persisted editorial inputs; never accept a browser-supplied strategy. */
export function reviewPackage(submission: any, data: any, matters: any[]) {
  return {
    directory: submission.targetDirectory, practice_area: submission.practiceArea,
    guide_region: data.guideRegion || data.analysis_scope?.guide_region || '',
    jurisdiction: submission.guideRegion, firm_name: data.firm_name || data.firmName || '',
    research_period: data.research_period || null, current_band: submission.currentBand,
    requested_target: data.target_band || data.targetBand || data.ranking_target || null,
    filing_details: {contacts:data.contacts || [],department_name:data.departmentName || null,num_partners:data.numPartners ?? null,num_lawyers:data.numLawyers ?? null,heads:data.departmentHeads || data.department?.department_heads || []},
    objectives: {primary: data.primaryObjective || null, secondary: data.secondaryObjective || null},
    ranking_edition: data.ranking_edition || 'current',
    ranking_jurisdiction: data.ranking_jurisdiction || submission.guideRegion?.split('—').pop()?.trim(),
    preferred_hero_id: data.user_selected_hero_id || null,
    b10_source: data.confirmed_source_b10 ?? data.original_b10 ?? '',
    b10_draft: data.enhanced_b7 || data.original_b10 || '',
    c2_source: data.original_c2 || '', c2_draft: data.enhanced_c2 || '',
    editorial_development: data.editorial_development || null,
    lawyers: (data.lawyers || []).map(projectConfirmedLawyerRole), matters:matters.map(m=>({...m,client:recoverClientLegalName(m) || m.client})),
  };
}

export function reviewInputHash(payload: any) {
  const stable = (value: any): any => {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== 'object') return value;
    const copy = {...value};
    if (copy.optimizedText === copy.optimized_text) delete copy.optimized_text;
    return Object.fromEntries(Object.keys(copy).sort().map(key => [key, stable(copy[key])]));
  };
  return createHash('sha256').update(JSON.stringify(stable({version: 2, policy: REVIEW_POLICY_VERSION, payload}))).digest('hex');
}

/** Dependencies match the role payloads in Python; a draft is not a source. */
export function reviewStepHash(stage: string, payload: any, state: any = {}) {
  const source = structuredClone(payload);
  if (stage !== 'editor') {
    delete source.b10_draft;
    delete source.c2_draft;
    for (const matter of source.matters || []) {
      delete matter.optimizedText;
      delete matter.optimized_text;
      delete matter.status;
      delete matter.draft_provenance;
    }
  }
  // Portfolio selection compares mandates, not the candidate's biography.
  // Candidate corrections belong to the leadership letter and its review.
  delete source.editorial_development;
  return reviewInputHash({policy:'role-deliverables-v3-semantic-selection',stage,source,
    ...(stage==='writer'?{letter_contract:'executive-current-proposal-v3-bounded'}:{}),
    ...(stage !== 'strategy' ? {strategy:state.strategy} : {}),
    ...(['writer','editor'].includes(stage) ? {development:state.development} : {}),
    ...(stage === 'editor' ? {letter:state.letter} : {}),
  });
}

export function resumeReviewCheckpoint(payload: any, saved: any, now = Date.now()) {
  const input_hash = reviewInputHash(payload);
  const fresh = saved && Number.isFinite(saved.created_at) && now >= saved.created_at && now - saved.created_at < 86400000;
  const state = fresh ? structuredClone(saved.state || {}) : {};
  const keys = fresh ? {...saved.step_keys} : {};
  const base = {input_hash,created_at:fresh ? saved.created_at : now,lease_until:0,step_keys:keys,state};
  if (!state.strategy || keys.strategy !== reviewStepHash('strategy',payload,state)) {
    return {...base,stage:'strategy',state:{},step_keys:{}};
  }
  // The matching strategy key proves the original register order is unchanged.
  // Resolve transport references before downstream roles see source document numbers.
  state.strategy = displayStrategyReferences(state.strategy,payload.matters || []);
  if (state.selection_validated === false) return {...base,stage:'strategy',step_keys:{},state:{
    selection_feedback:{strategy:state.strategy,errors:state.errors || [],semantic_rejection:state.selection_feedback?.semantic_rejection ?? state.selection_review_validated===false},
  }};
  if (!state.selection_review_validated) return {...base,stage:'strategy',state:{},step_keys:{}};
  if (!state.development || !state.development_validated || keys.development !== reviewStepHash('development',payload,state)) {
    state.development_reusable=!!state.development && keys.development===reviewStepHash('development',payload,state);
    if(state.development && state.errors?.length) state.repair_feedback=state.errors.map((message:string)=>({message}));
    if(!state.repair_feedback?.length) delete state.development;delete state.letter;delete state.judge;delete state.release_verdict;
    state.errors=[];
    return {...base,stage:'development',step_keys:{strategy:keys.strategy}};
  }
  if (!state.letter || state.writer_validated===false || keys.writer !== reviewStepHash('writer',payload,state)) {
    delete state.letter;delete state.judge;delete state.release_verdict;
    state.errors=[];state.writer_attempts=0;
    return {...base,stage:'writer',step_keys:{strategy:keys.strategy,development:keys.development}};
  }
  return {...base,stage:'done'};
}

export function displayStrategyReferences(strategy:any, matters:any[]) {
  const labels=new Map(matters.map((m:any,i:number)=>[`M${String(i+1).padStart(2,'0')}`,recoverClientLegalName(m) || m.name || m.id]));
  const display=(value:string)=>String(value || '').replace(/(?<![\w-])M\d{2,}(?![\w-])/g,ref=>labels.get(ref) || ref);
  return {...strategy,thesis:display(strategy.thesis),pending_questions:(strategy.pending_questions || []).map(display),matters:(strategy.matters || []).map((m:any)=>({...m,rationale:display(m.rationale)}))};
}

/** A durable task must never execute a later role under an earlier stage label. */
export function reviewTaskDisposition(requested:string|undefined, resumed:string) {
  if (!requested) return 'run';
  const wanted=reviewSteps.indexOf(requested as typeof reviewSteps[number]);
  const next=reviewSteps.indexOf(resumed as typeof reviewSteps[number]);
  if(wanted<0 || requested==='done' || next<0) return 'invalid';
  return wanted<next?'reuse':wanted===next?'run':'out_of_order';
}

/** All paid calls in a stage, including semantic review and its bounded repair. */
export function stageTraceDelta(previous:any[], current:any[]) {
  const calls=(current || []).slice((previous || []).length);
  if(calls.length<2) return calls[0] || null;
  const usage:any={input_tokens:0,output_tokens:0,total_tokens:0};
  for(const call of calls) for(const key of Object.keys(usage)) usage[key]+=Number(call.usage?.[key] || 0);
  return {role:'selection_with_review',usage,seconds:calls.reduce((n:number,c:any)=>n+Number(c.seconds || 0),0),calls};
}
