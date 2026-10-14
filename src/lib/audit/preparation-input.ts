import {filingDetailsGaps} from './filing-details';
import {needsInputReview,sourceReviewPending} from './input-review';

/**
 * Validates requirements for strategic AI optimization and audit generation.
 * Administrative filing details (like A4 interview contacts or headcount) are optional
 * during strategic reasoning and do NOT block optimization or audit generation.
 */
export function preparationInputIssues(data:any,matters:any[]=data?.matters || []):string[] {
  const issues: string[] = [];
  const firm = data?.firm_name || data?.firmName;
  const practice = data?.practice_area || data?.practiceArea;
  if (!firm || !String(firm).trim()) issues.push('Indica el nombre de la firma.');
  if (!practice || !String(practice).trim()) issues.push('Indica el área de práctica.');
  if (!matters.length) issues.push('No hay asuntos cargados en el expediente.');

  if (data?.filing_reviewed !== true && Object.values(data?.filing_field_status || {}).includes('conflicting')) {
    issues.push('Confirma las discrepancias contradictorias de los datos del departamento.');
  }
  if (sourceReviewPending(data)) issues.push('Resuelve las dudas críticas de la fuente y de los perfiles.');
  const pending = matters.filter(needsInputReview).length;
  if (pending) issues.push(`${pending} asuntos con dudas, permisos o importes pendientes.`);
  return issues;
}

export function officialFilingGaps(data:any):string[] {
  return filingDetailsGaps(data);
}
