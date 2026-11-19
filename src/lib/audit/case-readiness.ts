import { filingDetailsGaps } from './filing-details';
import { integrityChecks } from './integrity-checks';

/**
 * v1.0.106 (Jonathan, 19 Nov): after reading dispersed sources (Builder option
 * B: documents, pasted text, e-mails) the user must see what the case already
 * has, what is missing and what to do next, instead of wondering «¿y ahora
 * qué hago?». Deterministic and source-bound: it never invents a fact, never
 * blocks generation and never changes a value. Ramos Castillo Environment
 * (5 documents) had no lawyer profile, no department data and one form for
 * another practice; the Wizard showed this only as scattered small print.
 */
export type ReadinessItem = { kind: 'missing' | 'doubt' | 'check'; text: string };
export type ReadinessInput = {
  lawyers?: any[]; matters?: any[]; filingDetails?: any; b10Text?: string;
  sourceReports?: { source: string; matter_count?: number }[];
  scopeConfirmations?: { field: string; selected: string; detected: string; source: string }[];
};

export function caseReadiness(input: ReadinessInput): { items: ReadinessItem[]; nextStep: string } {
  const items: ReadinessItem[] = [];
  const lawyers = input.lawyers || [], matters = input.matters || [];
  if (!lawyers.length)
    items.push({ kind: 'missing', text: 'No encontramos perfiles de abogados en tus fuentes. Sin ellos la sección B9 quedará vacía y no habrá candidaturas individuales: sube sus biografías o pega el texto de sus perfiles.' });
  if (!String(input.b10Text || '').trim())
    items.push({ kind: 'missing', text: 'Falta una descripción del departamento (base del B10): pega un texto sobre la práctica, sus sectores y su equipo.' });
  const gaps = filingDetailsGaps(input.filingDetails || {});
  if (gaps.length)
    items.push({ kind: 'missing', text: `Datos administrativos del formulario sin completar: ${gaps.join('; ')}. Puedes completarlos en este asistente; no impiden preparar el análisis.` });
  if (matters.length && matters.length < 10)
    items.push({ kind: 'doubt', text: `Encontramos ${matters.length} asuntos. Chambers admite hasta 20: si tienes más mandatos relevantes de los últimos 12 meses, añádelos para elegir mejor la cartera.` });
  for (const report of input.sourceReports || []) {
    if ((report.matter_count ?? 0) === 0)
      items.push({ kind: 'doubt', text: `«${report.source}» no aportó asuntos. Revisa que sea la fuente correcta o si contiene otra información (perfiles, descripción del departamento).` });
  }
  for (const c of input.scopeConfirmations || [])
    items.push({ kind: 'doubt', text: `«${c.source}» indica ${c.field === 'practice_area' ? 'la práctica' : c.field === 'jurisdiction' ? 'la jurisdicción' : 'la guía'} «${c.detected}»; elegiste continuar con «${c.selected}». Revisa que su contenido corresponda a esa práctica.` });
  for (const text of integrityChecks({ numPartners: input.filingDetails?.numPartners, lawyers }, matters))
    items.push({ kind: 'check', text });
  const missing = items.filter(i => i.kind === 'missing').length;
  const nextStep = missing
    ? 'Completa lo que falta (o continúa si no lo tienes: RankPilot preparará los documentos con lo disponible y lo señalará en el Audit). Después confirma los asuntos y pulsa preparar.'
    : items.length
      ? 'Tu expediente tiene lo necesario. Revisa las dudas señaladas y después confirma los asuntos y pulsa preparar.'
      : 'Tu expediente tiene lo necesario para preparar los documentos. Confirma los asuntos y pulsa preparar.';
  return { items, nextStep };
}
