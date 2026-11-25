import { filingDetailsGaps } from './filing-details';
import { integrityChecks } from './integrity-checks';
import { editorialPreparationIssues, matterSourceText } from './preparation-input';

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
export type ReadinessVerdict = { status: 'blocked' | 'limited' | 'ready'; summary: string; limitations: string[] };
export type ReadinessInput = {
  firmName?: string; practiceArea?: string;
  lawyers?: any[]; matters?: any[]; filingDetails?: any; b10Text?: string;
  sourceReports?: { source: string; matter_count?: number }[];
  scopeConfirmations?: { field: string; selected: string; detected: string; source: string }[];
};

/**
 * v1.0.107 (Jonathan, 19 Nov): say whether the case can be generated now and
 * with what result. «blocked» uses the same rule that already blocks
 * preparation in Studio (editorialPreparationIssues), so the Wizard and Studio
 * never disagree. Missing administrative fields never lower the verdict: they
 * are needed to file with the directory, not to build a sound Audit/Submission.
 */
/**
 * v1.0.116: the directory form lets a firm answer B9 with a web link instead of
 * a biography. RankPilot does not read that link, so the lawyer reaches the
 * writer with mandates only: no career, education or offices held (real run:
 * five of five lawyers). Said before generating, never a block.
 */
const PROFILE_TEXT = ['bio', 'comments', 'key_focus', 'standout_work', 'standoutWork', 'credentials', 'professional_roles'];
export function lawyersWithLinkOnly(lawyers: any[]): string[] {
  return (lawyers || []).filter(l => /https?:\/\//i.test(String(l?.url || ''))
    && !PROFILE_TEXT.some(k => String(l?.[k] || '').replace(/https?:\/\/\S+/gi, '').trim()))
    .map(l => String(l?.name || l?.fullName || '').trim()).filter(Boolean);
}
const linkOnlyText = (names: string[], total: number) =>
  `${names.length} de ${total} abogado(s) traen en B9 solo un enlace, sin texto de biografía (${names.join(', ')}). RankPilot no lee el enlace: su B9 se redactará únicamente con los asuntos, sin trayectoria, formación ni cargos. Pega el texto de su perfil en el apartado de abogados para un B9 completo.`;

export function readinessVerdict(input: ReadinessInput): ReadinessVerdict {
  const matters = input.matters || [], lawyers = input.lawyers || [];
  const blocking = editorialPreparationIssues({ firm_name: input.firmName, practice_area: input.practiceArea, original_b10: input.b10Text }, matters);
  if (blocking.length)
    return { status: 'blocked', limitations: blocking,
      summary: 'Todavía no conviene generar: sin esta información el Audit y el Submission no serían aceptables. Complétala y vuelve a intentarlo.' };
  const limitations: string[] = [];
  if (!String(input.b10Text || '').trim()) limitations.push('No hay descripción de origen del departamento: el B10 y el C2 se construirán de forma preliminar solo con los asuntos acreditados, sin estructura, cargos ni capacidades que las fuentes no documenten. Revísalos con especial cuidado o añade la descripción.');
  if (!lawyers.length) limitations.push('El Submission saldrá sin B9 y el Audit sin estrategia individual por abogado; la cartera, el B10 y el C2 sí se desarrollan completos.');
  const linkOnly = lawyersWithLinkOnly(lawyers);
  if (linkOnly.length) limitations.push(linkOnlyText(linkOnly, lawyers.length));
  if (matters.length < 5) limitations.push(`Con ${matters.length} asunto(s) la cartera es corta: el Audit tendrá poco margen para elegir, comparar y justificar el asunto principal.`);
  if ((input.scopeConfirmations || []).length) limitations.push('Una fuente corresponde a otra práctica: su contenido solo se usará si es pertinente a la práctica elegida.');
  if (limitations.length)
    return { status: 'limited', limitations,
      summary: 'Puedes generar ya: el resultado será coherente con la información disponible, con estas limitaciones. Si añades lo que falta, el resultado será más completo.' };
  return { status: 'ready', limitations: [],
    summary: 'Listo para generar: tienes asuntos suficientes, perfiles de abogados y descripción del departamento para un Audit y un Submission completos.' };
}

const foldText = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * v1.0.114: the same mandate read from two versions of a form is one matter.
 * Same client and at least 80 % of shared words in the source text. Different
 * mandates of one client share the name but not the text, so they are not
 * grouped. Detection only: nothing is merged or removed.
 */
