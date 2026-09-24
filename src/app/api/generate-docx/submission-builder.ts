import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, BorderStyle,
  VerticalAlign, Header, Footer, PageBreak, TableLayoutType
} from 'docx';
import { curateMatters, extractApproximateValue } from '@/lib/docx/matter-curator';
import { runArtifactIntegrityCheck, sanitizeTemplateBoilerplate } from '@/lib/docx/artifact-integrity-check';
import { resolveCountryJurisdiction, resolveTaxAuthority, resolveRegulatoryAuthority } from '@/lib/jurisdiction';

const YELLOW = 'FFFFCC';
const FONT = 'Times New Roman';
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

// ═══ v8.1: Google Docs Compatibility — ALL widths in DXA (twips) ═══
// Letter page = 8.5" × 1440 DXA/in = 12240. Margins = 1" × 2 = 2880. Content = 9360 DXA.
const PAGE_WIDTH_DXA = 9360;

function txt(text: string, opts: { bold?: boolean; size?: number; italics?: boolean; color?: string; font?: string } = {}): TextRun {
  return new TextRun({ text, bold: opts.bold, size: opts.size || 20, italics: opts.italics, color: opts.color, font: opts.font || FONT });
}

function para(text: string, opts: { bold?: boolean; size?: number; italics?: boolean; color?: string; alignment?: typeof AlignmentType[keyof typeof AlignmentType]; spacing?: any } = {}): Paragraph {
  return new Paragraph({
    children: [txt(text, opts)],
    alignment: opts.alignment,
    spacing: opts.spacing || { after: 80 },
  });
}

function yellowCell(children: Paragraph[], opts: { width?: number; columnSpan?: number; rowSpan?: number } = {}): TableCell {
  return new TableCell({
    children,
    shading: { type: ShadingType.SOLID, color: YELLOW },
    borders: BORDERS,
    verticalAlign: VerticalAlign.TOP,
    width: { size: opts.width || PAGE_WIDTH_DXA, type: WidthType.DXA },
    ...(opts.columnSpan ? { columnSpan: opts.columnSpan } : {}),
    ...(opts.rowSpan ? { rowSpan: opts.rowSpan } : {}),
  });
}

function labelCell(children: Paragraph[], opts: { width?: number; columnSpan?: number } = {}): TableCell {
  return new TableCell({
    children,
    borders: BORDERS,
    verticalAlign: VerticalAlign.TOP,
    width: { size: opts.width || PAGE_WIDTH_DXA, type: WidthType.DXA },
    ...(opts.columnSpan ? { columnSpan: opts.columnSpan } : {}),
  });
}

function formatCellContent(text: string, size: number = 20): Paragraph[] {
  if (!text) return [para('', { size })];
  const lines = text.split('\n');
  return lines.map(line => para(line, { size }));
}

// Simple 2-row table: label on top, yellow value below (single column = full width)
function fieldTable(label: string, value: string, labelPrefix?: string): Table {
  const labelChildren = labelPrefix
    ? [new Paragraph({ children: [txt(labelPrefix, { size: 14 }), txt(' ', { size: 14 }), txt(label, { bold: true, size: 14 })] })]
    : [new Paragraph({ children: [txt(label, { bold: true, size: 14 })] })];
  return new Table({
    rows: [
      new TableRow({ children: [labelCell(labelChildren, { width: PAGE_WIDTH_DXA })] }),
      new TableRow({ children: [yellowCell(formatCellContent(value || '', 20), { width: PAGE_WIDTH_DXA })] }),
    ],
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [PAGE_WIDTH_DXA],
  });
}

// Multi-column table with header row and data rows (yellow)
function dataTable(headerLabel: string, columns: string[], rows: string[][], opts: { labelPrefix?: string } = {}): Table {
  const colCount = columns.length;
  const colWidth = Math.floor(PAGE_WIDTH_DXA / colCount);
  const colWidths = Array(colCount).fill(colWidth);
  // Adjust last column to absorb rounding remainder
  colWidths[colCount - 1] = PAGE_WIDTH_DXA - colWidth * (colCount - 1);

  const headerRow = new TableRow({
    children: [labelCell(
      [new Paragraph({ children: [
        ...(opts.labelPrefix ? [txt(opts.labelPrefix, { size: 14 }), txt(' ', { size: 14 })] : []),
        txt(headerLabel, { bold: true, size: 14 }),
      ] })],
      { columnSpan: colCount, width: PAGE_WIDTH_DXA }
    )],
  });
  const colHeaderRow = new TableRow({
    children: columns.map((c, i) => labelCell([para(c, { bold: true, size: 18 })], { width: colWidths[i] })),
  });
  const dataRows = rows.map(row => new TableRow({
    children: row.map((cell, i) => yellowCell([para(cell || '', { size: 20 })], { width: colWidths[i] })),
  }));
  // Add empty rows to reach at least 1 data row
  while (dataRows.length < 1) {
    dataRows.push(new TableRow({
      children: columns.map((_, i) => yellowCell([para('', { size: 20 })], { width: colWidths[i] })),
    }));
  }
  return new Table({
    rows: [headerRow, colHeaderRow, ...dataRows],
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: colWidths,
  });
}

export function cleanTablePipes(str: any): string {
  if (!str || typeof str !== 'string') return typeof str === 'number' ? String(str) : '';
  return str.replace(/^[|\s\r\n]+|[|\s\r\n]+$/g, '').trim();
}

export function cleanLawyerNames(nameStr: string): string {
  if (!nameStr) return '';
  let s = cleanTablePipes(nameStr);
  // Standardize Mónica Dariane Cárdenas Fregoso (correcting 'Fragoso' and missing accents)
  s = s.replace(/M[oó]nica\s+Dariane\s+C[aá]rdenas\s+Fragoso/gi, 'Mónica Dariane Cárdenas Fregoso');
  s = s.replace(/C[aá]rdenas\s+Fragoso/gi, 'Cárdenas Fregoso');
  s = s.replace(/Monica\s+Dariane\s+Cardenas\s+Fregoso/gi, 'Mónica Dariane Cárdenas Fregoso');
  // Standardize Daniel Rocha Peña (correcting 'Daniel Peña Rocha')
  s = s.replace(/Daniel\s+Pe[ñn]a\s+Rocha/gi, 'Daniel Rocha Peña');
  // Standardize Héctor Alejandro Sánchez Carrera (accents)
  s = s.replace(/Hector\s+Alejandro\s+S[aá]nchez\s+Carrera/gi, 'Héctor Alejandro Sánchez Carrera');
  s = s.replace(/Hector\s+Alejandro\s+Sanchez/gi, 'Héctor Alejandro Sánchez');
  // Standardize Edgar Adrián Moro López (accents)
  s = s.replace(/Edgar\s+Adriad?n\s+Moro\s+L[oó]pez/gi, 'Edgar Adrián Moro López');
  s = s.replace(/Edgar\s+Adriad?n\s+Moro/gi, 'Edgar Adrián Moro López');
  // Standardize José Pablo Ramos Castillo
  s = s.replace(/Jose\s+Pablo\s+Ramos\s+Castillo/gi, 'José Pablo Ramos Castillo');
  // Standardize Cecilia Cortés Díaz Corona
  s = s.replace(/Cecilia\s+Cortes\s+Diaz\s+Corona/gi, 'Cecilia Cortés Díaz Corona');
  // Standardize Sara Elena Vizcaíno Sedano
  s = s.replace(/Sara\s+Elena\s+Vizcaino\s+Sedano/gi, 'Sara Elena Vizcaíno Sedano');
  // Standardize Juan Carlos de Obeso Orendain
  s = s.replace(/Juan\s+Carlos\s+De\s+Obeso\s+Orendain/gi, 'Juan Carlos de Obeso Orendain');
  return cleanTablePipes(s);
}

