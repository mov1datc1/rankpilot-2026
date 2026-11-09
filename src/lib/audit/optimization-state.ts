/** Imported B10 may already occupy enhanced_b7; that is not optimization provenance. */
export function needsB10Optimization(data: any, text: string): boolean {
  const source = String(data?.confirmed_source_b10 ?? data?.original_b10 ?? '').trim();
  const current = text.trim();
  if (!current) return Boolean(source);
  const record = data?.b10_optimization;
  if (record?.source === source && record?.text === current) return false;
  // Preserve existing edited/optimized legacy prose; do not overwrite user work on resume.
  return current === source;
}
export function hasValidatedSelection(data: any): boolean {
  return Boolean(data?.canonical_matter_selection &&
    (data?.editorial_review?.selection_validated === true ||
      (data?.editorial_review?.selection_validated === undefined && data?.editorial_review?.letter && data?.editorial_review?.judge)));
}

/** Saved internal work is progress, not approved prose in the public editor. */
export function savedPreparationProgress(data:any,sourceMatches:boolean|null|undefined,edited=false) {
  const state=data?.review_checkpoint?.state;
  if(sourceMatches!==true || edited || state?.selection_validated!==true
    || state?.selection_review_validated!==true)return null;
  const ids=new Set((state.strategy?.matters || []).filter((m:any)=>m.disposition==='core').map((m:any)=>m.matter_id));
  if(!ids.size)return null;
  const prepared=new Set((state.development?.matters || []).filter((m:any)=>ids.has(m.matter_id) && String(m.text || '').trim()).map((m:any)=>m.matter_id));
  return {selected:ids.size,prepared:prepared.size,hasB10:!!String(state.development?.b10 || '').trim()};
}
