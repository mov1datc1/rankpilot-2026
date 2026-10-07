import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign, TableLayoutType
} from 'docx';
import { curateMatters } from '@/lib/docx/matter-curator';
import { normalizeLetterSections } from '@/lib/audit/letter-sections';
import { resolveCountryJurisdiction } from './submission-builder';

const NAVY = '1B365D';
const GRAY = '475569';
const LIGHT_GRAY = '666666';
const HEADER_BG = 'E8EAF6';
const CONTENT_WIDTH_DXA = 9360;

function p(text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean; spacing?: any; alignment?: any } = {}): Paragraph {
  return new Paragraph({
    children: text.split(/(\*\*[^*\n]+\*\*)/g).filter(Boolean).map(part => new TextRun({
      text: part.startsWith('**') && part.endsWith('**') ? part.slice(2,-2) : part,
      bold: opts.bold || (part.startsWith('**') && part.endsWith('**')),
      size: opts.size || 22, color: opts.color, italics: opts.italics,
    })),
    spacing: opts.spacing || { after: 60 },
    alignment: opts.alignment,
  });
}

function fieldLabel(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: label, bold: true, size: 22 }),
      new TextRun({ text: value || '', size: 22 }),
    ],
    spacing: { after: 80 },
  });
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: NAVY })],
    spacing: { before: 360, after: 180 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY } },
  });
}

function subTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: '333333' })],
    spacing: { before: 240, after: 80 },
  });
}

function emptyRow(): Paragraph {
  return new Paragraph({ spacing: { after: 100 } });
}

export function makeCustomWidthTable(headers: string[], rows: string[][], colWidths: number[]): Table {
  const headerCells = headers.map((h, index) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 19, color: NAVY })], spacing: { after: 40 } })],
    shading: { type: ShadingType.SOLID, color: HEADER_BG },
    verticalAlign: VerticalAlign.CENTER,
    width: { size: colWidths[index], type: WidthType.DXA },
  }));

  const dataRows = (rows.length > 0 ? rows : [headers.map(() => 'None reported')]).map(row => new TableRow({
    children: headers.map((_, index) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: row[index] || '', size: 18 })], spacing: { after: 30 } })],
      verticalAlign: VerticalAlign.CENTER,
      width: { size: colWidths[index], type: WidthType.DXA },
    })),
  }));

  return new Table({
    rows: [new TableRow({ children: headerCells }), ...dataRows],
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: colWidths,
    layout: TableLayoutType.FIXED,
  });
}

