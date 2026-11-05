import {filingDetailsGaps} from './filing-details';
import {valueConflict,validValueResolution,pendingExtractionIssues} from './input-review';

export function matterSourceText(m:any):string {
  return ['source_excerpt','rawNotes','summary','notes','description'].map(key=>String(m?.[key] || '')).find(text=>text.trim()) || '';
}

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
  if (matters.length && matters.every(m => !matterSourceText(m))) {
    issues.push('Falta describir el trabajo realizado en los asuntos cargados.');
  } else for(const [index,m] of matters.entries()) {
    if(!matterSourceText(m)) issues.push(`Falta la fuente del trabajo realizado en ${m.client || m.name || `el asunto ${index+1}`}. Añádela antes de preparar los documentos.`);
  }
  if(matters.some(m=>valueConflict(m) && !validValueResolution(m))) issues.push('Resuelve los importes o monedas contradictorios antes de preparar los documentos.');
  if(matters.some(m=>pendingExtractionIssues(m).length)) issues.push('Revisa las discrepancias de extracción de los asuntos antes de preparar los documentos.');
  return issues;
}

/** Paid preparation must not discover this requirement only after drafting. */
export function editorialPreparationIssues(data:any,matters:any[]=data?.matters || []):string[] {
  const issues=preparationInputIssues(data,matters);
  if(!String(data?.confirmed_source_b10 ?? data?.original_b10 ?? '').trim())
    issues.push('Añade la descripción de origen del departamento en «Revisar expediente» antes de preparar los documentos. Incluye solo capacidades y responsables acreditados.');
  return issues;
}

export function officialFilingGaps(data:any):string[] {
  return filingDetailsGaps(data);
}