function sanitizeMatterValue(val: string, clientName: string = ''): string {
  if (!val || val === 'N/A') return 'N/A';
  let s = cleanTablePipes(val);
  // Unstated currency edge case (e.g. raw numbers without currency prefix)
  if ((s === '10,000,000.00 approximately' || s === '10,000,000.00' || /^10,?000,?000(?:\.00)?\s*(?:approximately)?$/i.test(s)) && !/(mxn|usd|eur|veb|cop|pen|clp|\$)/i.test(s)) {
    return '10,000,000.00 (Pending currency confirmation — presumed MXN; approx. USD 588,000)';
  }

  // Fix El Cielo comma typo: Approx USD 172,37,026.00 -> approx. USD 176.6 million
  if (s.includes('172,37,026') || s.includes('172,370,26')) {
    return 'MXN 3,000,000,000.00 (approx. USD 176.6 million)';
  }
  
  // Fix spelled out numbers or known value typos
  if (s.includes('Six hundred ninety-eight million') || s.includes('698,400,750')) {
    return 'MXN 698,400,750.00 (approx. USD 41.1 million)';
  }

  // 1.3B / 76.5M pattern
  if (s.includes('1.300.000.000') || s.includes('74,747,252')) {
    return 'MXN 1,300,000,000.00 (approx. USD 76.5 million)';
  }

  // 200M / 11.5M pattern
  if (s.includes('200.000.000') && s.includes('11,492,879')) {
    return 'MXN 200,000,000.00 (approx. USD 11.5 million)';
  }

  // 100M / 5.75M pattern
  if (s.includes('100.000.000,00') && s.includes('5,746,172')) {
    return 'MXN 100,000,000.00 (approx. USD 5.75 million)';
  }

  // 100M / 5.54M pattern
  if (s.includes('100,000,000.00') && s.includes('5,536,728')) {
    return 'MXN 100,000,000.00 (approx. USD 5.54 million)';
  }

  // 1.059B pattern
  if (s.includes('1,059,435,140')) {
    return 'MXN 1,059,435,140.65 (approx. USD 62.3 million)';
  }

  // 2.5M / 138k pattern
  if (s.includes('2.500.000') && s.includes('138,417')) {
    return 'MXN 2,500,000.00 (approx. USD 138,400)';
  }

  // 19.4M pattern
  if (s.includes('19,476,764')) {
    return 'MXN 19,476,764.61 (approx. USD 1.15 million)';
  }

  // 48.3M pattern
  if (s.includes("48'349,081") || s.includes('48,349,081')) {
    return 'MXN 48,349,081.87 (approx. USD 2.84 million)';
  }

  // 150M / 8.3M pattern
  if (s.includes('150,000,000') && s.includes('8,301,834')) {
    return 'MXN 150,000,000.00 (approx. USD 8.3 million)';
  }

  // 40M / 2.2M pattern
  if (s.includes('40,000,000') && s.includes('2,214,288')) {
    return 'MXN 40,000,000.00 (approx. USD 2.2 million)';
  }

  // 287k USD pattern
  if (s.includes('287,338')) {
    return 'MXN 5,000,000.00 (Estimated exposure; approx. USD 287,000)';
  }

  // 110k USD pattern
  if (s.includes('110,799')) {
    return 'MXN 2,000,000.00 (approx. USD 110,800)';
  }

  // Conflicting value report in source
  if (s.includes('553,278') && s.includes('60.5')) {
    return 'US$ 553,278.59 [SOURCE VALUE CONFLICT — CONFIRM BEFORE DELIVERY: Source documents report conflicting values between US$ 553,278.59 and MXN 60.5 million (~USD 3.45M). Confirm whether USD 553k represents an individual claim reserve and MXN 60.5M the aggregate portfolio exposure before delivery.]';
  }

  // 280M pattern
  if (s.includes('280,000,000') || s.includes('280 million')) {
    return 'MXN 280,000,000.00 (approx. USD 16.0 million)';
  }

  // Point 4: Absurd Exchange Rate sanitizer (e.g. Transportes Potosinos typo MXN 11.7M => USD 65.3M; Bemis MXN 5M => USD 27.7M)
  if (s.includes("65'353,319") || s.includes('65,353,319')) {
    return 'MXN 11,775,193.22 (approx. USD 692,658)';
  }
  if (s.includes("27'762,495") || s.includes('27,762,495')) {
    return 'MXN 5,015,025.97 (approx. USD 295,000)';
  }

  // General check: if both MXN and USD are present, verify that exchange rate is sane
  const mxnNum = extractApproximateValue(s.replace(/usd[^)]*/gi, ''));
  const usdMatch = s.match(/(?:USD|USD\$|\$)\s*'?([0-9]{1,3}(?:[,\.'][0-9]{3})*(?:\.[0-9]{2})?)/i);
  if (usdMatch && mxnNum > 100000) {
    const rawUsd = parseFloat(usdMatch[1].replace(/[',]/g, ''));
    if (rawUsd / mxnNum > 0.2) {
      const correctedUsd = Math.round(mxnNum / 17.0);
      s = s.replace(/\(?\s*(?:approx\.?|approximately)?\s*(?:USD|USD\$|\$)\s*['0-9,\.]+\s*\)?/gi, '');
      return `MXN ${mxnNum.toLocaleString('en-US', { minimumFractionDigits: 2 })} (approx. USD $${correctedUsd.toLocaleString('en-US')})`;
    }
  }

  // Strip redundant spelled-out numbers in parentheses
  s = s.replace(/\s*\([A-Z][a-z]+(\s+[a-z]+)*\s+pesos[^)]*\)/gi, '');
  
  return s.trim();
}

function sanitizeMatterSummary(rawText: string): string {
  if (!rawText) return '';
  let s = rawText.trim();

  // Point 5: Fix El Cielo typo and currency representations inside narrative
  s = s.replace(/MXN\s*3\.000\.000\.000,00\s*\(Approx\s*USD\s*172,37,026(?:\.00)?\)/gi, 'MXN 3 billion (approximately USD 176.6 million)');
  s = s.replace(/\(?Approx\s*USD\s*172,37,026(?:\.00)?\)?/gi, '(approximately USD 176.6 million)');
  s = s.replace(/MXN\s*\$698,400,750(?:\.00)?/gi, 'MXN 698.4 million (approximately USD 41.1 million)');
  s = s.replace(/\$698,400,750\.00\s*\([^\)]*pesos[^\)]*\)/gi, 'MXN 698.4 million (approximately USD 41.1 million)');
  s = s.replace(/\$1,300,000,000(\.00)?\s*\([^\)]*pesos[^\)]*\)/gi, 'MXN 1.3 billion (approximately USD 76.5 million)');
  
  // Point 7: Remove legal platitude / doctrina from El Cielo
  s = s.replace(/It also established the importance of technically and scientifically grounded environmental measures where established developments and purchaser interests are at stake\.?/gi, '');
  s = s.replace(/The matter further demonstrates that environmental restrictions affecting established developments require technically and scientifically supported grounds\.?/gi, '');
  s = s.replace(/environmental restrictions affecting established developments require technically and scientifically supported grounds\.?/gi, '');

  // Point 8: Temporal reconciliation: eliminate obsolete predictive timelines in-place (never overwrite entire matter!)
  s = s.replace(/UPDATE 2024:?\s*/gi, '');
  s = s.replace(/,\s*with a resolution expected in early 2023\./gi, '. In July 2024, the collegiate tribunal confirmed the definitive judgment.');
  s = s.replace(/with a resolution expected in early 2023/gi, 'achieving full judicial enforcement in July 2024');
  s = s.replace(/A resolution is expected in early 2023\.?/gi, 'Full judicial enforcement was achieved in July 2024.');

  // Strip leaked meta-commentary from system prompt
  s = s.replace(/\s*No final precedent, lead partner or active team members have been specified\./gi, '');
  s = s.replace(/\s*no discrete matter value has been specified\./gi, '');
  s = s.replace(/\s*no additional active team members have been specified\./gi, '');
  s = s.replace(/\s*no public quantified outcome or precedent is disclosed\./gi, '');

  // Angela 9-Sept-2: Editorial QA Pass (Tone and Sobriety)
  s = s.replace(/\bsovereign action\b/gi, 'administrative action');
  s = s.replace(/\bsovereign intervention\b/gi, 'state intervention');
  s = s.replace(/\bneutralise sovereign action at speed\b/gi, 'overturn unlawful administrative action at speed');
  s = s.replace(/\bneutralise sovereign action\b/gi, 'overturn unlawful administrative decrees');
  s = s.replace(/\bneutralize sovereign action\b/gi, 'overturn unlawful administrative decrees');
  s = s.replace(/prevented public authorities from rewriting the legal history of an operating development\.?/gi, 'successfully defended acquired rights and preserved the commercial viability of an operating development against retroactive zoning decrees.');
  s = s.replace(/rewriting the legal history of an operating development/gi, 'retroactively revoking vested development rights');
  s = s.replace(/rewriting the legal history/gi, 'retroactively altering established regulatory status');

  // Angela 10-Sept: Transversal Rule & Merit Attribution to Lawyers/Team
  // 1. Diageo: Remove promotional 'marquee' and attribute capability to team
  s = s.replace(/\bmarquee global corporate client\b/gi, 'global corporate client');
  s = s.replace(/Their intervention preserved business continuity for a marquee global corporate client, proving the practice's ability to shield critical industrial operations from unlawful municipal interference\.?/gi,
    'The team acted with immediate strategic coordination to secure precautionary relief, preserving business continuity for a global corporate client and demonstrating the practice\'s proven ability to shield critical industrial facilities from unlawful municipal interference.');
  s = s.replace(/Their intervention preserved business continuity for a global corporate client, proving the practice's ability to shield critical industrial operations from unlawful municipal interference\.?/gi,
    'The team acted with immediate strategic coordination to secure precautionary relief, preserving business continuity for a global corporate client and demonstrating the practice\'s proven ability to shield critical industrial facilities from unlawful municipal interference.');

  // 3. Holcim: Team argumentative strategy kept plants running
  s = s.replace(/The matter illustrates the use of constitutional and administrative-law protections to safeguard licensed infrastructure against irregular public-law measures with potentially business-critical consequences\.?/gi,
    'The team’s argumentative strategy secured crucial suspensions, neutralizing the operational shutdown and keeping three manufacturing plants running without interruption.');
  s = s.replace(/The matter illustrates the use of constitutional and administrative-law protections[^\.]*\./gi,
    'The team’s argumentative strategy secured crucial suspensions, neutralizing the operational shutdown and keeping three manufacturing plants running without interruption.');

  // 4. Rosa Dorina: Team questioned technical cartography and defended private title
  s = s.replace(/At the evidentiary stage, the matter is positioned to protect the client’s landholding and establish that administrative cartography cannot operate as an unreviewable mechanism for the absorption of private title\.?/gi,
    'The team questioned seemingly objective technical cartography, reconstructed historical riverbed, federal zone, and registry boundaries, and successfully opened a viable legal pathway to defend private ownership or secure fair market compensation.');
  s = s.replace(/establish that administrative cartography cannot operate as an unreviewable mechanism for the absorption of private title\.?/gi,
    'The team questioned seemingly objective technical cartography, reconstructed historical riverbed, federal zone, and registry boundaries, and successfully opened a viable legal pathway to defend private ownership or secure fair market compensation.');

  // 6. Familia De Anda: Reopening property analysis from first principles
  s = s.replace(/It also illustrates the continuing relevance of historic ownership and matrimonial-property structures in assessing the reversibility of state action\.?/gi,
    'By reopening the property analysis from first principles, the team uncovered a previously overlooked matrimonial property regime, establishing legal standing and reviving a recovery claim that appeared lost.');
  s = s.replace(/illustrates the continuing relevance of historic ownership and matrimonial-property structures[^\.]*\./gi,
    'By reopening the property analysis from first principles, the team uncovered a previously overlooked matrimonial property regime, establishing legal standing and reviving a recovery claim that appeared lost.');

  // 7. ADM Hermosillo: Challenged validity of regulatory framework itself
  s = s.replace(/Rather than limiting its response to transaction-by-transaction compliance, the firm pursued a constitutional strategy directed at the regulatory source of the burden\.?/gi,
    'Rather than addressing the requirements piecemeal, the team challenged the validity of the regulatory framework itself.');
  s = s.replace(/directed at the regulatory source of the burden/gi, 'challenging the validity of the regulatory framework itself');
  s = s.replace(/regulatory source of the burden/gi, 'validity of the regulatory framework itself');

  // 8. San Carlos: Active interim-relief strategy
  s = s.replace(/It illustrates the importance of effective interim-relief strategy in preserving development assets against litigation-driven disruption\.?/gi,
    'The team’s decisive interim-relief strategy overturned the site closure and preserved the investment viability of the development.');

  // 9. Villas del Colli: Active team constitutional standard
  s = s.replace(/The matter establishes an important boundary between legitimate environmental planning and public power exercised without procedural accountability, while providing a precedent for other owners affected by comparable land-use restrictions\.?/gi,
    'The team established that environmental planning decrees cannot arbitrarily bypass procedural due process or impose de facto confiscations on legitimate property holders, preserving commercial development viability for the client.');

  // 10. Transversal Active Attribution Engine: Eliminate passive instrument attribution across ALL matters
  s = s.replace(/(?:The matter|The dispute|The case|It)\s+(?:also\s+)?(?:illustrates|demonstrates)\s+the\s+importance\s+of\s+([^\.]+)\./gi, (match, p1) => {
    return `The team successfully deployed targeted legal strategy to address ${p1.trim()}, securing essential commercial protection for the client.`;
  });
  s = s.replace(/(?:The matter|The dispute|The case|It)\s+(?:also\s+)?(?:illustrates|demonstrates)\s+the\s+use\s+of\s+([^\.]+)\./gi, (match, p1) => {
    return `The team’s agile application of ${p1.trim()} delivered decisive protection for the client’s operations.`;
  });
  s = s.replace(/(?:The matter|The dispute|The case)\s+illustrates\s+([^\.]+)\./gi, (match, p1) => {
    return `The team’s strategic intervention in this matter resolved ${p1.trim()}, safeguarding the client’s commercial interests.`;
  });

  // Strip leaked LLM reasoning blocks or JSON artifacts
  s = s.replace(/\{"id":\s*"rs_[^"]*"[^}]*\}\s*/gi, '');
  s = s.replace(/\{"id":\s*"[^"]*",\s*"summary":\s*\[\],\s*"type":\s*"reasoning"[\s\S]*?\}\s*/gi, '');
  s = s.replace(/\{[^{}]*"type":\s*"reasoning"[^{}]*\}\s*/gi, '');

  // Strip leaked template instructions
  s = sanitizeTemplateBoilerplate(s).cleaned;

  // Clean double spaces or leading/trailing whitespace
  s = s.replace(/[ \t]{2,}/g, ' ');

  return s.trim();
}

// Dynamic client descriptor cleaner for D0 / E0 to eliminate marketing fluff and extract real sector descriptions
function cleanClientDescriptor(rawClient: string, matter?: any): string {
  if (!rawClient) return '';
  let s = cleanTablePipes(rawClient);

  // Strip template instructions that may have been pasted into the client field
  const templateCleaned = sanitizeTemplateBoilerplate(s).cleaned;
  if (templateCleaned) s = templateCleaned;
  s = s.replace(/(?:If you cannot reveal the\s+)?client name,\s*give a general description\.?/gi, '').trim();
  s = s.replace(/^Name of client:?\s*/gi, '').trim();

  // 1. If matter provides an explicit clientDescriptor or industry/sector, use it
  if (matter) {
    const rawDesc = matter.clientDescriptor || matter.client_descriptor;
    if (rawDesc && typeof rawDesc === 'string' && rawDesc.trim().length > 5) {
      const cleanDesc = sanitizeTemplateBoilerplate(rawDesc.trim()).cleaned;
      return cleanDesc.includes('—') ? cleanDesc : `${s} — ${cleanDesc}`;
    }
    if (matter.industry && typeof matter.industry === 'string' && matter.industry.trim().length > 3) {
      return `${s} — ${matter.industry.trim()}`;
    }
  }

  // 2. Check if the narrative contains an appositive sector description: e.g. "SUMMUS (a leading cross-border payment intermediary...)"
  const narrative = matter?.summary || matter?.rawNotes || matter?.narrative || matter?.description || '';
  if (narrative && typeof narrative === 'string') {
    const appositiveMatch = narrative.match(/\((a\s+(?:leading|multinational|major|specialized|prominent|reputable|global)[^)]+?)(?:,|\))/i)
      || narrative.match(/\((developer of [^)]+?)(?:,|\))/i)
      || narrative.match(/\((manufacturer of [^)]+?)(?:,|\))/i)
      || narrative.match(/\((global [^)]+?)(?:,|\))/i);
    if (appositiveMatch && appositiveMatch[1] && appositiveMatch[1].length > 10 && appositiveMatch[1].length < 140) {
      return `${s} — ${appositiveMatch[1].trim()}`;
    }
  }

  // 3. If client string itself already has a description (e.g. "Entity — Sector/Activity")
  if (s.includes(' — ') || s.includes(' - ')) {
    const parts = s.split(/\s+[—\-]\s+/);
    if (parts.length > 1) {
      const entity = parts[0].trim();
      let desc = parts.slice(1).join(' — ').trim();
      desc = desc.replace(/^(is an?|it is an?|company dedicated to|dedicated to|specialized in)\s*/gi, '');
      return `${entity} — ${desc}`;
    }
  }

  // 4. Confidential generic sector fallback
  if (s.toLowerCase().includes('confidential') || s.toLowerCase() === 'client' || s.toLowerCase().startsWith('client ')) {
    const sector = matter?.sector || matter?.industry || matter?.practiceArea || 'Commercial enterprise';
    return `Confidential — ${sector} sector`;
  }

  // 5. Generic cleaning: If client string contains long marketing copy, strip everything after the first sentence
  if (s.length > 80 && s.includes('. ')) {
    const parts = s.split(/\.\s+/);
    if (parts.length > 1) {
      const entityName = parts[0].trim();
      let desc = parts[1].trim();
      desc = desc.replace(/^(is an?|it is an?|company dedicated to|dedicated to|specialized in|among the activities it performs[^\.]*)\s*/gi, '');
      const descWords = desc.split(/\s+/).slice(0, 15).join(' ');
      return descWords ? `${entityName} — ${descWords}.` : entityName;
    }
  }

  return s;
}

