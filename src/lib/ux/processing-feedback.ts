/** Product messages describe the outcome and recovery, never raw provider traces. */
export function processingFeedback(payload: any, status = 0, operation: 'extract' | 'review' | 'optimize' = 'extract') {
  const code = String(payload?.code || (status === 409 ? 'DRAFT_CONFLICT' : status === 401 ? 'SESSION_EXPIRED' : ''));
  if (code === 'NO_LEGAL_MATTERS') return 'No encontramos asuntos legales en estas fuentes. Añade un documento o notas que indiquen cliente, trabajo realizado y estado del asunto. El borrador guardado se conserva.';
  if (code === 'PARTIAL_EXTRACTION') {
    const sources=(payload?.source_errors || []).map((s:any)=>String(s.name || s.source || '')).filter(Boolean);
    return `No pudimos leer todas las fuentes${sources.length ? `: ${sources.join(', ')}` : ''}. Reemplaza los archivos indicados o verifica que puedan abrirse y vuelve a intentar. El borrador anterior se conserva.`;
  }
  if (code === 'DRAFT_CONFLICT') return 'Hay una versión más reciente del borrador. Copia cualquier cambio que aún no hayas guardado y recarga la página antes de continuar. No sobrescribimos la versión más reciente.';
  if (code === 'SESSION_EXPIRED') return 'Tu sesión terminó. Conserva las notas que aún no hayas guardado e inicia sesión de nuevo para continuar.';
  if (code === 'SOURCE_REQUIRED') return 'Falta el contenido de origen. Añade la descripción del departamento o los documentos del asunto antes de solicitar la redacción.';
  const action=operation==='extract'?'leer los documentos':operation==='review'?'terminar la revisión':'guardar una nueva redacción';
  return `No pudimos ${action}. La última versión guardada se conserva. Reintenta en unos momentos; una respuesta incompleta no se considera aprobada.`;
}
