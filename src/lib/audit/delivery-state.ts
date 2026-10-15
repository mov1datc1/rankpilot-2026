import { publicationStatus, valueConflict, validValueResolution, pendingExtractionIssues } from './input-review';
import { REVIEW_CONTRACT } from './review-versions';
import {preparationInputIssues, officialFilingGaps} from './preparation-input';
/** Shared by Studio and the download endpoint. Optimization is not approval. */
export function getDeliveryState(data: any, matters: any[] = data?.matters || [], requireArtifact = false, expectedContract = REVIEW_CONTRACT) {
  const verdict = data?.release_verdict || {};
  const errors: string[] = preparationInputIssues(data || {},matters);
  if (requireArtifact) {
    const gaps = officialFilingGaps(data || {});
    if (gaps.length) {
      errors.push(`Campos pendientes para plantilla oficial: ${gaps.join('; ')}.`);
    }
  }
  if (data?.filing_reviewed !== true && Object.values(data?.filing_field_status || {}).includes('conflicting')) {
    errors.push('Confirma las discrepancias contradictorias de los datos del departamento antes de la entrega final.');
  }
  if (verdict.passed !== true || (verdict.status && !['passed', 'approved'].includes(verdict.status))) {
    if (!verdict.errors?.length) errors.push(data?.editorial_review ? 'Reintenta la revisión editorial para evaluar el borrador actual.' : 'La revisión editorial se ejecutará después de guardar la redacción.');
  }
  const isUnrankedClaim = (claim?: string | null) => !claim || /^(?:unranked|not ranked|sin ranking|none|n\/?a|primera inclusi[oó]n|first-time candidate)$/i.test(String(claim).trim());
  if (Array.isArray(verdict.errors) && verdict.errors.length) {
    const details = verdict.errors.map(String).filter((message:string)=>{
      if (message === 'La revisión final está pendiente o tiene bloqueos.') return false;
      if (isUnrankedClaim(data?.ranking_claim || data?.current_band) && /posici[oó]n declarada/i.test(message)) return false;
      return true;
    });
    if (details.length) errors.push(...details);
  }
  if (data?.ranking_claim && !isUnrankedClaim(data.ranking_claim) && data?.ranking_verification?.status !== 'verified_match') errors.push('La posición declarada requiere verificación oficial o resolver una discrepancia.');
  for (const lawyer of data?.lawyers || []) {
    const resolution = lawyer.roleResolution;
    if (resolution && (resolution.confirmed !== true || !resolution.reason?.trim() || resolution.role !== lawyer.role || lawyer.isPartner !== (lawyer.role === 'Partner'))) {
      errors.push(`Confirma el cargo y su fuente para ${lawyer.name || lawyer.fullName || 'el abogado'} antes de aprobar la entrega.`);
    }
  }
  if ([data?.source_fact_review,...(data?.lawyers || []),...matters].some(record=>pendingExtractionIssues(record).length)) errors.push('Resuelve las dudas de extracción pendientes antes de aprobar la entrega.');
  if (!matters.length) errors.push('No hay asuntos disponibles.');
  const ids = matters.map(m => m.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.push('Hay asuntos duplicados en el expediente.');
  if (matters.some(m => publicationStatus(m) === 'confirmation_required')) {
    errors.push('Confirma los permisos de publicación de los asuntos pendientes.');
  }
  if (matters.some(m => valueConflict(m) || (m.valueResolution && !validValueResolution(m)))) errors.push('Resuelve los importes o monedas contradictorios antes de la entrega final.');
  if (requireArtifact && !data?.approved_artifact?.input_hash) errors.push('Genera y revisa el archivo final antes de descargar.');
  if (requireArtifact && data?.approved_artifact?.input_hash && (data.completed_review_policy_version !== expectedContract.policy || data.completed_renderer_version !== expectedContract.renderer || data.completed_artifact_review_version !== expectedContract.artifact)) errors.push('Los documentos guardados corresponden a una revisión anterior. Prepara Submission y Audit para comprobar la versión actual.');
  const warnings = (data?.final_artifact_review?.judge?.defects || []).filter((d:any)=>d.severity==='warning').map((d:any)=>String(d.message));
  return { approved: errors.length === 0, errors: [...new Set(errors)], warnings, label: errors.length ? 'Revisión pendiente' : warnings.length ? 'Revisión aprobada con observaciones' : 'Revisión aprobada' };
}
