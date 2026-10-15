import {filingDetailsGaps} from './filing-details';
import {needsInputReview,sourceReviewPending} from './input-review';

/**
 * Validates requirements for strategic AI optimization and audit generation.
 * Administrative filing details (like A4 interview contacts or headcount) are optional
 * during strategic reasoning and do NOT block optimization or audit generation.
 */
export function preparationInputIssues(data:any,matters:any[]=data?.matters || []):string[] {
  const issues: string[] = [];
  const firm = data?.firm_name || data?.firmName || data?.firm;
  const practice = data?.practice_area || data?.practiceArea || data?.practice || data?.metadata?.extracted_practice_area || data?.metadata?.calibrated_practice_area;
  if (!firm || !String(firm).trim()) issues.push('Indica el nombre de la firma.');
  if (!practice || !String(practice).trim()) issues.push('Indica el área de práctica.');
  if (!matters.length) issues.push('No hay asuntos cargados en el expediente.');
  if (matters.length && matters.every(m => !String(m.source_excerpt || m.rawNotes || m.summary || m.notes || '').trim())) {
    issues.push('Falta describir el trabajo realizado en los asuntos cargados.');
  }
  return issues;
}

export function officialFilingGaps(data:any):string[] {
  return filingDetailsGaps(data);
}
