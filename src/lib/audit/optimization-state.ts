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