export function duplicateMatters(matters: any[]): { client: string; count: number; sources: string[] }[] {
  const groups: { client: string; words: Set<string>; members: any[] }[] = [];
  for (const m of matters || []) {
    const client = foldText(m?.client), words = new Set(foldText(matterSourceText(m)).split(' ').filter(w => w.length > 3));
    if (!client || words.size < 20) continue;
    const match = groups.find(g => g.client === client && (() => {
      let shared = 0; for (const w of words) if (g.words.has(w)) shared++;
      return shared / Math.min(words.size, g.words.size) >= 0.8;
    })());
    if (match) match.members.push(m); else groups.push({ client, words, members: [m] });
  }
  return groups.filter(g => g.members.length > 1).map(g => ({ client: String(g.members[0].client).trim(), count: g.members.length,
    sources: [...new Set(g.members.map(m => String(m.source_document || '').trim()).filter(Boolean))] }));
}

export function caseReadiness(input: ReadinessInput): { items: ReadinessItem[]; nextStep: string; verdict: ReadinessVerdict } {
  const items: ReadinessItem[] = [];
  const lawyers = input.lawyers || [], matters = input.matters || [];
  if (!lawyers.length)
    items.push({ kind: 'missing', text: 'No encontramos perfiles de abogados en tus fuentes. Sin ellos la sección B9 quedará vacía y no habrá candidaturas individuales: sube sus biografías o pega el texto de sus perfiles.' });
  const linkOnly = lawyersWithLinkOnly(lawyers);
  if (linkOnly.length) items.push({ kind: 'missing', text: linkOnlyText(linkOnly, lawyers.length) });
  if (!String(input.b10Text || '').trim())
    items.push({ kind: 'missing', text: 'Falta una descripción del departamento (base del B10). No impide generar: el B10 se construirá de forma preliminar a partir de los asuntos. Para un resultado más completo, pega un texto sobre la práctica, sus sectores y su equipo.' });
  const gaps = filingDetailsGaps(input.filingDetails || {});
  if (gaps.length)
    items.push({ kind: 'missing', text: `Datos administrativos del formulario sin completar: ${gaps.join('; ')}. Puedes completarlos en este asistente; no impiden preparar el análisis.` });
  if (matters.length && matters.length < 10)
    items.push({ kind: 'doubt', text: `Encontramos ${matters.length} asuntos. Chambers admite hasta 20: si tienes más mandatos relevantes de los últimos 12 meses, añádelos para elegir mejor la cartera.` });
  for (const report of input.sourceReports || []) {
    if ((report.matter_count ?? 0) === 0)
      items.push({ kind: 'doubt', text: `«${report.source}» no aportó asuntos propios. Si es un documento de respaldo (permiso, sentencia, resolución, contrato), todavía no se vincula solo a un asunto: copia en el asunto correspondiente los hechos, fechas o resultados que acredita. Si contiene perfiles o la descripción del departamento, pégalos en su apartado.` });
  }
  for (const group of duplicateMatters(matters))
    items.push({ kind: 'doubt', text: `«${group.client}» aparece ${group.count} veces con contenido casi idéntico (${group.sources.length ? group.sources.map(s => `«${s}»`).join(', ') : 'misma fuente'}): parece el mismo asunto en varias versiones. Conserva una sola antes de preparar para no contarlo dos veces.` });
  for (const c of input.scopeConfirmations || [])
    items.push({ kind: 'doubt', text: `«${c.source}» indica ${c.field === 'practice_area' ? 'la práctica' : c.field === 'jurisdiction' ? 'la jurisdicción' : 'la guía'} «${c.detected}»; elegiste continuar con «${c.selected}». Revisa que su contenido corresponda a esa práctica.` });
  for (const text of integrityChecks({ numPartners: input.filingDetails?.numPartners, lawyers }, matters))
    items.push({ kind: 'check', text });
  const verdict = readinessVerdict(input);
  // The next step follows the verdict, so it never invites generating a case
  // that Studio would not prepare.
  const nextStep = verdict.status === 'blocked'
    ? 'Completa primero la información indicada; después confirma los asuntos y pulsa preparar.'
    : verdict.status === 'limited'
      ? 'Si tienes lo que falta, añádelo para un resultado más completo; si no, confirma los asuntos y pulsa preparar: RankPilot generará con lo disponible y lo señalará en el Audit.'
      : items.length
        ? 'Revisa las dudas señaladas y después confirma los asuntos y pulsa preparar.'
        : 'Confirma los asuntos y pulsa preparar.';
  return { items, nextStep, verdict };
}