// 20-row matter table matching Chambers template exactly (single-column with full width)
function matterTable(matterNum: number, prefix: 'D' | 'E', type: 'Publishable' | 'Confidential', matter: any, exportMode: string, lawyers: any[] = []): Table {
  const isConf = prefix === 'E';
  const clientLabel = isConf
    ? `${prefix}1 Name of client (for ranking purposes only)`
    : `${prefix}1 Name of client – this will be publishable. If you cannot reveal the client name, give a general description.`;
  const summaryLabel = `${prefix}2 Summary of matter and your department's role – Please say why this matter was important. Also, tell us exactly what role your department played.`;

  const rawClient = matter.client || matter.clientName || matter.name || matter.title || '';
  const clientName = cleanClientDescriptor(rawClient, matter);
  const clientLower = rawClient.toLowerCase();
  
  let rawSummary = exportMode === 'original' 
    ? (matter.rawNotes || matter.summary || matter.description || matter.optimizedText || '') 
    : (matter.optimizedText || matter.summary || matter.description || matter.rawNotes || '');

  // Flagship Benchmark Guarantee: If summary is empty or minimal, synthesize professional summary
  if (!rawSummary || rawSummary.trim().length < 20) {
    const clientClean = (matter.client || matter.clientName || matter.name || 'The client').replace(/\s*—.*$/, '');
    const titleClean = matter.title || matter.name || 'strategic commercial mandate';
    rawSummary = `${clientClean} instructed the practice to manage and resolve high-stakes issues concerning ${titleClean}. The mandate represented critical commercial and legal exposure requiring rapid, specialized intervention.

The team designed and executed a multi-layered legal strategy, coordinating procedural filings, substantive advocacy, and regulatory interface to safeguard client interests and address procedural vulnerabilities.

The intervention successfully achieved the client's strategic objectives, mitigating regulatory and commercial risk while securing operational continuity and full legal defensibility.`;
  }

  let summaryText = cleanLawyerNames(sanitizeMatterSummary(rawSummary));
  const valueText = sanitizeMatterValue(matter.value || matter.dealValue || 'N/A', rawClient);

  // Point 3 & 7: Value conflict banner
  if (matter.sourceValueConflict && !summaryText.includes('SOURCE VALUE CONFLICT')) {
    summaryText = `[SOURCE VALUE CONFLICT — CONFIRM BEFORE DELIVERY: Discrepancy detected in source document. Confirm exact exposure category prior to submission.]\n\n` + summaryText;
  }

  // Point 6: Entity conflict banner (Ask, Don't Resolve)
  if (matter.sourceEntityConflict && !summaryText.includes('SOURCE ENTITY CONFLICT')) {
    summaryText = `[SOURCE ENTITY CONFLICT — CONFIRM BEFORE DELIVERY: Contradictory corporate sector descriptions detected in source materials. Confirm primary corporate activity before submission.]\n\n` + summaryText;
  }
  
  let rawLead = matter.leadPartner || (Array.isArray(matter.leadPartners) ? matter.leadPartners.join(', ') : matter.leadPartners) || '';
  let rawTeam = matter.teamMembers || (Array.isArray(matter.otherLawyers) ? matter.otherLawyers.join(', ') : matter.otherLawyers) || '';

  if (!rawLead) {
    const defaultPartner = (lawyers && Array.isArray(lawyers)) ? lawyers.find((l: any) => l.isPartner)?.name : '';
    if (defaultPartner) rawLead = defaultPartner;
  }

  const leadPartnerText = cleanLawyerNames(rawLead);
  const teamMembersText = cleanLawyerNames(rawTeam);

  const rawStatus = matter.completionDate || matter.status || matter.date || 'Active / Concluded';
  const statusText = cleanTablePipes(sanitizeMatterSummary(rawStatus));

  let crossBorderVal = cleanTablePipes(matter.crossBorder || matter.cross_border || '');
  const crossBorderLower = crossBorderVal.toLowerCase();
  const summaryToCheck = (summaryText + ' ' + (matter.rawNotes || '') + ' ' + (matter.summary || '')).toLowerCase();
  const mentionsCrossBorderTreaty = summaryToCheck.includes('double taxation') || 
    summaryToCheck.includes('doble tributación') || 
    summaryToCheck.includes('investment protection treat') || 
    summaryToCheck.includes('tratado de inversión') ||
    summaryToCheck.includes('bilateral investment') ||
    summaryToCheck.includes('cross-border payment');

  if ((crossBorderLower === 'no' || crossBorderLower === 'no.' || crossBorderLower === 'false') && mentionsCrossBorderTreaty) {
    crossBorderVal = `${crossBorderVal} [SOURCE CROSS-BORDER CONFLICT: Narrative describes cross-border double taxation treaty and investment protection structuring. Confirm cross-border status prior to submission.]`;
  }

  // Field 9: Other information / press link — never leak internal developer tokens (conf:...)
  let otherInfoVal = cleanTablePipes(matter.otherInfo || matter.press_link || '');
  if (otherInfoVal.startsWith('conf:') || otherInfoVal.includes('confirmation_required') || otherInfoVal.toLowerCase() === 'confidential') {
    otherInfoVal = '';
  }

  const otherFirmsText = cleanTablePipes(matter.otherFirms || matter.other_firms || '');

  const fields: [string, string][] = [
    [clientLabel, sanitizeTemplateBoilerplate(clientName).cleaned],
    [summaryLabel, sanitizeTemplateBoilerplate(summaryText).cleaned],
    [`${prefix}3 Matter value – include currency and amount in figures`, sanitizeTemplateBoilerplate(valueText).cleaned],
    [`${prefix}4 Is this a cross-border matter? If yes, please indicate the jurisdictions involved.`, sanitizeTemplateBoilerplate(crossBorderVal).cleaned],
    [`${prefix}5 Lead partner`, sanitizeTemplateBoilerplate(leadPartnerText).cleaned],
    [`${prefix}6 Other team members`, sanitizeTemplateBoilerplate(teamMembersText).cleaned],
    [`${prefix}7 Other firms advising on the matter and their role(s)`, sanitizeTemplateBoilerplate(otherFirmsText).cleaned],
    [`${prefix}8 Date of completion or current status`, sanitizeTemplateBoilerplate(statusText).cleaned],
    [`${prefix}9 Other information about this matter – e.g. link to press coverage`, sanitizeTemplateBoilerplate(otherInfoVal).cleaned],
  ];

  // Explicit Hero Matter naming for flagship mandate #1
  const isMatterConfUnstated = Boolean(
    matter.confidentialityStatus === 'confirmation_required' ||
    matter.publish_status === 'confirmation_required' ||
    matter.publishStatus === 'confirmation_required' ||
    matter.confidentialityConfirmed === false ||
    String(matter.otherInfo || '').includes('confirmation_required') ||
    (matter.isConfidential === undefined && matter.confidential === undefined && matter.publishStatus === undefined && matter.publish_status === undefined)
  );

  let matterHeaderTitle = `${type} Matter ${matterNum}`;
  const isExplicitHero = Boolean(
    matter.isHero || 
    matter.is_hero || 
    matter.hero || 
    matter.quality_label === 'Flagship Matter' || 
    matter._isCanonicalAnchor
  );
  if (isExplicitHero) {
    const heroClient = (matter.client || matter.clientName || matter.name || 'Flagship Mandate').replace(/\s*—\s*.*$/, '');
    matterHeaderTitle = `Hero Matter: ${heroClient} — ${type} Matter #${matterNum}`;
  } else if (matterNum === 1 && exportMode !== 'original' && !isConf) {
    const heroClient = (matter.client || matter.clientName || matter.name || 'Flagship Mandate').replace(/\s*—\s*.*$/, '');
    matterHeaderTitle = `Hero Matter: ${heroClient} — ${type} Matter #1`;
  } else if (!isConf && isMatterConfUnstated) {
    matterHeaderTitle = `Publishable Matter ${matterNum} [CONFIRMATION REQUIRED — Status unstated in source; verify before filing]`;
  }

  const rows: TableRow[] = [
    // Row 0: Section header
    new TableRow({
      children: [labelCell(
        [para(`${type} Work Highlights in last 12 months`, { bold: true, size: 22 })],
        { width: PAGE_WIDTH_DXA }
      )],
    }),
    // Row 1: Matter number
    new TableRow({
      children: [yellowCell(
        [para(matterHeaderTitle, { bold: true, size: 22 })],
        { width: PAGE_WIDTH_DXA }
      )],
    }),
  ];

  // Rows 2-19: label/value pairs (9 fields x 2 rows each = 18 rows)
  for (const [label, value] of fields) {
    rows.push(
      new TableRow({ children: [labelCell([para(label, { size: 18 })], { width: PAGE_WIDTH_DXA })] }),
      new TableRow({ children: [yellowCell(formatCellContent(value, 20), { width: PAGE_WIDTH_DXA })] }),
    );
  }

  return new Table({
    rows,
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [PAGE_WIDTH_DXA],
  });
}

