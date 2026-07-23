import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, BorderStyle,
  VerticalAlign, Header, Footer, PageBreak, TableLayoutType
} from 'docx';

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

// Simple 2-row table: label on top, yellow value below (single column = full width)
function fieldTable(label: string, value: string, labelPrefix?: string): Table {
  const labelChildren = labelPrefix
    ? [new Paragraph({ children: [txt(labelPrefix, { size: 14 }), txt(' ', { size: 14 }), txt(label, { bold: true, size: 14 })] })]
    : [new Paragraph({ children: [txt(label, { bold: true, size: 14 })] })];
  return new Table({
    rows: [
      new TableRow({ children: [labelCell(labelChildren, { width: PAGE_WIDTH_DXA })] }),
      new TableRow({ children: [yellowCell([para(value || '', { size: 20 })], { width: PAGE_WIDTH_DXA })] }),
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

// 20-row matter table matching Chambers template exactly (single-column with full width)
function matterTable(matterNum: number, prefix: 'D' | 'E', type: 'Publishable' | 'Confidential', matter: any, exportMode: string): Table {
  const isConf = prefix === 'E';
  const clientLabel = isConf
    ? `${prefix}1 Name of client (for ranking purposes only)`
    : `${prefix}1 Name of client – this will be publishable. If you cannot reveal the client name, give a general description.`;
  const summaryLabel = `${prefix}2 Summary of matter and your department's role – Please say why this matter was important. Also, tell us exactly what role your department played.`;

  const fields: [string, string][] = [
    [clientLabel, matter.client || ''],
    [summaryLabel, exportMode === 'original' ? (matter.rawNotes || matter.optimizedText || '') : (matter.optimizedText || matter.rawNotes || '')],
    [`${prefix}3 Matter value – include currency and amount in figures`, matter.value || 'N/A'],
    [`${prefix}4 Is this a cross-border matter? If yes, please indicate the jurisdictions involved.`, matter.crossBorder || ''],
    [`${prefix}5 Lead partner`, matter.leadPartner || ''],
    [`${prefix}6 Other team members`, matter.teamMembers || ''],
    [`${prefix}7 Other firms advising on the matter and their role(s)`, matter.otherFirms || ''],
    [`${prefix}8 Date of completion or current status`, matter.completionDate || ''],
    [`${prefix}9 Other information about this matter – e.g. link to press coverage`, matter.otherInfo || ''],
  ];

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
        [para(`${type} Matter ${matterNum}`, { bold: true, size: 22 })],
        { width: PAGE_WIDTH_DXA }
      )],
    }),
  ];

  // Rows 2-19: label/value pairs (9 fields x 2 rows each = 18 rows)
  for (const [label, value] of fields) {
    rows.push(
      new TableRow({ children: [labelCell([para(label, { size: 18 })], { width: PAGE_WIDTH_DXA })] }),
      new TableRow({ children: [yellowCell([para(value, { size: 20 })], { width: PAGE_WIDTH_DXA })] }),
    );
  }

  return new Table({
    rows,
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [PAGE_WIDTH_DXA],
  });
}

