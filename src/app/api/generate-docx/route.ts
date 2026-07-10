import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, PageBreak, TableLayoutType,
  VerticalAlign, convertInchesToTwip
} from 'docx';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const submissionId = searchParams.get('id');
    const docType = searchParams.get('type') || 'audit';

    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submission ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let resolvedUserId = user.id;
    if (user.email) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });
      if (existingByEmail) {
        resolvedUserId = existingByEmail.id;
      }
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { matters: true }
    });

    if (!submission || (submission.userId !== user.id && submission.userId !== resolvedUserId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const chambersData = submission.chambersData as any || {};
    const analysis = chambersData.analysis || {};
    const context = chambersData.strategicContext || {};
    const letter = analysis.audit_letter || {};
    const firmName = chambersData.firm_name || chambersData.firmName || context.firm_name || submission.practiceArea || 'The Firm';
    const practiceArea = submission.practiceArea || 'General Practice';

    let doc: Document;
    if (docType === 'submission') {
      doc = buildSubmissionDoc(firmName, practiceArea, chambersData, submission);
    } else {
      doc = buildAuditDoc(firmName, practiceArea, analysis, context, letter, submission);
    }

    const buffer = await Packer.toBuffer(doc);
    const uint8 = new Uint8Array(buffer);

    const prefix = docType === 'submission' ? 'Submission_Form' : 'Strategic_Audit';
    return new NextResponse(uint8, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="RankPilot_${prefix}_${practiceArea.replace(/\s+/g, '_')}.docx"`,
      },
    });
  } catch (error: any) {
    console.error('DOCX generation error:', error);
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════

const NAVY = '1A237E';
const GRAY = '475569';
const LIGHT_GRAY = '666666';
const HEADER_BG = 'E8EAF6';

function p(text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean; spacing?: any; alignment?: any } = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, size: opts.size || 22, color: opts.color, italics: opts.italics })],
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
    children: [new TextRun({ text, bold: true, size: 28, color: NAVY })],
    spacing: { before: 400, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY } },
  });
}

function subTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color: '333333' })],
    spacing: { before: 300, after: 100 },
  });
}

function instruction(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, italics: true, size: 18, color: LIGHT_GRAY })],
    spacing: { after: 100 },
  });
}

function emptyRow(): Paragraph {
  return new Paragraph({ spacing: { after: 100 } });
}

// Create a proper Word table
function makeTable(headers: string[], rows: string[][]): Table {
  const headerCells = headers.map(h => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: NAVY })], spacing: { after: 40 } })],
    shading: { type: ShadingType.SOLID, color: HEADER_BG },
    verticalAlign: VerticalAlign.CENTER,
    width: { size: Math.floor(10000 / headers.length), type: WidthType.DXA },
  }));

  const dataRows = rows.map(row => new TableRow({
    children: row.map(cell => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: cell || '', size: 20 })], spacing: { after: 40 } })],
      verticalAlign: VerticalAlign.CENTER,
    })),
  }));

  return new Table({
    rows: [new TableRow({ children: headerCells }), ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ═══════════════════════════════════════════════════════════════
// AUDIT DOCUMENT (Strategic Report with AI Recommendations)
// ═══════════════════════════════════════════════════════════════

function buildAuditDoc(firmName: string, practiceArea: string, analysis: any, context: any, letter: any, submission: any): Document {
  const dateStr = new Date(submission.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const sections: Paragraph[] = [];

  // Title
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: 'RANKPILOT', size: 36, bold: true, color: NAVY }), new TextRun({ text: ' — Strategic Audit Letter', size: 36, color: GRAY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '━'.repeat(60), color: 'F59E0B', size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Meta
  sections.push(
    fieldLabel('To: ', `The Board of Directors — ${firmName}`),
    fieldLabel('From: ', 'RankPilot Consulting'),
    fieldLabel('Re: ', `${submission.targetDirectory || 'Chambers'} · ${practiceArea} · ${submission.guideRegion || 'Global'}`),
    fieldLabel('Date: ', dateStr),
    emptyRow()
  );

  // Score Summary
  const riskLevel = analysis.risk_level || 'Pending';
  const score = analysis.score || 0;
  const archetype = context.archetype || 'Pending';
  const target = context.target_realistic || 'Pending';

  sections.push(
    p(`Risk Level: ${riskLevel}  |  Score: ${score}/100  |  Archetype: ${archetype}  |  Target: ${target}`, { italics: true, color: GRAY, spacing: { after: 300 } })
  );

  // Executive Summary
  if (analysis.summary) {
    sections.push(
      sectionTitle('Executive Summary'),
      p(String(analysis.summary), { italics: true, color: GRAY, spacing: { after: 300 } })
    );
  }

  // State of Play
  if (letter.the_state_of_play) {
    sections.push(sectionTitle('The State of Play'), p(String(letter.the_state_of_play), { spacing: { after: 300 } }));
  }

  // Unfair Advantage
  if (letter.the_unfair_advantage) {
    sections.push(sectionTitle('The Unfair Advantage'), p(String(letter.the_unfair_advantage), { spacing: { after: 300 } }));
  }

  // Competitive Context (NEW)
  if (letter.competitive_context) {
    sections.push(sectionTitle('Competitive Positioning'), p(String(letter.competitive_context), { spacing: { after: 300 } }));
  }

  // Reality Check
  const realityCheck = Array.isArray(letter.the_reality_check) ? letter.the_reality_check : (typeof letter.the_reality_check === 'string' ? [letter.the_reality_check] : []);
  if (realityCheck.length > 0) {
    sections.push(
      sectionTitle('The Reality Check'),
      p('The submission is currently held back by avoidable defects:', { color: GRAY, spacing: { after: 100 } })
    );
    for (const item of realityCheck) {
      sections.push(new Paragraph({
        children: [new TextRun({ text: `•  ${typeof item === 'object' ? JSON.stringify(item) : String(item)}`, size: 22 })],
        indent: { left: 400 },
        spacing: { after: 80 },
      }));
    }
  }

  // Path to Dominance
  const path = Array.isArray(letter.the_path_to_dominance) ? letter.the_path_to_dominance : [];
  if (path.length > 0) {
    sections.push(sectionTitle('The Path to Dominance'));
    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      const title = typeof step === 'object' ? (step.title || 'Strategic Step') : 'Strategic Step';
      const desc = typeof step === 'object' ? (step.description || JSON.stringify(step)) : String(step);
      sections.push(
        p(`STEP ${i + 1}: ${title}`, { bold: true, size: 24, color: NAVY, spacing: { before: 200, after: 80 } }),
        p(desc, { spacing: { after: 200 } })
      );
    }
  }

  // AI Recommended Rewrites (NEW SECTION)
  const rewrites = Array.isArray(letter.recommended_rewrites) ? letter.recommended_rewrites : [];
  if (rewrites.length > 0) {
    sections.push(sectionTitle('AI-Recommended Matter Rewrites'));
    sections.push(p('The following matters have been identified as strategically weak. Below are AI-generated improved versions ready for submission:', { color: GRAY, italics: true, spacing: { after: 200 } }));

    for (let i = 0; i < rewrites.length; i++) {
      const rw = rewrites[i];
      sections.push(
        p(`Rewrite ${i + 1}`, { bold: true, size: 24, color: NAVY, spacing: { before: 300, after: 80 } }),
        p('ORIGINAL:', { bold: true, color: 'B91C1C', spacing: { after: 60 } }),
        p(String(rw.original || 'N/A'), { color: '6B7280', italics: true, spacing: { after: 120 } }),
        p('IMPROVED VERSION:', { bold: true, color: '15803D', spacing: { after: 60 } }),
        p(String(rw.improved || 'N/A'), { spacing: { after: 120 } }),
        p(`Rationale: ${String(rw.rationale || '')}`, { italics: true, color: GRAY, spacing: { after: 200 } })
      );
    }
  }

  // AI Competitive Positioning Text (NEW)
  if (letter.competitive_positioning_text) {
    sections.push(sectionTitle('Ready-to-Use Competitive Positioning'));
    sections.push(p('The following paragraph is AI-generated and ready to be inserted into Section B7 or C2 of your submission:', { italics: true, color: GRAY, spacing: { after: 100 } }));
    sections.push(p(String(letter.competitive_positioning_text), { spacing: { after: 300 } }));
  }

  return new Document({ sections: [{ children: sections }] });
}

// ═══════════════════════════════════════════════════════════════
// CHAMBERS SUBMISSION DOCUMENT — Exact Official Template Replica
// ═══════════════════════════════════════════════════════════════

function buildSubmissionDoc(firmName: string, practiceArea: string, chambersData: any, submission: any): Document {
  const elements: (Paragraph | Table)[] = [];
  const guideRegion = submission.guideRegion || chambersData.jurisdiction || '';

  // ═══ TITLE PAGE ═══
  elements.push(
    p('SUBMISSION FORM', { bold: true, size: 36, color: NAVY, alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
    instruction('Please do not alter this submission template. If a question does not apply to you, please leave it blank.'),
    instruction('If something is confidential, mark it as such throughout.'),
    instruction('Please upload submissions online at: https://myaccount.chambers.com'),
    instruction('You will need a username and password to manage your submission and profile. If you do not have an account with Chambers, please onboard here: How to Onboard With Chambers | Chambers and Partners'),
    emptyRow()
  );

  // ═══ SECTION A: PRELIMINARY INFORMATION ═══
  elements.push(sectionTitle('A. PRELIMINARY INFORMATION'));
  elements.push(subTitle('A1 Firm name'));
  elements.push(p(firmName));
  elements.push(subTitle('A2 Practice Area'));
  elements.push(p(practiceArea));
  elements.push(subTitle('A3 Location (Jurisdiction)'));
  elements.push(p(guideRegion));
  elements.push(subTitle('A4 Contact person(s) to arrange interviews about this practice area'));

  // A4 Table
  const contacts = chambersData.contacts || [];
  const contactRows = contacts.length > 0
    ? contacts.map((c: any) => [c.name || '', c.email || '', c.phone || ''])
    : [['', '', '']];
  elements.push(makeTable(['Name', 'Email', 'Telephone number'], contactRows));

  // ═══ SECTION B: DEPARTMENT INFORMATION ═══
  elements.push(sectionTitle('B. DEPARTMENT INFORMATION'));

  elements.push(subTitle('B1 Department name (used by firm)'));
  elements.push(p(chambersData.departmentName || ''));

  elements.push(subTitle('B2 Number of partners in the department'));
  elements.push(p(String(chambersData.numPartners || '')));

  elements.push(subTitle('B3 Number of other qualified lawyers'));
  elements.push(p(String(chambersData.numLawyers || '')));

  elements.push(subTitle('B4 Department Head(s) or Key Partners'));
  const heads = chambersData.departmentHeads || chambersData.lawyers || [];
  const headRows = heads.length > 0
    ? heads.map((h: any) => [h.name || '', h.email || '', h.phone || ''])
    : [['', '', '']];
  elements.push(makeTable(['Name', 'Email', 'Telephone number'], headRows));

  elements.push(subTitle('B5 Hires / Departures of partners in last 12 months'));
  instruction('(state if they joined or left, and name of the other firm)');
  const hires = chambersData.hires || [];
  const hireRows = hires.length > 0
    ? hires.map((h: any) => [h.name || '', h.status || '', h.firm || ''])
    : [['', '', '']];
  elements.push(makeTable(['Name', 'Joined / Departed', 'Joined From / Destination (firm)'], hireRows));

  elements.push(subTitle('B6 Information regarding Ranked and Unranked lawyers (including associates) in this practice area.'));
  elements.push(instruction('Please do not repeat additional biographical information which is available on your website or via other sources. You may include a link to these biographies.'));

  // B6 Lawyer Table
  const lawyers = chambersData.lawyers || [];
  const lawyerHeaders = ['Name', 'Comments or Web Link', 'Partner Y/N', 'Ranked Y/N'];
  const lawyerRows = lawyers.length > 0
    ? lawyers.map((l: any) => {
        const bio = [
          l.url || '',
          l.currentRank ? `Current ranking: ${l.currentRank}` : '',
          l.suggestedRank ? `Suggested ranking: ${l.suggestedRank}` : '',
          l.focus ? `Key areas of focus: ${l.focus}` : '',
          l.standoutWork ? `Standout recent work: ${l.standoutWork}` : '',
        ].filter(Boolean).join('\n');
        return [l.name || '', bio, l.isPartner ? 'Y' : 'N', l.isRanked ? 'Y' : 'N'];
      })
    : [['', '', '', '']];
  elements.push(makeTable(lawyerHeaders, lawyerRows));

  elements.push(subTitle('B7 What is this department best known for?'));
  elements.push(instruction('Please include: industry sector expertise; key types of work; areas of recent growth.'));
  elements.push(instruction('Address any feedback on our recent coverage of your department (500 word count limit)'));
  const b7Content = chambersData.departmentDesc || chambersData.specialties || chambersData.b7 || '';
  if (b7Content) {
    elements.push(p(String(b7Content), { spacing: { after: 200 } }));
  }

  // ═══ SECTION C: FEEDBACK ═══
  elements.push(sectionTitle('C. FEEDBACK'));

  elements.push(subTitle('C1 If you have used barristers / advocates in the UK, Australia, Hong Kong, India, Malaysia, New Zealand or Sri Lanka please provide the information below (Optional)'));
  elements.push(makeTable(['Barrister/advocate name', 'Firm / Set', 'Comments'], [['', '', '']]));

  elements.push(subTitle('C2 Feedback on our coverage of this practice area (Optional)'));
  const c2 = chambersData.feedback || chambersData.c2 || 'We would be happy to discuss the market during a telephone interview.';
  elements.push(p(String(c2), { spacing: { after: 200 } }));

  // ═══ WORK HIGHLIGHTS HEADER ═══
  elements.push(sectionTitle('WORK HIGHLIGHTS AND CLIENTS'));
  elements.push(instruction('Provide details of up-to a total of 20 work highlights for this area. Matters may be either listed as publishable or confidential but the total should not exceed 20.'));

  // ═══ SECTION D: PUBLISHABLE INFORMATION ═══
  elements.push(sectionTitle('D. PUBLISHABLE INFORMATION'));
  elements.push(instruction("All information in section 'D' is considered PUBLISHABLE. Do not include any confidential information in this section. Confidential information can be included in section 'E'. Information in section 'D' may be printed in Chambers and Partners publications. If any part of a matter is confidential it should be included in section 'E' not this section 'D'."));

  // D0 — Publishable Clients Table
  elements.push(subTitle("D0 – PUBLISHABLE CLIENTS – List of this department's PUBLISHABLE clients. Please indicate whether a client is a new client (within the last 12 months). If this information is not known, leave the field blank."));

  const matters = submission.matters || [];
  const publishableMatters = matters.filter((m: any) => !m.isConfidential);
  const confidentialMatters = matters.filter((m: any) => m.isConfidential);

  // Extract unique publishable clients
  const pubClients = [...new Set(publishableMatters.map((m: any) => m.client).filter(Boolean))];
  if (pubClients.length > 0) {
    elements.push(makeTable(
      ['Name of Client', 'New Client (Y/N)'],
      pubClients.map(c => [String(c), 'No'])
    ));
  } else {
    elements.push(makeTable(['Name of Client', 'New Client (Y/N)'], [['', '']]));
  }

  // Publishable Matters (D1-D9 format)
  for (let i = 0; i < publishableMatters.length; i++) {
    const m = publishableMatters[i];
    elements.push(
      emptyRow(),
      subTitle('Publishable Work Highlights in last 12 months'),
      p(`Publishable Matter ${i + 1}`, { bold: true, size: 24, color: NAVY, spacing: { before: 200, after: 100 } }),

      subTitle('D1 Name of client – this will be publishable. If you cannot reveal the client name, give a general description.'),
      p(m.client || 'Undisclosed client'),

      subTitle("D2 Summary of matter and your department's role – Please say why this matter was important. Also, tell us exactly what role your department played."),
      p(m.optimizedText || m.rawNotes || '', { spacing: { after: 100 } }),

      subTitle('D3 Matter value – include currency and amount in figures'),
      p(m.value || 'N/A'),

      subTitle('D4 Is this a cross-border matter? If yes, please indicate the jurisdictions involved.'),
      p(m.crossBorder || ''),

      subTitle('D5 Lead partner'),
      p(m.leadPartner || ''),

      subTitle('D6 Other team members'),
      p(m.teamMembers || ''),

      subTitle('D7 Other firms advising on the matter and their role(s)'),
      p(m.otherFirms || ''),

      subTitle('D8 Date of completion or current status'),
      p(m.completionDate || ''),

      subTitle('D9 Other information about this matter – e.g. link to press coverage'),
      p(m.otherInfo || ''),

      p('IMPORTANT: Please do not exceed one page per deal.', { bold: true, italics: true, size: 18, color: 'B91C1C', spacing: { after: 200 } })
    );
  }

  // If no publishable matters, show all matters as publishable (default)
  if (publishableMatters.length === 0 && matters.length > 0) {
    for (let i = 0; i < matters.length; i++) {
      const m = matters[i];
      elements.push(
        emptyRow(),
        subTitle('Publishable Work Highlights in last 12 months'),
        p(`Publishable Matter ${i + 1}`, { bold: true, size: 24, color: NAVY, spacing: { before: 200, after: 100 } }),

        subTitle('D1 Name of client – this will be publishable. If you cannot reveal the client name, give a general description.'),
        p(m.client || 'Undisclosed client'),

        subTitle("D2 Summary of matter and your department's role – Please say why this matter was important. Also, tell us exactly what role your department played."),
        p(m.optimizedText || m.rawNotes || '', { spacing: { after: 100 } }),

        subTitle('D3 Matter value – include currency and amount in figures'),
        p(m.value || 'N/A'),

        subTitle('D4 Is this a cross-border matter? If yes, please indicate the jurisdictions involved.'),
        p(''),

        subTitle('D5 Lead partner'),
        p(m.leadPartner || ''),

        subTitle('D6 Other team members'),
        p(''),

        subTitle('D7 Other firms advising on the matter and their role(s)'),
        p(''),

        subTitle('D8 Date of completion or current status'),
        p(''),

        subTitle('D9 Other information about this matter – e.g. link to press coverage'),
        p(''),

        p('IMPORTANT: Please do not exceed one page per deal.', { bold: true, italics: true, size: 18, color: 'B91C1C', spacing: { after: 200 } })
      );
    }
  }

  // ═══ SECTION E: CONFIDENTIAL INFORMATION ═══
  elements.push(sectionTitle('E. CONFIDENTIAL INFORMATION'));
  elements.push(instruction("All information in section 'E' is considered CONFIDENTIAL and NOT FOR PUBLICATION."));
  elements.push(instruction("Information in this section will only be used for our internal ranking purposes. If any part of a matter is confidential it should be included in this section 'E' not section 'D'."));

  // E0 — Confidential Clients Table
  elements.push(subTitle("E0 – CONFIDENTIAL CLIENTS – List of this department's CONFIDENTIAL clients. Please indicate whether a client is a new client (within the last 12 months). If this information is not known, leave the field blank."));

  const confClients = [...new Set(confidentialMatters.map((m: any) => m.client).filter(Boolean))];
  if (confClients.length > 0) {
    elements.push(makeTable(
      ['#', 'Name of Client', 'New Client (Y/N)'],
      confClients.map((c, i) => [String(i + 1), String(c), 'No'])
    ));
  } else {
    elements.push(makeTable(['#', 'Name of Client', 'New Client (Y/N)'], [['', '', '']]));
  }

  // Confidential Matters (E1-E9 format)
  for (let i = 0; i < confidentialMatters.length; i++) {
    const m = confidentialMatters[i];
    elements.push(
      emptyRow(),
      subTitle('Confidential Work Highlights in last 12 months'),
      p(`Confidential Matter ${i + 1}`, { bold: true, size: 24, color: NAVY, spacing: { before: 200, after: 100 } }),

      subTitle('E1 Name of client (for ranking purposes only)'),
      p(m.client || ''),

      subTitle("E2 Summary of matter and your department's role – Please say why this matter was important. Also, tell us exactly what role your department played"),
      p(m.optimizedText || m.rawNotes || '', { spacing: { after: 100 } }),

      subTitle('E3 Matter value – include currency and amount in figures'),
      p(m.value || 'N/A'),

      subTitle('E4 Is this a cross-border matter? If yes, please indicate the jurisdictions involved.'),
      p(m.crossBorder || ''),

      subTitle('E5 Lead partner'),
      p(m.leadPartner || ''),

      subTitle('E6 Other team members'),
      p(m.teamMembers || ''),

      subTitle('E7 Other firms advising on the matter and their role(s)'),
      p(m.otherFirms || ''),

      subTitle('E8 Date of completion or current status'),
      p(m.completionDate || ''),

      subTitle('E9 Other information about this matter – e.g. link to press coverage'),
      p(m.otherInfo || ''),

      p('IMPORTANT: Please do not exceed one page per deal.', { bold: true, italics: true, size: 18, color: 'B91C1C', spacing: { after: 200 } })
    );
  }

  return new Document({ sections: [{ children: elements }] });
}