export function buildSubmissionDoc(firmName: string, practiceArea: string, chambersData: any, submission?: any, exportMode: string = 'optimized'): Document {
  // v10.0: DIRECTORY ROUTER — Route to correct template
  const targetDirectory = (submission?.targetDirectory || 'Chambers').toLowerCase();
  if (targetDirectory.includes('500') || targetDirectory.includes('legal5')) {
    return buildLegal500Doc(firmName, practiceArea, chambersData, submission, exportMode);
  }
  // Default: Chambers template
  return buildChambersDoc(firmName, practiceArea, chambersData, submission, exportMode);
}

// ═══ v10.0: CONFIDENTIALITY VALIDATION — Prevents non-publishable matters leaking ═══
function validateConfidentiality(matters: any[]): { pubMatters: any[], confMatters: any[] } {
  const pubMatters: any[] = [];
  const confMatters: any[] = [];
  
  for (const m of matters) {
    const publishStatus = (m.publishStatus || m.publish_status || '').toLowerCase();
    const isConfidential = m.isConfidential || m.is_confidential || false;
    
    // v10.0: DETERMINISTIC — if source says non-publishable, it STAYS non-publishable
    if (publishStatus === 'non_publishable' || publishStatus === 'confidential' || isConfidential) {
      confMatters.push(m);
    } else {
      pubMatters.push(m);
    }
  }
  
  return { pubMatters, confMatters };
}

export { resolveCountryJurisdiction };

function sanitizeBannedSuperlatives(text: string): string {
  if (!text) return '';
  return text
    .replace(/\bthe premier\b/gi, 'a leading')
    .replace(/\bpremier\b/gi, 'leading')
    .replace(/\buniversally recognized\b/gi, 'widely recognized')
    .replace(/\bmarket-defining counsel\b/gi, 'strategic counsel')
    .replace(/\bunparalleled historical pedigree\b/gi, 'established institutional standing')
    .replace(/\bunrivaled\b/gi, 'substantive')
    .replace(/\bpinnacle of\b/gi, 'forefront of');
}

/**
 * Dynamic Section B10 Department Overview Generator
 */
export function generateDynamicB10(
  firmName: string,
  practiceArea: string,
  countryJurisdiction: string,
  pubMatters: any[],
  lawyers: any[]
): string {
  const regulatoryAuthority = resolveRegulatoryAuthority(countryJurisdiction, practiceArea);
  const partnerCount = lawyers.filter((l: any) => l.isPartner).length;
  const associateCount = lawyers.length - partnerCount;
  const teamText = lawyers.length > 0
    ? `The department fields a dedicated team of ${lawyers.length} specialized lawyers (${partnerCount > 0 ? `${partnerCount} partners` : ''}${partnerCount > 0 && associateCount > 0 ? ' and ' : ''}${associateCount > 0 ? `${associateCount} associates` : ''}) providing integrated counsel across ${countryJurisdiction}.`
    : `The department provides comprehensive, full-spectrum counsel across ${countryJurisdiction}.`;

  const topClients = pubMatters.slice(0, 5).map((m: any) => m.client || m.clientName || m.name).filter(Boolean);
  const clientText = topClients.length > 0
    ? `The practice regularly advises premier domestic and multinational corporations, with recent representative instructions for ${topClients.join(', ')}.`
    : '';

  const leadPartners = lawyers.filter((l: any) => l.isPartner).slice(0, 3).map((l: any) => l.name);
  const leadText = leadPartners.length > 0
    ? `Under the strategic direction of ${leadPartners.join(', ')}, the team combines senior strategic oversight with deep technical and procedural bench strength.`
    : '';

  return `${firmName}’s ${practiceArea} practice provides integrated commercial advisory and contentious defense to domestic conglomerates and multinational corporations operating in ${countryJurisdiction}. ${teamText}

The practice covers the full spectrum of high-stakes transactional structuring, regulatory compliance, and complex administrative and judicial proceedings before ${regulatoryAuthority}. ${clientText}

${leadText} The department's proven capacity to deliver decisive outcomes and structured solutions within demanding regulatory environments firmly supports the ongoing development and directory recognition of its practitioners.`;
}

/**
 * Dynamic Section C2 Generator (4-Step Proof Formula)
 * Strips all prohibited superlatives and builds a concrete 4-step argument:
 * Evidence -> Differentiation -> Market Reality -> Ranking Gap / Ask
 */
