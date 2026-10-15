const sourceMessages: Record<string, string> = {
  "SOURCE_DIRECTORY_UNKNOWN": "No se reconoció el membrete o formato oficial del directorio en este archivo. Asegúrate de subir la plantilla oficial del directorio seleccionado o utiliza la 'Modalidad B: Documentos Dispersos' para subir notas y fuentes libres.",
  "SOURCE_DIRECTORY_MISMATCH": "El documento cargado pertenece a otro directorio. Sube la plantilla oficial correspondiente o ajusta el directorio en el paso de calibración.",
  "SOURCE_TOO_LARGE": "El archivo excede el límite máximo de lectura (30 MB). Divide el documento por asuntos antes de subirlo.",
  "SOURCE_UNSUPPORTED": "El archivo no tiene un formato compatible (DOCX, DOC o PDF). Por favor abre el documento en Word y guárdalo como DOCX.",
  "SOURCE_CORRUPT": "El archivo presenta daños en su estructura interna. Ábrelo en Word y guárdalo como una copia nueva en formato DOCX.",
  "SOURCE_ENCRYPTED": "El archivo está protegido con contraseña. Por favor sube una copia sin contraseña.",
  "SOURCE_REVISIONS": "El archivo contiene control de cambios pendientes. Acepta o rechaza las revisiones en Word y guarda una copia antes de cargarlo.",
  "SOURCE_EMBEDDED_CONTENT": "El archivo contiene objetos incrustados no legibles. Transforma el contenido a texto o tablas nativas en Word.",
  "SOURCE_OCR_REQUIRED": "El PDF contiene imágenes sin texto seleccionable. Aplica OCR o sube el documento Word original.",
  "SOURCE_EMPTY": "No se encontró texto en el documento. Sube un archivo con los asuntos y campos completados.",
  "SOURCE_TEXT_DAMAGED": "El texto contiene caracteres ilegibles o corruptos. Vuelve a exportar el documento desde Word.",
  "SOURCE_DOC_CONVERSION": "No pudimos convertir este archivo Word antiguo (.doc). Guárdalo como .docx moderno desde Word antes de subirlo.",
  "SOURCE_UNREADABLE": "No fue posible leer el archivo. Comprueba que no esté dañado y vuelve a intentarlo.",
  "SOURCE_DUPLICATE_LABELS": "Existen números de asunto duplicados en el documento. Corrige la numeración de los asuntos.",
  "SOURCE_INCOMPLETE_MATTERS": "Hay asuntos sin una descripción suficiente del trabajo realizado. Completa la narrativa de los asuntos.",
  "SOURCE_UNGROUNDED_MATTERS": "No pudimos vincular los asuntos con el contenido del documento. Sube la plantilla completa con los mandatos desarrollados.",
  "SOURCE_IDENTITY_CONFLICT": "Los documentos cargados mencionan firmas de abogados diferentes. Asegúrate de que correspondan al mismo despacho."
};

function formatSourceName(source?: string): string {
  if (!source) return '';
  const s = String(source).trim();
  if (s.length > 40) {
    const ext = s.includes('.') ? '.' + s.split('.').pop() : '';
    return `"${s.slice(0, 32)}…${ext}": `;
  }
  return `"${s}": `;
}

/** Product messages describe the outcome and recovery, never raw provider traces. */
export function processingFeedback(payload: any, status = 0, operation: 'extract' | 'review' | 'optimize' = 'extract') {
  const code = String(payload?.code || (status === 409 ? 'DRAFT_CONFLICT' : status === 401 ? 'SESSION_EXPIRED' : ''));
  if (code === 'SCOPE_CONFLICT' || code === 'SCOPE_REQUIRED') return Array.isArray(payload?.issues) && payload.issues.length ? payload.issues.map((issue: any)=>String(issue.message || '')).join(' ') : 'Revisa el directorio, la práctica y la jurisdicción seleccionados y su correspondencia con el documento.';
  if (code === 'FILING_RECONCILIATION_UNAVAILABLE' || code === 'SOURCE_RECONCILIATION_UNAVAILABLE') return 'El documento se leyó correctamente, pero el contraste con IA requiere un reintento. Tu borrador está guardado; vuelve a intentar la extracción.';
  if (code === 'AI_CREDIT_EXHAUSTED') return 'El proveedor de IA no tiene crédito disponible. Por favor contacta al administrador para revisar la facturación.';
  if (code === 'AI_OUTPUT_LIMIT') return 'La respuesta superó el límite de tokens. Tu avance está guardado; contacta a soporte para calibrar esta etapa.';
  if (code === 'AI_REVIEW_UNAVAILABLE') return 'Esta etapa de análisis no concluyó. Tu avance se conserva; por favor espera unos momentos antes de reintentar.';
  if (code === 'SOURCE_PREFLIGHT_FAILED' || sourceMessages[code]) {
    const failures = Array.isArray(payload?.source_errors) ? payload.source_errors : [{code}];
    const details = failures.map((failure: any) => {
      const srcPrefix = formatSourceName(failure.source);
      if (failure.code === 'SOURCE_DIRECTORY_MISMATCH' && failure.detected && failure.selected) {
        return `${srcPrefix}La plantilla corresponde a ${failure.detected}, pero seleccionaste ${failure.selected}. Sube la plantilla de ${failure.selected} o cambia el directorio en la calibración.`;
      }
      const pages = Array.isArray(failure.pages) ? failure.pages.filter((page: any) => Number.isInteger(page) && page > 0) : [];
      return `${srcPrefix}${sourceMessages[failure.code] || sourceMessages.SOURCE_UNREADABLE}${pages.length ? ' (Páginas: ' + pages.join(', ') + ')' : ''}`;
    });
    return details.join(' ');
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
