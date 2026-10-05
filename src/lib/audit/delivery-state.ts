import { publicationStatus, valueConflict, validValueResolution } from './input-review';
/** Shared by Studio and the download endpoint. Optimization is not approval. */
export function getDeliveryState(data: any, matters: any[] = data?.matters || [], requireArtifact = false) {
  const verdict = data?.release_verdict || {};
  const errors: string[] = [];
  if (verdict.passed !== true || (verdict.status && !['passed', 'approved'].includes(verdict.status))) {
    if (!verdict.errors?.length) errors.push(data?.editorial_review ? 'Reintenta la revisión editorial para evaluar el borrador actual.' : 'La revisión editorial se ejecutará después de guardar la redacción.');
  }
  if (Array.isArray(verdict.errors) && verdict.errors.length) {
    const details = verdict.errors.map(String).filter((message:string)=>message !== 'La revisión final está pendiente o tiene bloqueos.');
    errors.push(...(details.length ? details : ['La revisión editorial del borrador está pendiente.']));
  }
  if (data?.editorial_review?.selection_validated === false && !errors.length) errors.push('La selección de asuntos aún no ha superado la revisión de fuentes.');
  if (data?.ranking_claim && data?.ranking_verification?.status !== 'verified_match') errors.push('La posición declarada requiere verificación oficial o resolver una discrepancia.');
  if (!matters.length) errors.push('No hay asuntos disponibles.');
  const ids = matters.map(m => m.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.push('Hay asuntos duplicados en el expediente.');
  if (matters.some(m => publicationStatus(m) === 'confirmation_required')) {
    errors.push('Confirma los permisos de publicación de los asuntos pendientes.');
  }
  if (matters.some(m => valueConflict(m) || (m.valueResolution && !validValueResolution(m)))) errors.push('Resuelve los importes o monedas contradictorios antes de la entrega final.');
  if (requireArtifact && !data?.approved_artifact?.input_hash) errors.push('Genera y revisa el archivo final antes de descargar.');
  const warnings = (data?.final_artifact_review?.judge?.defects || []).filter((d:any)=>d.severity==='warning').map((d:any)=>String(d.message));
  return { approved: errors.length === 0, errors: [...new Set(errors)], warnings, label: errors.length ? 'Revisión pendiente' : warnings.length ? 'Revisión aprobada con observaciones' : 'Revisión aprobada' };
}