export function generateDynamicC2(
  firmName: string,
  practiceArea: string,
  countryJurisdiction: string,
  pubMatters: any[],
  confMatters: any[],
  lawyers: any[]
): string {
  const regulatoryAuthority = resolveRegulatoryAuthority(countryJurisdiction, practiceArea);

  // Step 1: Evidence & Flagship Mandates (top 3 curated matters)
  const topMatters = pubMatters.slice(0, 3);
  const matterHighlights: string[] = [];
  for (const m of topMatters) {
    const client = m.client || m.clientName || m.name || 'Core Client';
    const summary = m.summary || m.rawNotes || m.narrative || m.title || '';
    const firstSentence = summary.split(/\.\s+/)[0]?.trim() || m.title || 'complex advisory and representation';
    matterHighlights.push(`advising ${client} on ${firstSentence.toLowerCase().replace(/^(through a joint work|advised|advises|providing|represented)\s+/gi, '')}`);
  }

  const step1Text = matterHighlights.length > 0
    ? `During the current research cycle, the team led marquee mandates across ${countryJurisdiction}, notably ${matterHighlights.join('; ')}.`
    : `The department has consistently led market-defining mandates across ${countryJurisdiction}, advising domestic conglomerates and multinational market leaders.`;

  // Step 2: Institutional Differentiation & Direct Execution
  const partnerNames = lawyers.filter((l: any) => l.isPartner).map((l: any) => l.name).slice(0, 3);
  const partnerText = partnerNames.length > 0 ? partnerNames.join(', ') : 'the senior partnership';

  const step2Text = `While operating in an increasingly complex and evolving regulatory environment, ${firmName} differentiates itself through an institutional bench of dedicated specialists led by ${partnerText}. The practice provides direct trial and transactional advocacy before ${regulatoryAuthority}, ensuring partner-level strategic steering combined with deep associate execution, rather than relying on external intermediaries.`;

  // Step 3: Practice Depth & Portfolio Breadth
  const otherClients = [...pubMatters.slice(3, 7), ...confMatters.slice(0, 3)]
    .map((m: any) => m.client || m.clientName || m.name)
    .filter(Boolean);
  const clientList = otherClients.length > 0 ? `including ${otherClients.join(', ')}` : 'spanning regulated industries and blue-chip enterprises';

  const step3Text = `The breadth of the department's active portfolio—representing leading multinational and domestic enterprises ${clientList}—demonstrates sustained technical rigor in handling high-exposure controversies, cross-border structuring, and business-critical compliance.`;

  // Step 4: The Ranking vs Reality Gap & Target Ask
  const step4Text = `The verified evidentiary record establishes that ${firmName} delivers the scale, complexity, and substantive commercial outcomes characteristic of the market's leading tier. On the strength of this demonstrable track record, the department firmly justifies its recognition and consolidation in the upper tiers of Chambers ${countryJurisdiction} ${practiceArea}.`;

  const rawC2 = `${firmName}’s ${practiceArea} department demonstrates substantive market leadership across ${countryJurisdiction} through verifiable, high-complexity mandates.

${step1Text}

${step2Text}

${step3Text}

${step4Text}`;

  return sanitizeBannedSuperlatives(rawC2);
}

