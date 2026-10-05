/** Shared by the guided review and persistence. Unknown permission is never public. */
export function publicationStatus(m: any): string {
  if (m.confidentialityConfirmed === false || [m.publish_status, m.confidentialityStatus, m.confidentiality_status, m.publishStatus].includes('confirmation_required')) return 'confirmation_required';
  if (m.isConfidential === true || m.is_confidential === true || m.confidential === true || ['confidential', 'non_publishable'].includes(m.publish_status) || [m.confidentialityStatus, m.confidentiality_status, m.publishStatus].includes('confidential')) return 'confidential';
  if (m.isConfidential === false || m.is_confidential === false || [m.publish_status, m.confidentialityStatus, m.confidentiality_status, m.publishStatus].includes('publishable')) return 'publishable';
  return 'confirmation_required';
}

export function confirmPublicationStatus(m: any, status: string) {
  const confidential = status !== 'publishable';
  return {...m, isConfidential: confidential, confidential, is_confidential: confidential,
    confidentialityConfirmed: status !== 'confirmation_required', confidentialityStatus: status,
    confidentiality_status: status, publish_status: status, publishStatus: status};
}

export function valueConflict(m: any): string {
  return String(m.valueConflict || m.value_conflict || m.sourceValueConflict || '');
}

/** Offer only alternatives explicitly labelled by the extractor; never infer an FX rate. */
export function valueAlternatives(m: any): {label: string; value: string}[] {
  const match = valueConflict(m).match(/between table \((.+?)\) and narrative \((.+?)\)/i);
  if (!match) return [];
  return [{label: 'Monto de la tabla', value: match[1]}, {label: 'Monto de la narrativa', value: match[2]}]
    .map(option => ({...option, value: option.value.replace(/^US\$\s*/i, 'USD ')}));
}

export function validValueResolution(m: any): boolean {
  const r = m.valueResolution;
  return r?.confirmed === true && typeof r.value === 'string' && r.value.trim() === String(m.value || '').trim()
    && /\d/.test(r.value) && /\b[A-Z]{3}\b/.test(r.value)
    && typeof r.reason === 'string' && r.reason.trim().length > 0;
}

export function needsInputReview(m: any): boolean {
  return publicationStatus(m) === 'confirmation_required' || ((!!valueConflict(m) || !!m.valueResolution) && !validValueResolution(m));
}

/** Preserve the original discrepancy; clear active blockers only after an explicit resolution. */
export function persistInputReview(m: any, previous?: any) {
  // A saved confidential matter cannot be made public by a review payload.
  const status = previous && publicationStatus(previous) === 'confidential' ? 'confidential' : publicationStatus(m);
  let reviewed = confirmPublicationStatus(m, status);
  const conflict = valueConflict(previous || {}) || valueConflict(m);
  if (conflict) {
    if (validValueResolution(m)) {
      reviewed = {...reviewed, valueConflict: '', value_conflict: '', sourceValueConflict: '',
        matter_value: m.value, valueResolution: {...m.valueResolution, originalConflict: conflict},
        optimizedText: '', optimized_text: '', status: 'Draft'};
    } else {
      reviewed = {...reviewed, valueConflict: conflict, value_conflict: conflict};
    }
  } else if (previous?.valueResolution && !validValueResolution(m)) {
    reviewed = {...reviewed, valueConflict: previous.valueResolution.originalConflict || 'El monto cambió después de confirmarlo. Revisa de nuevo su fuente.'};
  }
  if (previous && previous.value !== reviewed.value) {
    reviewed = {...reviewed, optimizedText: '', optimized_text: '', status: 'Draft'};
  }
  return reviewed;
}

/** Cards must never present an unresolved source alternative as the selected amount. */
export function hasPendingValue(m: any): boolean {
  return (!!valueConflict(m) || !!m.valueResolution) && !validValueResolution(m);
}

export function displayedMatterValue(m: any): string {
  return hasPendingValue(m) ? 'Por definir' : String(m.value || '').trim() || 'No informado';
}
