import { createHash } from 'node:crypto';

export const reviewSteps = ['strategy', 'writer', 'editor', 'done'] as const;
export const reviewStepLabels = {
  strategy: 'Comparando los asuntos y seleccionando el portafolio…',
  writer: 'Redactando el Audit con la selección guardada…',
  editor: 'Comprobando fuentes, roles y coherencia editorial…',
  done: 'Revisando el documento Word final…',
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
  return createHash('sha256').update(JSON.stringify(stable({version: 2, payload}))).digest('hex');
}
