import { createHash } from 'node:crypto';

export const REVIEW_POLICY_VERSION = 'review-core-v1.4';

export const reviewSteps = ['strategy', 'writer', 'done'] as const;
export const reviewStepLabels = {
  strategy: 'Comparando los asuntos y seleccionando el portafolio…',
  writer: 'Redactando el Audit con la selección guardada…',
  done: 'Revisando las fuentes, el Audit y el documento Word final…',
};

/** Only persisted editorial inputs; never accept a browser-supplied strategy. */
export function reviewPackage(submission: any, data: any, matters: any[]) {
  return {
    directory: submission.targetDirectory, practice_area: submission.practiceArea,
    jurisdiction: submission.guideRegion, firm_name: data.firm_name || data.firmName || '',
    research_period: data.research_period || null, current_band: submission.currentBand,
    ranking_edition: data.ranking_edition || 'current',
    ranking_jurisdiction: data.ranking_jurisdiction || submission.guideRegion?.split('—').pop()?.trim(),
    preferred_hero_id: data.user_selected_hero_id || null,
    b10_source: data.confirmed_source_b10 ?? data.original_b10 ?? '',
    b10_draft: data.enhanced_b7 || data.original_b10 || '',
    c2_source: data.original_c2 || '', c2_draft: data.enhanced_c2 || '',
    lawyers: data.lawyers || [], matters,
  };
}

export function reviewInputHash(payload: any) {
  const stable = (value: any): any => {
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
    }
  }
  // Portfolio selection compares mandates, not the candidate's biography.
  // Candidate corrections belong to the leadership letter and its review.
  if (stage === 'strategy') delete source.lawyers;
  return reviewInputHash({policy:'role-deliverables-v2-single-judge',stage,source,
    ...(stage !== 'strategy' ? {strategy:state.strategy} : {}),
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
  if (state.selection_validated === false) return {...base,stage:'strategy',step_keys:{},state:{
    selection_feedback:{strategy:state.strategy,errors:state.errors || []},
  }};
  if (!state.letter || keys.writer !== reviewStepHash('writer',payload,state)) {
    delete state.letter;delete state.judge;delete state.release_verdict;
    state.errors=[];state.writer_attempts=0;
    return {...base,stage:'writer',step_keys:{strategy:keys.strategy}};
  }
  return {...base,stage:'done'};
}