/** Internal evidence review. This renderer never supplies missing facts or predicts a band. */
export function buildExecutiveAuditDoc(firmName: string, practiceArea: string, analysis: any, context: any, letter: any, submission: any): Document {
  const data = submission.chambersData || submission.chambers_data || {};
  const letterData = normalizeLetterSections(data.editorial_review?.letter);
  if (letterData) {
    const state = data.artifact_pair_revision ? 'Internal report linked to the Submission selection. Delivery status is available in Studio.' : data.release_verdict?.passed === true ? 'Editorial review approved; final artifact checked separately.' : 'Working draft — unresolved review findings; not approved for final delivery.';
    const sections: (Paragraph | Table)[] = [sectionTitle('RANKPILOT — Strategic Audit Letter'), fieldLabel('Firm: ', firmName), fieldLabel('Practice: ', practiceArea), p(state, {bold:true}), p('Confidential internal review. Ranking outcomes are determined by the directory.')];
    for (const [key, heading] of [['executive_assessment','1. Executive assessment'],['portfolio','2. Selected portfolio'],['leadership','3. Leadership and attribution'],['evidence_gaps','4. Evidence gaps'],['next_steps','5. Recommended next steps']]) {
      sections.push(sectionTitle(heading), p(String(letterData[key] || 'No assessment available.')));
    }
    for (const issue of data.release_verdict?.errors || []) sections.push(p(String(issue)));
    return new Document({title: `RankPilot Strategic Audit - ${firmName}`,creator:'RankPilot',sections:[{children:sections}]});
  }
  if (data.editorial_review && !letterData) {
    return new Document({title:`RankPilot — Audit pendiente — ${firmName}`,creator:'RankPilot',sections:[{children:[sectionTitle('Strategic Audit — pendiente de generación'),fieldLabel('Firma: ',firmName),p('La revisión se interrumpió antes de redactar el Audit. No hay un portafolio validado para esta corrida. Reintenta la revisión; las redacciones guardadas se conservan.'),...(data.release_verdict?.errors || []).map((message:unknown)=>p(String(message)))]}]});
  }
  const source = Array.isArray(data.matters) ? data.matters : (submission.matters || []);
  const matters = Array.from(new Map(source.map((m: any, i: number) => [m.id || `source-${i}`, m])).values()) as any[];
  const curation = curateMatters(matters, practiceArea, data);
  const official = [...curation.officialPubMatters, ...curation.officialConfMatters];
  const reserve = [...curation.surplusPubMatters, ...curation.surplusConfMatters];
  const verdict = data.release_verdict || {};
  const approved = verdict.passed === true && (!verdict.status || verdict.status === 'passed') && !(verdict.errors || []).length;
  const status = approved ? 'Review recorded — verify the final submission separately' : 'Draft — review required; not approved for final delivery';
  const unresolved = matters.filter((m: any) => m.publish_status === 'confirmation_required' || m.confidentialityStatus === 'confirmation_required' || m.confidentialityConfirmed === false);
  const sections: (Paragraph | Table)[] = [
    sectionTitle('RANKPILOT — Internal Evidence Review'),
    fieldLabel('Firm: ', firmName || 'Not supplied'),
    fieldLabel('Practice: ', practiceArea || 'Not supplied'),
    fieldLabel('Jurisdiction: ', submission.guideRegion || data.metadata?.location || 'Not supplied'),
    p(status, { bold: true, color: NAVY }),
    p('Internal working document. It may contain confidential client information. It does not certify a ranking or replace editorial review.'),
    sectionTitle('1. Current position and objective'),
    fieldLabel('Current ranking reported: ', submission.currentBand || 'Not supplied'),
    fieldLabel('Target requested: ', submission.targetBand || context?.target_band || 'Not supplied'),
    p('A requested target is not a prediction. Ranking and strategic readiness require evidence-based review.'),
    sectionTitle('2. Portfolio recorded'),
    p(`${matters.length} distinct source matters; ${official.length} selected; ${reserve.length} in reserve or excluded.`),
    makeCustomWidthTable(['Matter', 'Client', 'Lead partner', 'Publication'], official.map((m: any) => [
      m.title || m.name || 'Untitled matter', m.client || 'Not supplied', m.leadPartner || m.lead_partner || 'Not supplied',
      m.confidentialityConfirmed === false || m.publish_status === 'confirmation_required' || m.confidentialityStatus === 'confirmation_required' ? 'Confirmation required' : (m.isConfidential ? 'Confidential' : 'Publishable')
    ]), [2760, 2600, 2000, 2000]),
    sectionTitle('3. Evidence requiring attention'),
    p(`${unresolved.length} matter(s) require confidentiality confirmation.`),
  ];
  const issues = Array.isArray(verdict.errors) ? verdict.errors : [];
  for (const issue of issues) sections.push(p(String(issue)));
  for (const m of matters) {
    const missing = [!m.client && 'client identity or description', !(m.rawNotes || m.summary) && 'source narrative', !(m.leadPartner || m.lead_partner) && 'lead partner', m.valueConflict && 'conflicting value'].filter(Boolean);
    if (missing.length) sections.push(p(`${m.name || m.title || 'Matter'}: ${missing.join('; ')}.`));
  }
  sections.push(sectionTitle('4. Source evidence register'));
  for (const m of matters) {
    sections.push(subTitle(m.name || m.title || 'Untitled matter'));
    sections.push(p(String(m.rawNotes || m.summary || 'No source narrative supplied.').slice(0, 350) + (String(m.rawNotes || m.summary || '').length > 350 ? ' […]' : '')));
    sections.push(fieldLabel('Reported value: ', m.value || m.matter_value || 'Not supplied'));
  }
  sections.push(sectionTitle('5. Next actions'), p('Resolve missing or conflicting facts against source documents, confirm publication permissions, and review the selected portfolio before requesting final delivery. Changes require a new validation.'));
  return new Document({title: `RankPilot Internal Evidence Review - ${firmName}`, creator: 'RankPilot', sections: [{children: sections}]});
}
export const buildAuditDoc = buildExecutiveAuditDoc;
