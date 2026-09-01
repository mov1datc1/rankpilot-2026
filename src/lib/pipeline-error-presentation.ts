export type PipelineErrorPresentation = {
  kind: 'DOCUMENT_REVIEW_REQUIRED' | 'QUALITY_REVIEW_REQUIRED' | 'TEMPORARY_PROCESSING_ISSUE';
  title: string;
  message: string;
  nextStep: string;
  reference: string;
  canRetry: boolean;
};

function collectDetailStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectDetailStrings);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(collectDetailStrings);
  }
  return [];
}

function formatSpanishList(values: number[]): string {
  const labels = values.map(String);
  if (labels.length <= 1) return labels[0] || '';
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}`;
}

function extractMatterNumbers(error: unknown): number[] {
  const raw = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : { message: error };
  const text = collectDetailStrings([raw.details, raw.errors, raw.message]).join(' ');
  const matches = [...text.matchAll(/matter[- _]?0*(\d+)/gi)];
  return [...new Set(matches.map((match) => Number(match[1])).filter(Number.isFinite))]
    .sort((a, b) => a - b);
}

export function getPipelineErrorPresentation(error: unknown): PipelineErrorPresentation {
  const raw = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : { message: error };
  const code = String(raw.code || '').toUpperCase();
  const details = collectDetailStrings([raw.details, raw.message]).join(' ').toLowerCase();
  const matterNumbers = extractMatterNumbers(raw);
  const isDocumentReview = (
    code === 'PRE_FLIGHT_FAILED'
    || code === 'SOURCE_VALIDATION_FAILED'
    || details.includes('missing verbatim source evidence')
    || details.includes('source matter count unavailable')
  );

  if (isDocumentReview) {
    const affected = matterNumbers.length
      ? matterNumbers.length === 1
        ? ` del asunto ${formatSpanishList(matterNumbers)}`
        : ` de los asuntos ${formatSpanishList(matterNumbers)}`
      : ' de algunos asuntos';
    return {
      kind: 'DOCUMENT_REVIEW_REQUIRED',
      title: 'Necesitamos verificar parte del documento',
      message: `No pudimos confirmar el contenido fuente${affected} dentro del archivo Word. Para proteger la exactitud del análisis, RankPilot detuvo la generación y no creó entregables con información incompleta.`,
      nextStep: 'Revisa que cada asunto tenga un encabezado y una descripción visibles. Guarda una nueva copia en formato DOCX y vuelve a cargarla.',
      reference: 'RP-DOC-01',
      canRetry: false,
    };
  }

  const isQualityReview = (
    code.includes('CONSTITUTIONAL')
    || code.includes('RELEASE_NOT_APPROVED')
    || details.includes('did not approve this candidate')
    || details.includes('artifact validation')
  );
  if (isQualityReview) {
    return {
      kind: 'QUALITY_REVIEW_REQUIRED',
      title: 'No pudimos completar la revisión final',
      message: 'RankPilot terminó el análisis, pero la revisión final no pudo confirmar todos los cambios con el nivel de seguridad requerido. Para proteger la exactitud, no publicamos entregables parciales y tu archivo original permanece intacto.',
      nextStep: 'No necesitas modificar ni volver a cargar el archivo todavía. Intenta procesarlo nuevamente; si vuelve a ocurrir, comparte la referencia con soporte.',
      reference: 'RP-REVIEW-01',
      canRetry: true,
    };
  }

  return {
    kind: 'TEMPORARY_PROCESSING_ISSUE',
    title: 'No pudimos completar el análisis',
    message: 'El procesamiento se interrumpió antes de generar los entregables. Tu archivo original no fue modificado.',
    nextStep: 'Intenta nuevamente. Si el mensaje vuelve a aparecer, comparte la referencia con soporte.',
    reference: 'RP-PROCESS-01',
    canRetry: true,
  };
}
