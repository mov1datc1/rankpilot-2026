import {filingDetailsGaps,filingPreparationNeeded} from './filing-details';
import {needsInputReview,sourceReviewPending} from './input-review';

/** Shared by paid endpoints and Studio; draft saves remain independent. */
export function preparationInputIssues(data:any,matters:any[]=data?.matters || []):string[] {
  const issues=filingDetailsGaps(data);
  if(!issues.length && filingPreparationNeeded(data)) issues.push('Confirma las discrepancias de los datos del departamento.');
  if(sourceReviewPending(data)) issues.push('Resuelve las dudas de la fuente y de los perfiles.');
  const pending=matters.filter(needsInputReview).length;
  if(pending) issues.push(`${pending} asuntos con dudas, permisos o importes pendientes.`);
  return issues;
}
