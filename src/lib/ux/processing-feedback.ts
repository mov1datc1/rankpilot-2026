const sourceMessages: Record<string, string> = {
  "SOURCE_TOO_LARGE": "El archivo excede los límites de lectura. Divide el documento por asuntos (máximo 30 MB por archivo).",
  "SOURCE_UNSUPPORTED": "El contenido no es un DOCX, DOC, PDF o TXT compatible. Guarda una copia DOCX desde Word; renombrar la extensión no convierte el archivo.",
  "SOURCE_CORRUPT": "El archivo está dañado o tiene una estructura ilegible. Ábrelo en Word y guarda una nueva copia DOCX.",
  "SOURCE_ENCRYPTED": "El archivo está protegido con contraseña. Sube una copia sin contraseña.",
  "SOURCE_REVISIONS": "El Word contiene cambios controlados pendientes. Acepta o rechaza las revisiones y guarda una copia antes de subirla.",
  "SOURCE_EMBEDDED_CONTENT": "Hay contenido incrustado que no podemos leer íntegramente. Integra ese contenido como texto o tablas en un DOCX nuevo.",
  "SOURCE_OCR_REQUIRED": "Hay páginas del PDF sin texto legible. Sube el Word original o aplica OCR a todas las páginas y revisa el resultado.",
  "SOURCE_EMPTY": "El documento no contiene texto legible. Sube una versión con texto seleccionable y los asuntos completados.",
  "SOURCE_TEXT_DAMAGED": "El texto contiene caracteres dañados. Vuelve a exportar el documento desde el original.",
  "SOURCE_DOC_CONVERSION": "No pudimos convertir este Word antiguo con fiabilidad. Ábrelo en Word o LibreOffice y guárdalo como DOCX.",
  "SOURCE_UNREADABLE": "No pudimos abrir o descargar el archivo. Comprueba que abre correctamente y vuelve a cargarlo.",
  "SOURCE_DUPLICATE_LABELS": "Hay encabezados de asuntos repetidos. Corrige la numeración para evitar mezclar asuntos.",
  "SOURCE_INCOMPLETE_MATTERS": "Hay asuntos con datos pero sin descripción legible del trabajo realizado. Completa esas descripciones antes de continuar.",
  "SOURCE_UNGROUNDED_MATTERS": "No pudimos vincular los asuntos extraídos con fragmentos literales de la fuente. Sube el formulario DOCX completo o separa las notas por asunto.",
  "SOURCE_IDENTITY_CONFLICT": "Los documentos indican firmas distintas. Comprueba que todas las fuentes correspondan al mismo submission."
};

/** Product messages describe the outcome and recovery, never raw provider traces. */
export function processingFeedback(payload: any, status = 0, operation: 'extract' | 'review' | 'optimize' = 'extract') {
  const code = String(payload?.code || (status === 409 ? 'DRAFT_CONFLICT' : status === 401 ? 'SESSION_EXPIRED' : ''));
  if (code === 'SOURCE_PREFLIGHT_FAILED' || sourceMessages[code]) {
    const failures = Array.isArray(payload?.source_errors) ? payload.source_errors : [{code}];
    const details = failures.map((failure: any) => {
      const pages = Array.isArray(failure.pages) ? failure.pages.filter((page: any) => Number.isInteger(page) && page > 0) : [];
      return `${failure.source ? String(failure.source) + ': ' : ''}${sourceMessages[failure.code] || sourceMessages.SOURCE_UNREADABLE}${pages.length ? ' Páginas: ' + pages.join(', ') + '.' : ''}`;
    });
    return `${details.join(' ')} No iniciamos la revisión; el borrador guardado se conserva.`;
  }
  if (code === 'EXTRACTION_VALIDATION_REQUIRED') return 'La lectura no incluyó una comprobación de integridad completa. No abrimos el asistente ni reemplazamos tu borrador. Reintenta la extracción; si persiste, contacta con soporte.';
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
