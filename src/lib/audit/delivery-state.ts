import { publicationStatus, valueConflict, validValueResolution, pendingExtractionIssues } from './input-review';
import { REVIEW_CONTRACT } from './review-versions';
import {preparationInputIssues, officialFilingGaps} from './preparation-input';
export interface DeliveryStateResult {
  approved: boolean;
  available: boolean;
  hasObservations: boolean;
  errors: string[];
  warnings: string[];
  label: string;
}

/** Shared by Studio and the download endpoint. Optimization is not approval. */
export function getDeliveryState(data: any, matters: any[] = data?.matters || [], requireArtifact = false, expectedContract = REVIEW_CONTRACT): DeliveryStateResult {
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
  const reviewRejected = verdict.passed !== true || (verdict.status && !['passed', 'approved'].includes(verdict.status));
  const isUnrankedClaim = (claim?: string | null) => !claim || /^(?:unranked|not ranked|sin ranking|none|n\/?a|primera inclusi[oó]n|first-time candidate)$/i.test(String(claim).trim());
  if (Array.isArray(verdict.errors) && verdict.errors.length) {
    const details = verdict.errors.map(String).filter((message:string)=>{
      if (message === 'La revisión final está pendiente o tiene bloqueos.') return false;
      if (isUnrankedClaim(data?.ranking_claim || data?.current_band) && /posici[oó]n declarada/i.test(message)) return false;
      if (message.startsWith('La aceptación editorial no está completa:')) return false;
      return true;
    });
    if (details.length) errors.push(...details);
  }
  // Hiding a technical summary must never turn a rejection into approval.
  if (reviewRejected && !errors.length) errors.push(data?.editorial_review ? 'La revisión editorial del contenido actual sigue pendiente.' : 'La revisión editorial se ejecutará después de guardar la redacción.');
  if (requireArtifact && data?.ranking_claim && !isUnrankedClaim(data.ranking_claim) && !['verified_match','verified_unranked'].includes(data?.ranking_verification?.status)) {
    errors.push('La posición declarada requiere verificación oficial o resolver una discrepancia.');
  }
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
  if (data?.restricted_delivery_policy !== 'restricted-unconfirmed-v1' && matters.some(m => publicationStatus(m) === 'confirmation_required')) {
    errors.push('Confirma los permisos de publicación de los asuntos pendientes.');
  }
  if (matters.some(m => valueConflict(m) || (m.valueResolution && !validValueResolution(m)))) errors.push('Resuelve los importes o monedas contradictorios antes de la entrega final.');
  if (requireArtifact && !data?.approved_artifact?.input_hash && !data?.available_artifact?.input_hash) errors.push('Genera y revisa el archivo final antes de descargar.');
  if (requireArtifact && data?.approved_artifact?.input_hash && (data.completed_review_policy_version !== expectedContract.policy || data.completed_renderer_version !== expectedContract.renderer || data.completed_artifact_review_version !== expectedContract.artifact)) errors.push('Los documentos guardados corresponden a una revisión anterior. Prepara Submission y Audit para comprobar la versión actual.');
  const warnings: string[] = (data?.final_artifact_review?.judge?.defects || []).filter((d:any)=>d.severity==='warning').map((d:any)=>String(d.message));
  if(data?.restricted_delivery_policy === 'restricted-unconfirmed-v1' && matters.some(m=>publicationStatus(m)==='confirmation_required')) warnings.push('Los asuntos sin permiso confirmado se entregan únicamente como confidenciales; su publicación sigue pendiente.');
  const dirLabel = /500/i.test(data?.targetDirectory || data?.directory || '') ? 'The Legal 500' : 'Chambers';
  if (isUnrankedClaim(data?.ranking_claim || data?.current_band)) {
    if (data?.ranking_verification?.status === 'verified_unranked' || data?.ranking_verification?.message) {
      warnings.push(data.ranking_verification.message || `No se encontró una coincidencia exacta de la firma en la tabla consultada de ${dirLabel}. Comprueba la práctica, el país y la edición antes de mencionar un ranking; esta consulta no acredita ausencia de reconocimiento en otras tablas.`);
    }
  } else if (data?.ranking_verification?.status === 'verified_mismatch') {
    warnings.push(data.ranking_verification.message || `Discrepancia detectada en ${dirLabel}: declaraste posición ${data?.ranking_claim || data?.current_band}, pero la consulta oficial muestra ${data?.ranking_verification?.observed_band}. Puedes definir o confirmar esta posición en Verificación de ranking.`);
  }
  const pair=data?.available_artifact || data?.approved_artifact || data?.draft_artifact;
  const available=!!(pair?.base64 && pair?.audit_base64 && pair?.input_hash)
    && data?.final_review_stale!==true
    && (pair.review_revision===undefined || pair.review_revision===data?.draft_revision)
    && data?.completed_review_policy_version===expectedContract.policy
    && data?.completed_renderer_version===expectedContract.renderer
    && data?.completed_artifact_review_version===expectedContract.artifact;
  const hasObservations=errors.length>0 || warnings.length>0 || pair?.observation_status==='with_observations';
  return { available,hasObservations,approved: errors.length === 0, errors: Array.from(new Set(errors)), warnings: Array.from(new Set(warnings)), label:available ? `Documentos disponibles · ${hasObservations?'con observaciones':'sin observaciones'}` : 'Preparación de documentos' };
}