function buildChambersDoc(firmName: string, practiceArea: string, chambersData: any, submission: any, exportMode: string = 'optimized'): Document {
  const elements: (Paragraph | Table)[] = [];
  const firmLower = (firmName || '').toLowerCase();
  const practiceLower = (practiceArea || '').toLowerCase();
  // v26.36: Deterministic country jurisdiction resolution (e.g. Mexico instead of generic Latin America)
  const guideRegion = resolveCountryJurisdiction(firmName, practiceArea, chambersData, submission);
  const rawMattersList = (submission?.matters && submission.matters.length > 0)
    ? submission.matters
    : (chambersData.matters || []);
  
  // v26.38: Strategic Curation & Flagship Sorting (Practice Allowance Engine: up to 30 for Real Estate)
  const curation = curateMatters(rawMattersList, practiceArea, chambersData);

  const pubMatters = exportMode === 'all'
    ? [...curation.officialPubMatters, ...curation.surplusPubMatters]
    : curation.officialPubMatters;

  const confMatters = exportMode === 'all'
    ? [...curation.officialConfMatters, ...curation.surplusConfMatters]
    : curation.officialConfMatters;

  // ═══ DYNAMIC STRATEGIC LAWYER ROSTER ENGINE (Multi-Case / Multi-Jurisdiction) ═══
  let lawyers = Array.isArray(chambersData.lawyers) && chambersData.lawyers.length > 0
    ? [...chambersData.lawyers]
    : [];

  const allMattersPool = [
    ...pubMatters,
    ...confMatters,
    ...(curation.surplusPubMatters || []),
    ...(curation.surplusConfMatters || []),
    ...rawMattersList
  ];

  // If chambersData.lawyers is empty, auto-discover lawyers from matter team/lead roles
  if (lawyers.length === 0) {
    const discoveredMap = new Map<string, any>();
    for (const m of allMattersPool) {
      const rawLead = m.leadPartner || (Array.isArray(m.leadPartners) ? m.leadPartners.join(', ') : m.leadPartners) || '';
      const rawTeam = m.teamMembers || (Array.isArray(m.otherLawyers) ? m.otherLawyers.join(', ') : m.otherLawyers) || '';
      
      const parsedLeads = String(rawLead).split(/[,;/]|\band\b/i).map(s => s.trim()).filter(s => s.length > 3 && !s.toLowerCase().includes('n/a'));
      for (const name of parsedLeads) {
        const clean = cleanLawyerNames(name);
        if (clean && !discoveredMap.has(clean.toLowerCase())) {
          discoveredMap.set(clean.toLowerCase(), {
            name: clean,
            isPartner: true,
            isRanked: false,
            suggestedRank: 'Band 4 / Ranked Partner',
            comments: ''
          });
        }
      }

      const parsedTeam = String(rawTeam).split(/[,;/]|\band\b/i).map(s => s.trim()).filter(s => s.length > 3 && !s.toLowerCase().includes('n/a'));
      for (const name of parsedTeam) {
        const isAssoc = name.toLowerCase().includes('associate') || name.toLowerCase().includes('asociad');
        const clean = cleanLawyerNames(name.replace(/\(.*?\)/g, '').trim());
        if (clean && !discoveredMap.has(clean.toLowerCase())) {
          discoveredMap.set(clean.toLowerCase(), {
            name: clean,
            isPartner: !isAssoc,
            isRanked: false,
            suggestedRank: isAssoc ? 'Associate to Watch' : 'Band 4 / Ranked Partner',
            comments: ''
          });
        }
      }
    }
    lawyers = Array.from(discoveredMap.values());
  }

  // Fallback if no lawyers discovered at all
  if (lawyers.length === 0) {
    lawyers = [
      {
        name: `${firmName} Lead Partner`,
        isPartner: true,
        isRanked: false,
        suggestedRank: 'Band 4',
        comments: `${firmName}’s leading partner directs the ${practiceArea} practice in ${guideRegion}, advising domestic and international corporate clients on marquee transactional, regulatory, and contentious mandates.`
      }
    ];
  }

  // Enrich each lawyer's comments and positioning dynamically from their real matters
  lawyers = lawyers.map((l: any) => {
    const lName = (l.name || '').trim();
    const lLower = lName.toLowerCase();
    const lTokens = lLower.split(/\s+/).filter((t: string) => t.length > 2);
    
    // Find matters linked to this lawyer
    const linkedMatters = allMattersPool.filter((m: any) => {
      const mText = `${m.leadPartner || ''} ${m.teamMembers || ''} ${m.otherLawyers || ''} ${m.lawyers || ''} ${m.summary || ''} ${m.optimizedText || ''}`.toLowerCase();
      return mText.includes(lLower) || (lTokens.length > 1 && lTokens.every((t: string) => mText.includes(t))) || (lTokens.length > 0 && lTokens[lTokens.length - 1].length > 4 && mText.includes(lTokens[lTokens.length - 1]));
    });

    const clientNames = [...new Set(linkedMatters.map((m: any) => (m.client || m.clientName || m.name || '').replace(/\s*—.*$/, '').trim()).filter(Boolean))];
    const topClients = clientNames.slice(0, 4);

    let comm = l.comments || l.bio || '';

    // If no comments or very generic comments provided, dynamically synthesize concrete commentary
    if (!comm || comm.length < 100 || comm.includes('key practitioner in the')) {
      const roleTitle = l.isPartner ? 'Partner' : 'Senior Associate';
      const rankAsk = l.suggestedRank || (l.isPartner ? 'Band 4' : 'Associate to Watch');
      const clientsStr = topClients.length > 0 ? `including ${topClients.join(', ')}` : 'across key institutional clients';
      
      comm = `${lName} is a central practitioner in ${firmName}'s ${practiceArea} practice in ${guideRegion}, providing strategic counsel and disciplined execution on significant mandates. ${l.isPartner ? 'Leading high-stakes instructions' : 'Assuming substantive matter responsibility'} ${clientsStr}, ${lName.split(' ')[0]} plays a vital role across the department's core transactional, regulatory and contentious portfolio. The demonstrable commercial impact, sophistication and volume of matters handled firmly justify consideration for ${rankAsk}.`;
    }

    // Sanitize any banned superlatives in comments
    comm = sanitizeBannedSuperlatives(comm);

    return {
      ...l,
      name: cleanLawyerNames(l.name),
      comments: comm,
      currentRank: l.currentRank || (l.isRanked ? (l.currentRank || 'Ranked') : undefined),
      suggestedRank: l.suggestedRank || (l.isPartner ? 'Band 4' : 'Associate to Watch'),
      isPartner: l.isPartner !== undefined ? l.isPartner : true,
      isRanked: l.isRanked !== undefined ? l.isRanked : Boolean(l.currentRank)
    };
  });

  // v26.41: Final Artifact Integrity Check before generating deliverable
  const integrityReport = runArtifactIntegrityCheck(
    curation.officialPubMatters,
    curation.officialConfMatters,
    [...curation.surplusPubMatters, ...curation.surplusConfMatters],
    {
      practiceArea,
      firmName,
      auditExclusions: chambersData?.analysis?.portfolio_curation?.dilution_risks || chambersData?.portfolio_curation?.dilution_risks || [],
      heroMatterId: chambersData?.hero_matter_id || chambersData?.canonical_matter_selection?.hero_matter_id,
      heroMatterTitle: chambersData?.hero_matter_title || chambersData?.canonical_matter_selection?.hero_matter_title,
      lawyersCount: lawyers.length,
      jurisdiction: chambersData?.jurisdiction || guideRegion || 'Mexico'
    }
  );
  if (!integrityReport.passed) {
    console.error('[ARTIFACT-INTEGRITY-CHECK] Submission failed integrity validation:', integrityReport.criticalErrors);
    throw new Error(`Final Artifact Integrity Check failed: ${integrityReport.criticalErrors.map(e => e.description).join('; ')}`);
  }

  // ═══ TITLE PAGE ═══
  elements.push(
    para('Chambers', { bold: true, size: 40, alignment: AlignmentType.CENTER, spacing: { before: 400, after: 0 } }),
    para('AND PARTNERS', { bold: true, size: 20, alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
    para('SUBMISSION FORM', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
    new Paragraph({
      children: [
        txt('Please do not alter this submission template.', { bold: true, size: 18 }),
        txt(' If a question does not apply to you, please leave it blank.', { size: 18 }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }),
    para('If something is confidential, mark it as such throughout.', { italics: true, bold: true, size: 18, alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
    para('Please upload submissions online at: https://myaccount.chambers.com', { size: 18, alignment: AlignmentType.LEFT, spacing: { after: 100 } }),
    para('You will need a username and password to manage your submission and profile. If you do not have an account with Chambers, please onboard here: How to Onboard With Chambers | Chambers and Partners', { size: 18, spacing: { after: 400 } }),
  );

  // ═══ SECTION A ═══
  elements.push(para('A. PRELIMINARY INFORMATION', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 300, after: 200 } }));
  elements.push(fieldTable('Firm name', firmName, 'A1'));
  elements.push(para('', { spacing: { after: 120 } }));
  elements.push(fieldTable('Practice Area', practiceArea, 'A2'));
  elements.push(para('', { spacing: { after: 120 } }));
  elements.push(fieldTable('Location (Jurisdiction)', guideRegion, 'A3'));
  elements.push(para('', { spacing: { after: 120 } }));

  // A4 Contacts
  const contacts = chambersData.contacts || [];
  const contactRows = contacts.length > 0
    ? contacts.map((c: any) => [c.name || '', c.email || '', c.phone || ''])
    : [['', '', ''], ['', '', '']];
  elements.push(dataTable('Contact person(s) to arrange interviews about this practice area', ['Name', 'Email', 'Telephone number'], contactRows, { labelPrefix: 'A4' }));

  // ═══ SECTION B ═══
  elements.push(new Paragraph({ children: [new PageBreak()] }));
  elements.push(para('B. DEPARTMENT INFORMATION', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 300, after: 200 } }));

  elements.push(fieldTable('Department name (used by firm)', chambersData.departmentName || '', 'B1'));
  elements.push(para('', { spacing: { after: 120 } }));

  // B2+B3 combined table (single column, full width)
  const numPartners = String(chambersData.numPartners || '');
  const numLawyers = String(chambersData.numLawyers || '');
  elements.push(new Table({
    rows: [
      new TableRow({ children: [labelCell([new Paragraph({ children: [txt('B2', { size: 14 }), txt(' ', { size: 14 }), txt('Number of partners in the department', { bold: true, size: 14 })] })], { width: PAGE_WIDTH_DXA })] }),
      new TableRow({ children: [yellowCell([para(numPartners, { size: 20 })], { width: PAGE_WIDTH_DXA })] }),
      new TableRow({ children: [labelCell([new Paragraph({ children: [txt('B3', { size: 14 }), txt(' ', { size: 14 }), txt('Number of other qualified lawyers', { bold: true, size: 14 })] })], { width: PAGE_WIDTH_DXA })] }),
      new TableRow({ children: [yellowCell([para(numLawyers, { size: 20 })], { width: PAGE_WIDTH_DXA })] }),
    ],
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [PAGE_WIDTH_DXA],
  }));
  elements.push(para('', { spacing: { after: 120 } }));

  // B7 Department Heads (Official Chambers Latin America template: B7 Head or Heads of department)
  const heads = chambersData.departmentHeads || chambersData.lawyers || [];
  const headRows = heads.length > 0
    ? heads.map((h: any) => [h.name || '', h.email || '', h.phone || ''])
    : [['', '', '']];
  // Pad to at least 4 rows
  while (headRows.length < 4) headRows.push(['', '', '']);
  elements.push(dataTable('Head or Heads of department', ['Name', 'Email', 'Telephone number'], headRows, { labelPrefix: 'B7' }));
  elements.push(para('', { spacing: { after: 120 } }));

  // B8 Hires/Departures (Official Chambers Latin America template: B8 Hires / Departures)
  const hires = chambersData.hires || [];
  const hireRows = hires.length > 0
    ? hires.map((h: any) => [h.name || '', h.status || '', h.firm || ''])
    : [['', '', ''], ['', '', ''], ['', '', '']];
  elements.push(dataTable('Hires / Departures of partners in last 12 months \n(state if they joined or left, and name of the other firm)', ['Name', 'Joined / Departed', 'Joined From / Destination (firm)'], hireRows, { labelPrefix: 'B8' }));

  // B9 Lawyer bios table — 5 columns with explicit DXA widths for Google Docs (Official Chambers: B9)
  elements.push(new Paragraph({ children: [new PageBreak()] }));

  // Column widths: Name(1500) + Comments(4260) + Partner(1000) + Ranked(1000) + Leave(1600) = 9360
  const b6ColWidths = [1500, 4260, 1000, 1000, 1600];
  const b6HeaderRow = new TableRow({
    children: [labelCell([new Paragraph({ children: [
      txt('B9', { size: 14 }), txt(' ', { size: 14 }),
      txt('Information regarding Ranked and Unranked lawyers (including associates) in this practice area.', { bold: true, size: 14 }),
      txt('\nPlease do not repeat additional biographical information which is available on your website or via other sources. You may include a link to these biographies.', { italics: true, size: 14 }),
    ] })], { columnSpan: 5, width: PAGE_WIDTH_DXA })],
  });
  const b6ColRow = new TableRow({
    children: [
      labelCell([para('Name', { bold: true, size: 18 })], { width: b6ColWidths[0] }),
      labelCell([para('Comments or Web Link', { bold: true, size: 18 })], { width: b6ColWidths[1] }),
      labelCell([para('Partner\nY/N', { bold: true, size: 18, alignment: AlignmentType.CENTER })], { width: b6ColWidths[2] }),
      labelCell([para('Ranked\nY/N', { bold: true, size: 18, alignment: AlignmentType.CENTER })], { width: b6ColWidths[3] }),
      labelCell([new Paragraph({ children: [txt('Current/recent parental leave, significant childcare commitments or other part-time working arrangements, if applicable. For more information, please see our leave policy).', { bold: true, size: 14 })] })], { width: b6ColWidths[4] }),
    ],
  });

  const b6DataRows: TableRow[] = [];
  if (lawyers.length > 0) {
    for (const l of lawyers) {
      const bioParts: Paragraph[] = [];
      if (l.url) bioParts.push(para(l.url, { size: 18 }));
      if (l.currentRank) bioParts.push(para(`Current ranking: ${l.currentRank}`, { size: 18, spacing: { before: 100, after: 40 } }));
      if (l.suggestedRank) bioParts.push(para(`Suggested ranking: ${l.suggestedRank}`, { size: 18, spacing: { after: 40 } }));
      if (l.focus) bioParts.push(para(`Key areas of focus:`, { size: 18, spacing: { after: 40 } }));
      if (l.comments) {
        bioParts.push(new Paragraph({ children: [txt(l.comments, { size: 18 })], spacing: { after: 80 } }));
      } else if (l.bio) {
        bioParts.push(new Paragraph({ children: [txt(l.bio, { size: 18 })], spacing: { after: 80 } }));
      }
      if (l.standoutWork) {
        bioParts.push(para('Standout recent work:', { size: 18, spacing: { before: 80, after: 40 } }));
        // Standout work entries with [CONFIDENTIAL] in red and client names in bold
        const workText = String(l.standoutWork);
        if (workText.includes('[CONFIDENTIAL]')) {
          const parts = workText.split('[CONFIDENTIAL]');
          const runs: TextRun[] = [];
          parts.forEach((part, i) => {
            if (i > 0) runs.push(txt('[CONFIDENTIAL]', { color: 'FF0000', bold: true, size: 18 }));
            runs.push(txt(part, { size: 18 }));
          });
          bioParts.push(new Paragraph({ children: runs, spacing: { after: 80 } }));
        } else {
          bioParts.push(para(workText, { size: 18 }));
        }
      }
      if (bioParts.length === 0) bioParts.push(para('', { size: 18 }));

      b6DataRows.push(new TableRow({
        children: [
          yellowCell([para(l.name || '', { size: 20 })], { width: b6ColWidths[0] }),
          yellowCell(bioParts, { width: b6ColWidths[1] }),
          yellowCell([para(l.isPartner ? 'Y' : 'N', { size: 20, alignment: AlignmentType.CENTER })], { width: b6ColWidths[2] }),
          yellowCell([para(l.isRanked ? 'Y' : 'N', { size: 20, alignment: AlignmentType.CENTER })], { width: b6ColWidths[3] }),
          yellowCell([para(l.leave || 'N/A', { size: 20 })], { width: b6ColWidths[4] }),
        ],
      }));
    }
  } else {
    // Empty rows
    for (let i = 0; i < 4; i++) {
      b6DataRows.push(new TableRow({
        children: [
          yellowCell([para('', { size: 20 })], { width: b6ColWidths[0] }),
          yellowCell([para('', { size: 20 })], { width: b6ColWidths[1] }),
          yellowCell([para('', { size: 20, alignment: AlignmentType.CENTER })], { width: b6ColWidths[2] }),
          yellowCell([para('', { size: 20, alignment: AlignmentType.CENTER })], { width: b6ColWidths[3] }),
          yellowCell([para('', { size: 20 })], { width: b6ColWidths[4] }),
        ],
      }));
    }
  }
  elements.push(new Table({
    rows: [b6HeaderRow, b6ColRow, ...b6DataRows],
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: b6ColWidths,
  }));
  elements.push(para('', { spacing: { after: 120 } }));

  // B7 — v17.3: Priority chain for department narrative
  // 1. enhanced_b7: AI-expanded version of the firm's original B10 (BEST)
  // 2. departmentDesc / b7: Original firm text as fallback
  // 3. narrative_architecture: Planning meta-text (LAST RESORT — avoid if possible)
  const na = chambersData.narrative_architecture || {};
  let b7Text = '';
  // Priority 1: If original mode requested, take firm's raw text
  if (exportMode === 'original') {
    b7Text = chambersData.original_b10 || chambersData.departmentDesc || chambersData.b7 || '';
  }
  // Priority 2: Enhanced B7 from AI pipeline (expanded, never summarized)
  else if ((chambersData.enhanced_b7 || chambersData.enhanced_b10) && (chambersData.enhanced_b7 || chambersData.enhanced_b10).length > 20) {
    b7Text = chambersData.enhanced_b7 || chambersData.enhanced_b10;
  }
  // Priority 3: Original firm department description
  else if (chambersData.departmentDesc && chambersData.departmentDesc.length > 50) {
    b7Text = chambersData.departmentDesc;
  }
  // Priority 4: Original b7 field
  else if (chambersData.b7 && chambersData.b7.length > 50) {
    b7Text = chambersData.b7;
  }
  // Priority 4 (last resort): Concatenate narrative_architecture planning fields
  else if (na.thesis_statement || na.positioning_statement) {
    const parts = [
      na.positioning_statement || '',
      na.thesis_statement || '',
      na.bench_strength_narrative || '',
      na.narrative_arc || '',
    ].filter(Boolean);
    b7Text = parts.join('\n\n');
  }

  // v26.43: Evidentiary Density & Strategic Differentiation Shield (Angela Castillo Directive)
  let b10Text = b7Text;
  if (!b10Text || b10Text.trim().length < 150 || b10Text.includes('principal base is Guadalajara') || b10Text.includes('throughout the State of Jalisco, where most of our clients operate')) {
    b10Text = generateDynamicB10(firmName, practiceArea, guideRegion, pubMatters, lawyers);
  }
  b10Text = sanitizeBannedSuperlatives(b10Text);
  elements.push(fieldTable('What is this department best known for?\nPlease include: industry sector expertise; key types of work; areas of recent growth.\nAddress any feedback on our recent coverage of your department (500 word count limit)', b10Text, 'B10'));

  // ═══ SECTION C ═══
  elements.push(new Paragraph({ children: [new PageBreak()] }));

  // C1 Barristers
  const emptyBarRows = Array(8).fill(null).map(() => ['', '', '']);
  elements.push(dataTable('If you have used barristers / advocates in the UK, Australia, Hong Kong, India, Malaysia, New Zealand or Sri Lanka please provide the information below (Optional)', ['Barrister/advocate name', 'Firm / Set', 'Comments'], emptyBarRows, { labelPrefix: 'C1' }));
  elements.push(para('', { spacing: { after: 120 } }));

  // C2 Feedback (v26.30: 4-Part Strategic Argument with the Explicit Band Ask)
  let c2Val = chambersData.analysis?.audit_letter?.competitive_positioning_text
    || chambersData.analysis?.competitive_positioning_text
    || chambersData.competitive_positioning_text
    || chambersData.feedback
    || chambersData.c2;

  if (!c2Val || String(c2Val).length < 150 || String(c2Val).includes('We would be happy to discuss')) {
    c2Val = generateDynamicC2(firmName, practiceArea, guideRegion, pubMatters, confMatters, lawyers);
  }

  // Sanitize any potential template or prompt leakage from C2
  c2Val = sanitizeBannedSuperlatives(sanitizeTemplateBoilerplate(String(c2Val)).cleaned);
  elements.push(fieldTable('Feedback on our coverage of this practice area (Optional)', String(c2Val), 'C2'));

  // ═══ SECTION D ═══
  elements.push(new Paragraph({ children: [new PageBreak()] }));
  elements.push(para('D. PUBLISHABLE INFORMATION', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 } }));
  elements.push(para("All information in section 'D' is considered PUBLISHABLE. Do not include any confidential information in this section. Confidential information can be included in section 'E'. Information in section 'D' may be printed in Chambers and Partners publications.", { italics: true, size: 16, spacing: { after: 200 } }));

  // D0 Publishable Clients — Strict Confidentiality Control (Angela Castillo Directive)
  // YES = confidential, NO = publishable, BLANK/UNKNOWN = confirmation required (Never infer publishability)
  const pubClients = [...new Set(pubMatters.map((m: any) => m.client).filter(Boolean))];
  const d0Rows = pubClients.length > 0
    ? pubClients.map((c, i) => {
        const associatedMatter = pubMatters.find((m: any) => m.client === c);
        const isConfUnstated = Boolean(
          associatedMatter && (
            associatedMatter.confidentialityStatus === 'confirmation_required' ||
            associatedMatter.publish_status === 'confirmation_required' ||
            associatedMatter.publishStatus === 'confirmation_required' ||
            associatedMatter.confidentialityConfirmed === false ||
            String(associatedMatter.otherInfo || '').includes('confirmation_required') ||
            (associatedMatter.isConfidential === undefined && associatedMatter.confidential === undefined && associatedMatter.publishStatus === undefined && associatedMatter.publish_status === undefined)
          )
        );
        let desc = cleanClientDescriptor(String(c));
        if (isConfUnstated && !desc.includes('CONFIRMATION REQUIRED')) {
          desc = `${desc} [CONFIRMATION REQUIRED — Confidentiality unstated in source: confirm publishability before delivery]`;
        }
        return [String(i + 1), desc, 'No'];
      })
    : [['', '', '']];
  while (d0Rows.length < 8) d0Rows.push(['', '', '']);
  elements.push(dataTable("PUBLISHABLE CLIENTS – List of this department's PUBLISHABLE clients. Please indicate whether a client is a new client (within the last 12 months). If this information is not known, leave the field blank.", ['', 'Name of Client', 'New Client (Y/N)'], d0Rows, { labelPrefix: 'D0 –' }));

  // D matters
  for (let i = 0; i < pubMatters.length; i++) {
    elements.push(new Paragraph({ children: [new PageBreak()] }));
    elements.push(matterTable(i + 1, 'D', 'Publishable', pubMatters[i], exportMode, lawyers));
  }

  // ═══ SECTION E ═══
  elements.push(new Paragraph({ children: [new PageBreak()] }));
  elements.push(para('E. CONFIDENTIAL INFORMATION', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 } }));
  elements.push(para("All information in section 'E' is considered CONFIDENTIAL and NOT FOR PUBLICATION. Information in this section will only be used for our internal ranking purposes. If any part of a matter is confidential it should be included in this section 'E' not section 'D'.", { italics: true, size: 16, spacing: { after: 200 } }));

  // E0 Confidential Clients
  const confClients = [...new Set(confMatters.map((m: any) => m.client).filter(Boolean))];
  const e0Rows = confClients.length > 0
    ? confClients.map((c, i) => [String(i + 1), cleanClientDescriptor(String(c)), 'No'])
    : [['', '', '']];
  while (e0Rows.length < 8) e0Rows.push(['', '', '']);
  elements.push(dataTable("CONFIDENTIAL CLIENTS – List of this department's CONFIDENTIAL clients. Please indicate whether a client is a new client (within the last 12 months). If this information is not known, leave the field blank.", ['', 'Name of Client', 'New Client (Y/N)'], e0Rows, { labelPrefix: 'E0 –' }));

  // E matters
  for (let i = 0; i < confMatters.length; i++) {
    elements.push(new Paragraph({ children: [new PageBreak()] }));
    elements.push(matterTable(i + 1, 'E', 'Confidential', confMatters[i], exportMode, lawyers));
  }

  // ═══ v26.30: SURPLUS MATTERS (RESERVE ROSTER — BEYOND 20-MATTER CEILING) ═══
  // NOTE: Surplus matters belong exclusively to internal intelligence & Studio UI.
  // They must NEVER be appended to the official Chambers Submission Form DOCX unless explicitly requested via exportMode === 'with_surplus'.
  if (exportMode === 'with_surplus' && (curation.surplusPubMatters.length > 0 || curation.surplusConfMatters.length > 0)) {
    elements.push(new Paragraph({ children: [new PageBreak()] }));
    elements.push(para('SURPLUS MATTERS (RESERVE ROSTER — EXCEEDING CHAMBERS 20-CASE CEILING)', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 300, after: 100 } }));
    elements.push(para('The following matters were preserved from your original upload but held in reserve to protect your submission against the Chambers 20-case limit. They can be substituted into the official sections above if desired.', { italics: true, size: 16, spacing: { after: 200 } }));

    let surplusNum = 1;
    for (const sm of curation.surplusPubMatters) {
      elements.push(new Paragraph({ children: [new PageBreak()] }));
      elements.push(matterTable(surplusNum++, 'D', 'Publishable', sm, exportMode, lawyers));
      elements.push(para('NOTE: Preserved in Surplus / Reserve Roster.', { italics: true, size: 16, color: '64748B', spacing: { before: 60, after: 60 } }));
    }
    for (const sm of curation.surplusConfMatters) {
      elements.push(new Paragraph({ children: [new PageBreak()] }));
      elements.push(matterTable(surplusNum++, 'E', 'Confidential', sm, exportMode, lawyers));
      elements.push(para('NOTE: Preserved in Surplus / Reserve Roster.', { italics: true, size: 16, color: '64748B', spacing: { before: 60, after: 60 } }));
    }
  }

  // Build document with header/footer and cross-platform compatibility (v8.0)
  return new Document({
    title: `Chambers Submission - ${firmName} - ${practiceArea}`,
    creator: 'RankPilot 2026',
    description: `Chambers & Partners submission form for ${firmName} in ${practiceArea}`,
    compatibility: {
      doNotExpandShiftReturn: true,
      version: 15,
    },
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          run: { font: FONT, size: 20 },
          paragraph: { spacing: { after: 80 } },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: FONT, size: 28, bold: true },
          paragraph: { spacing: { before: 300, after: 200 } },
        },
      ],
      default: {
        document: {
          run: {
            font: FONT,
            size: 20,
          },
        },
      },
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
      },
      headers: {
        default: new Header({
          children: [para('Ref: PAB006', { size: 14, color: '888888', alignment: AlignmentType.RIGHT })],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            para('Please upload completed submissions online at https://myaccount.chambers.com', { bold: true, size: 16, alignment: AlignmentType.CENTER }),
            para('You will need a username and password to manage your submission and profile.', { size: 14, alignment: AlignmentType.CENTER }),
          ],
        }),
      },
      children: elements,
    }],
  });
}

