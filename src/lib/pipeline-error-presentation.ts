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

function formatEnglishList(values: number[]): string {
  const labels = values.map(String);
  if (labels.length <= 1) return labels[0] || '';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
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
  const isGeneratedDeliverable = (
    details.includes('rankpilot-generated')
    || details.includes('generated positioning detected')
    || details.includes('generated output filename detected')
  );

  if (isGeneratedDeliverable) {
    return {
      kind: 'DOCUMENT_REVIEW_REQUIRED',
      title: 'Please upload the original source document',
      message: 'This file appears to be a previously generated RankPilot deliverable. Reprocessing a generated submission can duplicate edits and weaken source accuracy, so RankPilot stopped before starting the analysis.',
      nextStep: 'Upload the original Chambers submission completed by the firm, before any RankPilot optimization. You do not need to delete this report.',
      reference: 'RP-SOURCE-02',
      canRetry: false,
    };
  }
  const isDocumentReview = (
    code === 'PRE_FLIGHT_FAILED'
    || code === 'SOURCE_VALIDATION_FAILED'
    || details.includes('missing verbatim source evidence')
    || details.includes('source matter count unavailable')
  );

  if (isDocumentReview) {
    const affected = matterNumbers.length
      ? matterNumbers.length === 1
        ? ` for matter ${formatEnglishList(matterNumbers)}`
        : ` for matters ${formatEnglishList(matterNumbers)}`
      : ' for some matters';
    return {
      kind: 'DOCUMENT_REVIEW_REQUIRED',
      title: 'Part of the document needs review',
      message: `RankPilot could not confirm the source content${affected} in the Word file. To protect accuracy, processing stopped before creating deliverables from incomplete information.`,
      nextStep: 'Make sure each matter has a visible heading and description. Save a new DOCX copy and upload it again.',
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
      title: 'The final review could not be completed',
      message: 'RankPilot completed the analysis, but the final review could not verify every change with the required confidence. To protect accuracy, no partial deliverables were published and your original file remains unchanged.',
      nextStep: 'You do not need to edit or upload the file again yet. Retry processing; if this happens again, share the reference with support.',
      reference: 'RP-REVIEW-01',
      canRetry: true,
    };
  }

  return {
    kind: 'TEMPORARY_PROCESSING_ISSUE',
    title: 'The analysis could not be completed',
    message: 'Processing stopped before the deliverables were generated. Your original file was not changed.',
    nextStep: 'Try again. If this message appears again, share the reference with support.',
    reference: 'RP-PROCESS-01',
    canRetry: true,
  };
}