export function buildSubmissionDoc(firmName: string, practiceArea: string, chambersData: any, submission: any, exportMode: string = 'optimized'): Document {
  const elements: (Paragraph | Table)[] = [];
  const guideRegion = submission.guideRegion || chambersData.jurisdiction || 'Mexico';
  const allMatters = submission.matters || [];
  
  // Deduplicate matters by title to prevent multiplication (e.g., Rivoli 4x bug)
  const seenTitles = new Set<string>();
  const matters = allMatters.filter((m: any) => {
    const key = (m.title || m.client || '').trim().toLowerCase();
    if (!key) return true; // keep untitled matters
    if (seenTitles.has(key)) return false; // skip duplicate
    seenTitles.add(key);
    return true;
  });
  const pubMatters = matters.filter((m: any) => !m.isConfidential);
  const confMatters = matters.filter((m: any) => m.isConfidential);

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

  // B4 Department Heads
  const heads = chambersData.departmentHeads || chambersData.lawyers || [];
  const headRows = heads.length > 0
    ? heads.map((h: any) => [h.name || '', h.email || '', h.phone || ''])
    : [['', '', '']];
  // Pad to at least 4 rows
  while (headRows.length < 4) headRows.push(['', '', '']);
  elements.push(dataTable('Department Head(s) or Key Partners', ['Name', 'Email', 'Telephone number'], headRows, { labelPrefix: 'B4' }));
  elements.push(para('', { spacing: { after: 120 } }));

  // B5 Hires/Departures
  const hires = chambersData.hires || [];
  const hireRows = hires.length > 0
    ? hires.map((h: any) => [h.name || '', h.status || '', h.firm || ''])
    : [['', '', ''], ['', '', ''], ['', '', '']];
  elements.push(dataTable('Hires / Departures of partners in last 12 months \n(state if they joined or left, and name of the other firm)', ['Name', 'Joined / Departed', 'Joined From / Destination (firm)'], hireRows, { labelPrefix: 'B5' }));

  // B6 Lawyer bios table — 5 columns with explicit DXA widths for Google Docs
  elements.push(new Paragraph({ children: [new PageBreak()] }));
  const lawyers = chambersData.lawyers || [];
  // Column widths: Name(1500) + Comments(4260) + Partner(1000) + Ranked(1000) + Leave(1600) = 9360
  const b6ColWidths = [1500, 4260, 1000, 1000, 1600];
  const b6HeaderRow = new TableRow({
    children: [labelCell([new Paragraph({ children: [
      txt('B6', { size: 14 }), txt(' ', { size: 14 }),
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
      if (l.bio) bioParts.push(new Paragraph({ children: [txt(l.bio, { size: 18 })], spacing: { after: 80 } }));
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
          yellowCell([para('', { size: 20 })], { width: b6ColWidths[4] }),
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

  // B7
  elements.push(fieldTable('What is this department best known for?\nPlease include: industry sector expertise; key types of work; areas of recent growth.\nAddress any feedback on our recent coverage of your department (500 word count limit)', chambersData.departmentDesc || chambersData.b7 || '', 'B7'));

  // ═══ SECTION C ═══
  elements.push(new Paragraph({ children: [new PageBreak()] }));

  // C1 Barristers
  const emptyBarRows = Array(8).fill(null).map(() => ['', '', '']);
  elements.push(dataTable('If you have used barristers / advocates in the UK, Australia, Hong Kong, India, Malaysia, New Zealand or Sri Lanka please provide the information below (Optional)', ['Barrister/advocate name', 'Firm / Set', 'Comments'], emptyBarRows, { labelPrefix: 'C1' }));
  elements.push(para('', { spacing: { after: 120 } }));

  // C2 Feedback
  const c2Val = chambersData.feedback || chambersData.c2 || 'We would be happy to discuss the market during a telephone interview.';
  elements.push(fieldTable('Feedback on our coverage of this practice area (Optional)', String(c2Val), 'C2'));

  // ═══ SECTION D ═══
  elements.push(new Paragraph({ children: [new PageBreak()] }));
  elements.push(para('D. PUBLISHABLE INFORMATION', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 } }));
  elements.push(para("All information in section 'D' is considered PUBLISHABLE. Do not include any confidential information in this section. Confidential information can be included in section 'E'. Information in section 'D' may be printed in Chambers and Partners publications.", { italics: true, size: 16, spacing: { after: 200 } }));

  // D0 Publishable Clients
  const pubClients = [...new Set(pubMatters.map((m: any) => m.client).filter(Boolean))];
  const d0Rows = pubClients.length > 0
    ? pubClients.map((c, i) => ['', String(c), 'No'])
    : [['', '', '']];
  while (d0Rows.length < 8) d0Rows.push(['', '', '']);
  elements.push(dataTable("PUBLISHABLE CLIENTS – List of this department's PUBLISHABLE clients. Please indicate whether a client is a new client (within the last 12 months). If this information is not known, leave the field blank.", ['', 'Name of Client', 'New Client (Y/N)'], d0Rows, { labelPrefix: 'D0 –' }));

  // D matters
  for (let i = 0; i < pubMatters.length; i++) {
    elements.push(new Paragraph({ children: [new PageBreak()] }));
    elements.push(matterTable(i + 1, 'D', 'Publishable', pubMatters[i], exportMode));
    elements.push(para('IMPORTANT: Please do not exceed one page per deal.', { bold: true, italics: true, size: 16, color: 'B91C1C', spacing: { before: 100, after: 100 } }));
  }

  // ═══ SECTION E ═══
  elements.push(new Paragraph({ children: [new PageBreak()] }));
  elements.push(para('E. CONFIDENTIAL INFORMATION', { bold: true, size: 24, alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 } }));
  elements.push(para("All information in section 'E' is considered CONFIDENTIAL and NOT FOR PUBLICATION. Information in this section will only be used for our internal ranking purposes. If any part of a matter is confidential it should be included in this section 'E' not section 'D'.", { italics: true, size: 16, spacing: { after: 200 } }));

  // E0 Confidential Clients
  const confClients = [...new Set(confMatters.map((m: any) => m.client).filter(Boolean))];
  const e0Rows = confClients.length > 0
    ? confClients.map((c, i) => [String(i + 1), String(c), 'No'])
    : [['', '', '']];
  while (e0Rows.length < 8) e0Rows.push(['', '', '']);
  elements.push(dataTable("CONFIDENTIAL CLIENTS – List of this department's CONFIDENTIAL clients. Please indicate whether a client is a new client (within the last 12 months). If this information is not known, leave the field blank.", ['', 'Name of Client', 'New Client (Y/N)'], e0Rows, { labelPrefix: 'E0 –' }));

  // E matters
  for (let i = 0; i < confMatters.length; i++) {
    elements.push(new Paragraph({ children: [new PageBreak()] }));
    elements.push(matterTable(i + 1, 'E', 'Confidential', confMatters[i], exportMode));
    elements.push(para('IMPORTANT: Please do not exceed one page per deal.', { bold: true, italics: true, size: 16, color: 'B91C1C', spacing: { before: 100, after: 100 } }));
  }

  // Build document with header/footer and cross-platform compatibility (v8.0)
  return new Document({
    title: `Chambers Submission - ${firmName} - ${practiceArea}`,
    creator: 'RankPilot 2026',
    description: `Chambers & Partners submission form for ${firmName} in ${practiceArea}`,
    compatibility: {
      doNotExpandShiftReturn: true,
      version: 15, // Word 2013+ compatible — improves Google Docs/LibreOffice rendering
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
            para('You will need a username and password to manage your submission and profile. If you do not have an account with Chambers, please onboard here: https://chambers.com/info/onboard-with-chambers', { size: 14, alignment: AlignmentType.CENTER }),
          ],
        }),
      },
      children: elements,
    }],
  });
}