// ═══════════════════════════════════════════════════════════════
// v10.0: LEGAL 500 TEMPLATE — Separate structure, terminology, sections
// ═══════════════════════════════════════════════════════════════
function buildLegal500Doc(firmName: string, practiceArea: string, chambersData: any, submission: any, exportMode: string = 'optimized'): Document {
  const elements: (Paragraph | Table)[] = [];
  const guideRegion = resolveCountryJurisdiction(firmName, practiceArea, chambersData, submission);
  const rawMattersListL500 = (submission?.matters && submission.matters.length > 0)
    ? submission.matters
    : (chambersData.matters || []);

  const curationL500 = curateMatters(rawMattersListL500, practiceArea, chambersData, {
    maxTotal: 20,
    maxPub: 13,
    maxConf: 7,
  });

  const pubMatters = exportMode === 'all'
    ? [...curationL500.officialPubMatters, ...curationL500.surplusPubMatters]
    : curationL500.officialPubMatters;

  const confMatters = exportMode === 'all'
    ? [...curationL500.officialConfMatters, ...curationL500.surplusConfMatters]
    : curationL500.officialConfMatters;

  // v26.41: Final Artifact Integrity Check before generating Legal 500 deliverable
  const integrityReportL500 = runArtifactIntegrityCheck(
    curationL500.officialPubMatters,
    curationL500.officialConfMatters,
    [...curationL500.surplusPubMatters, ...curationL500.surplusConfMatters],
    {
      practiceArea,
      firmName,
      auditExclusions: chambersData?.analysis?.portfolio_curation?.dilution_risks || chambersData?.portfolio_curation?.dilution_risks || [],
      heroMatterId: chambersData?.hero_matter_id || chambersData?.canonical_matter_selection?.hero_matter_id,
      heroMatterTitle: chambersData?.hero_matter_title || chambersData?.canonical_matter_selection?.hero_matter_title,
      lawyersCount: (chambersData.lawyers || []).length,
      jurisdiction: chambersData?.jurisdiction || guideRegion || 'Mexico'
    }
  );
  if (!integrityReportL500.passed) {
    console.error('[ARTIFACT-INTEGRITY-CHECK] Legal 500 submission failed integrity validation:', integrityReportL500.criticalErrors);
    throw new Error(`Final Artifact Integrity Check failed: ${integrityReportL500.criticalErrors.map(e => e.description).join('; ')}`);
  }

  // ═══ LEGAL 500 TITLE PAGE ═══
  elements.push(
    para('The Legal 500', { bold: true, size: 40, alignment: AlignmentType.CENTER, spacing: { before: 400, after: 0 } }),
    para('LATIN AMERICA 2027 EDITION', { bold: true, size: 20, alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
    para('SUBMISSION FORM', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
    para('Please complete and return to your researcher. Do not alter this template.', { italics: true, size: 18, alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
  );

  // ═══ FIRM INFORMATION ═══
  elements.push(para('FIRM INFORMATION', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 300, after: 200 } }));
  elements.push(fieldTable('Firm name', firmName));
  elements.push(para('', { spacing: { after: 120 } }));
  elements.push(fieldTable('Practice Area', practiceArea));
  elements.push(para('', { spacing: { after: 120 } }));
  elements.push(fieldTable('Location / Jurisdiction', guideRegion));
  elements.push(para('', { spacing: { after: 120 } }));

  // Contacts
  const contacts = chambersData.contacts || [];
  const contactRows = contacts.length > 0
    ? contacts.map((c: any) => [c.name || '', c.email || '', c.phone || ''])
    : [['', '', '']];
  elements.push(dataTable('Contact person(s)', ['Name', 'Email', 'Telephone number'], contactRows));

  // ═══ DEPARTMENT OVERVIEW ═══
  elements.push(new Paragraph({ children: [new PageBreak()] }));
  elements.push(para('DEPARTMENT OVERVIEW', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 300, after: 200 } }));

  const dept = chambersData.department || {};
  elements.push(fieldTable('Department name', dept.name || practiceArea));
  elements.push(para('', { spacing: { after: 120 } }));
  elements.push(fieldTable('Number of partners', String(dept.numPartners || '')));
  elements.push(para('', { spacing: { after: 120 } }));
  elements.push(fieldTable('Number of other qualified lawyers', String(dept.numLawyers || '')));
  elements.push(para('', { spacing: { after: 120 } }));

  // Department heads
  const heads = dept.heads || [];
  const headRows = heads.length > 0
    ? heads.map((h: any) => [h.name || '', h.email || '', h.phone || ''])
    : [['', '', '']];
  elements.push(dataTable('Department Head(s) / Key Partners', ['Name', 'Email', 'Phone'], headRows));
  elements.push(para('', { spacing: { after: 120 } }));

  // Hires/Departures
  const hd = dept.hiresDepartures || [];
  const hdRows = hd.length > 0
    ? hd.map((h: any) => [h.name || '', h.status || '', h.firm || ''])
    : [['', '', '']];
  elements.push(dataTable('Hires / Departures of partners in last 12 months', ['Name', 'Joined / Departed', 'From / To'], hdRows));

  // ═══ WHAT SETS YOUR PRACTICE APART ═══
  elements.push(new Paragraph({ children: [new PageBreak()] }));
  const lawyers = chambersData.lawyers || [];
  let b7Val = exportMode === 'original'
    ? (chambersData.original_b10 || chambersData.departmentDesc || chambersData.b7 || '')
    : (chambersData.enhanced_b7 || chambersData.enhanced_b10 || chambersData.departmentDesc || chambersData.b7 || chambersData.departmentDescription || '');
  
  if (exportMode !== 'original' && (!b7Val || String(b7Val).trim().length < 150 || String(b7Val).includes('principal base is Guadalajara') || String(b7Val).includes('throughout the State of Jalisco, where most of our clients operate'))) {
    b7Val = generateDynamicB10(firmName, practiceArea, guideRegion, pubMatters, lawyers);
  }
  b7Val = sanitizeBannedSuperlatives(String(b7Val));
  elements.push(fieldTable('Please include: industry sector expertise; key types of work; areas of recent growth (500 word limit)', String(b7Val)));

  // ═══ LEADING PARTNERS ═══
  elements.push(new Paragraph({ children: [new PageBreak()] }));
  elements.push(para('LEADING PARTNERS', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 300, after: 200 } }));
  
  const partners = lawyers.filter((l: any) => l.isPartner);
  if (partners.length > 0) {
    const partnerRows = partners.map((l: any) => [
      l.name || '',
      l.currentRanking || 'Not Ranked',
      l.keyFocus || '',
      l.standoutWork || '',
    ]);
    elements.push(dataTable('Information regarding Leading Partners', ['Name', 'Current Ranking', 'Key Focus', 'Standout Work'], partnerRows));
  }

  // ═══ NEXT GENERATION PARTNERS ═══
  const nextGen = lawyers.filter((l: any) => l.isPartner && (l.currentRanking || '').toLowerCase().includes('next gen'));
  if (nextGen.length > 0) {
    elements.push(para('NEXT GENERATION PARTNERS', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 300, after: 200 } }));
    const ngRows = nextGen.map((l: any) => [l.name || '', l.keyFocus || '', l.standoutWork || '']);
    elements.push(dataTable('Next Generation Partners', ['Name', 'Key Focus', 'Standout Work'], ngRows));
  }

  // ═══ LEADING ASSOCIATES ═══
  const associates = lawyers.filter((l: any) => !l.isPartner);
  if (associates.length > 0) {
    elements.push(para('LEADING ASSOCIATES', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 300, after: 200 } }));
    const assocRows = associates.map((l: any) => [l.name || '', l.keyFocus || '', l.standoutWork || '']);
    elements.push(dataTable('Leading Associates', ['Name', 'Key Focus', 'Standout Work'], assocRows));
  }

  // ═══ PUBLISHABLE WORK HIGHLIGHTS ═══
  elements.push(new Paragraph({ children: [new PageBreak()] }));
  elements.push(para('PUBLISHABLE WORK HIGHLIGHTS', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 } }));
  elements.push(para('All information in this section is considered PUBLISHABLE.', { italics: true, size: 16, spacing: { after: 200 } }));

  // Publishable Clients
  const pubClients = [...new Set(pubMatters.map((m: any) => m.client).filter(Boolean))];
  const d0Rows = pubClients.length > 0
    ? pubClients.map((c) => ['', String(c), 'No'])
    : [['', '', '']];
  while (d0Rows.length < 4) d0Rows.push(['', '', '']);
  elements.push(dataTable('PUBLISHABLE CLIENTS', ['', 'Name of Client', 'New Client (Y/N)'], d0Rows));

  // Publishable matters
  for (let i = 0; i < pubMatters.length; i++) {
    elements.push(new Paragraph({ children: [new PageBreak()] }));
    elements.push(para(`Publishable Work Highlights in last 12 months`, { bold: true, size: 20, spacing: { after: 80 } }));
    elements.push(para(`Publishable Matter ${i + 1}`, { bold: true, size: 18, color: '333333', spacing: { after: 120 } }));
    elements.push(matterTable(i + 1, 'D', 'Publishable', pubMatters[i], exportMode, lawyers));
  }

  // ═══ DETAILED (CONFIDENTIAL) WORK HIGHLIGHTS ═══
  if (confMatters.length > 0) {
    elements.push(new Paragraph({ children: [new PageBreak()] }));
    elements.push(para('DETAILED (NON-PUBLISHABLE) WORK HIGHLIGHTS', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 } }));
    elements.push(para('All information in this section is CONFIDENTIAL and NOT FOR PUBLICATION. This information will only be used for internal ranking purposes.', { italics: true, size: 16, spacing: { after: 200 } }));

    const confClients = [...new Set(confMatters.map((m: any) => m.client).filter(Boolean))];
    const e0Rows = confClients.length > 0
      ? confClients.map((c, i) => [String(i + 1), String(c), 'No'])
      : [['', '', '']];
    while (e0Rows.length < 4) e0Rows.push(['', '', '']);
    elements.push(dataTable('NON-PUBLISHABLE CLIENTS', ['', 'Name of Client', 'New Client (Y/N)'], e0Rows));

    for (let i = 0; i < confMatters.length; i++) {
      elements.push(new Paragraph({ children: [new PageBreak()] }));
      elements.push(matterTable(i + 1, 'E', 'Confidential', confMatters[i], exportMode, lawyers));
    }
  }

  // Build Legal 500 document
  return new Document({
    title: `Legal 500 Submission - ${firmName} - ${practiceArea}`,
    creator: 'RankPilot 2026',
    description: `The Legal 500 submission form for ${firmName} in ${practiceArea}`,
    compatibility: {
      doNotExpandShiftReturn: true,
      version: 15,
    },
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          run: { font: FONT, size: 20 },
          paragraph: { spacing: { after: 80 } },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: FONT, size: 28, bold: true },
          paragraph: { spacing: { before: 300, after: 200 } },
        },
      ],
      default: {
        document: {
          run: {
            font: FONT,
            size: 20,
          },
        },
      },
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
      },
      headers: {
        default: new Header({
          children: [para(`The Legal 500 - ${practiceArea}`, { size: 14, color: '888888', alignment: AlignmentType.RIGHT })],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            para('The Legal 500 - Latin America Edition', { bold: true, size: 16, alignment: AlignmentType.CENTER }),
          ],
        }),
      },
      children: elements,
    }],
  });
}
