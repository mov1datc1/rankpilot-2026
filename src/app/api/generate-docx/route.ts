import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const chambersData = (submission.chambersData as any) || {};
    const analysis = chambersData.analysis || {};
    const context = chambersData.strategicContext || {};
    const letter = analysis.audit_letter || {};
    const firmName = chambersData.firmName || submission.practiceArea || 'Professional Law Firm';
    const practiceArea = chambersData.practice || submission.practiceArea || 'General Practice';

    let doc: Document;

    if (docType === 'audit') {
      doc = buildAuditDoc(firmName, practiceArea, analysis, context, letter, submission);
    } else {
      doc = buildSubmissionDoc(firmName, practiceArea, chambersData, submission);
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
    console.error('Error in DOCX generation route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── AUDIT DOCUMENT ───
function buildAuditDoc(firmName: string, practiceArea: string, analysis: any, context: any, letter: any, submission: any): Document {
  const dateStr = new Date(submission.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const sections: Paragraph[] = [];

  // Title
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: 'RANKPILOT', size: 36, bold: true, color: '1A237E' }), new TextRun({ text: ' — Strategic Audit Letter', size: 36, color: '475569' })],
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
    new Paragraph({ children: [new TextRun({ text: 'To: ', bold: true, size: 22 }), new TextRun({ text: `The Board of Directors at ${firmName}`, size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: 'From: ', bold: true, size: 22 }), new TextRun({ text: 'RankPilot Consulting', size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: 'Date: ', bold: true, size: 22 }), new TextRun({ text: dateStr, size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: 'Practice Area: ', bold: true, size: 22 }), new TextRun({ text: practiceArea, size: 22 })] }),
    new Paragraph({ spacing: { after: 300 } })
  );

  // Score Summary
  const riskLevel = analysis.risk_level || 'Pending';
  const score = analysis.score || 0;
  const archetype = context.archetype || 'Pending';
  const target = context.target_realistic || 'Pending';

  sections.push(
    new Paragraph({ children: [new TextRun({ text: `Risk Level: ${riskLevel}  |  Score: ${score}/100  |  Archetype: ${archetype}  |  Target: ${target}`, size: 20, color: '475569', italics: true })], spacing: { after: 300 } })
  );

  // Executive Summary
  if (analysis.summary) {
    sections.push(
      new Paragraph({ text: 'Executive Summary', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }),
      new Paragraph({ children: [new TextRun({ text: String(analysis.summary), italics: true, size: 22, color: '475569' })], spacing: { after: 300 } })
    );
  }

  // State of Play
  if (letter.the_state_of_play) {
    sections.push(
      new Paragraph({ text: 'The State of Play', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }),
      new Paragraph({ children: [new TextRun({ text: String(letter.the_state_of_play), size: 22 })], spacing: { after: 300 } })
    );
  }

  // Unfair Advantage
  if (letter.the_unfair_advantage) {
    sections.push(
      new Paragraph({ text: 'The Unfair Advantage', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }),
      new Paragraph({ children: [new TextRun({ text: String(letter.the_unfair_advantage), size: 22 })], spacing: { after: 300 } })
    );
  }

  // Reality Check
  const realityCheck = Array.isArray(letter.the_reality_check) ? letter.the_reality_check : (typeof letter.the_reality_check === 'string' ? [letter.the_reality_check] : []);
  if (realityCheck.length > 0) {
    sections.push(
      new Paragraph({ text: 'The Reality Check', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }),
      new Paragraph({ children: [new TextRun({ text: 'The submission is currently held back by avoidable defects:', size: 22, color: '475569' })], spacing: { after: 100 } })
    );
    for (const item of realityCheck) {
      sections.push(new Paragraph({ children: [new TextRun({ text: `•  ${typeof item === 'object' ? JSON.stringify(item) : String(item)}`, size: 22 })], indent: { left: 400 }, spacing: { after: 80 } }));
    }
  }

  // Path to Dominance
  const path = Array.isArray(letter.the_path_to_dominance) ? letter.the_path_to_dominance : [];
  if (path.length > 0) {
    sections.push(new Paragraph({ text: 'The Path to Dominance', heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 100 } }));
    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      const title = typeof step === 'object' ? (step.title || 'Strategic Step') : 'Strategic Step';
      const desc = typeof step === 'object' ? (step.description || JSON.stringify(step)) : String(step);
      sections.push(
        new Paragraph({ children: [new TextRun({ text: `STEP ${i + 1}: ${title}`, bold: true, size: 24, color: '1A237E' })], spacing: { before: 200, after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: desc, size: 22 })], spacing: { after: 200 } })
      );
    }
  }

  return new Document({ sections: [{ children: sections }] });
}

// ─── CHAMBERS SUBMISSION DOCUMENT (Official Template) ───
function buildSubmissionDoc(firmName: string, practiceArea: string, chambersData: any, submission: any): Document {
  const sections: Paragraph[] = [];
  const guideRegion = submission.guideRegion || chambersData.jurisdiction || '';

  // Helper: labeled field
  const field = (label: string, value: string, bold = true) =>
    new Paragraph({ children: [new TextRun({ text: label, bold, size: 22 }), new TextRun({ text: value || '', size: 22 })], spacing: { after: 60 } });

  // Helper: section header with Chambers styling
  const sectionHeader = (text: string) =>
    new Paragraph({ children: [new TextRun({ text, bold: true, size: 26, color: '1A237E' })], spacing: { before: 400, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1A237E' } } });

  // Helper: subsection
  const subHeader = (text: string) =>
    new Paragraph({ children: [new TextRun({ text, bold: true, size: 24, color: '333333' })], spacing: { before: 300, after: 100 } });

  // Helper: instruction text
  const instruction = (text: string) =>
    new Paragraph({ children: [new TextRun({ text, italics: true, size: 18, color: '666666' })], spacing: { after: 100 } });

  // Helper: separator
  const separator = () =>
    new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })], border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' } }, spacing: { before: 200, after: 200 } });

  // ═══ TITLE ═══
  sections.push(
    new Paragraph({ children: [new TextRun({ text: 'SUBMISSION FORM', size: 36, bold: true, color: '1A237E' })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
    new Paragraph({ children: [new TextRun({ text: `${submission.targetDirectory || 'Chambers'} — ${practiceArea}`, size: 24, color: '475569' })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
    instruction('Please do not alter this submission template. If a question does not apply to you, please leave it blank.'),
    instruction('If something is confidential, mark it as such throughout. If any part of a matter is confidential it should be included in section \'E\' not section \'D\'.'),
    new Paragraph({ spacing: { after: 200 } })
  );

  // ═══ SECTION A: PRELIMINARY INFORMATION ═══
  sections.push(sectionHeader('A. PRELIMINARY INFORMATION'));
  sections.push(field('A1 Firm Name: ', firmName));
  sections.push(field('A2 Practice Area: ', practiceArea));
  sections.push(field('A3 Country / Region: ', guideRegion));
  sections.push(field('A4 Current Ranking: ', submission.currentBand || 'Not Ranked'));
  sections.push(field('A5 Website URL: ', chambersData.website || ''));
  if (chambersData.period) sections.push(field('A6 Period Covered: ', chambersData.period));

  // ═══ SECTION B: DEPARTMENT INFORMATION ═══
  sections.push(sectionHeader('B. DEPARTMENT INFORMATION'));

  // B1-B6: Lawyers
  sections.push(subHeader('B1-B6 Individual Rankings'));
  instruction('Provide information for individual lawyers within this department. We rank up to 6 individuals per firm per practice area.');
  const lawyers = chambersData.lawyers || [];
  if (lawyers.length > 0) {
    for (let i = 0; i < lawyers.length; i++) {
      const l = lawyers[i];
      sections.push(
        new Paragraph({ children: [new TextRun({ text: `Lawyer ${i + 1}: ${l.name || 'N/A'}`, bold: true, size: 22, color: '1A237E' })], spacing: { before: 200, after: 60 } }),
        field('Profile URL: ', l.url || ''),
        field('Current ranking: ', l.currentRank || 'Not Ranked'),
        field('Suggested ranking: ', l.suggestedRank || ''),
        field('Key areas of focus: ', l.focus || ''),
        field('Standout recent work: ', l.standoutWork || ''),
        separator()
      );
    }
  } else {
    sections.push(instruction('No individual lawyer profiles provided.'));
  }

  // B7: Department overview
  sections.push(subHeader('B7 What is this department best known for?'));
  sections.push(instruction('Please include: industry sector expertise; key types of work; areas of recent growth. Address any feedback on our recent coverage of your department (500 word count limit)'));
  if (chambersData.departmentDesc || chambersData.specialties) {
    sections.push(new Paragraph({ children: [new TextRun({ text: String(chambersData.departmentDesc || chambersData.specialties || ''), size: 22 })], spacing: { after: 200 } }));
  }

  // ═══ SECTION C: FEEDBACK ═══
  sections.push(sectionHeader('C. FEEDBACK'));
  sections.push(subHeader('C1 Barristers / Advocates (Optional)'));
  sections.push(instruction('If you have used barristers / advocates, please provide the information below.'));
  sections.push(subHeader('C2 Feedback on our coverage of this practice area (Optional)'));
  if (chambersData.feedback || chambersData.differentiators) {
    sections.push(new Paragraph({ children: [new TextRun({ text: String(chambersData.feedback || chambersData.differentiators || ''), size: 22 })], spacing: { after: 200 } }));
  } else {
    sections.push(instruction('We would be happy to discuss the market during a telephone interview.'));
  }

  // ═══ WORK HIGHLIGHTS AND CLIENTS ═══
  sections.push(sectionHeader('WORK HIGHLIGHTS AND CLIENTS'));
  sections.push(instruction('Provide details of up to a total of 20 work highlights for this area. Matters may be either listed as publishable or confidential but the total should not exceed 20.'));

  // ═══ SECTION D: PUBLISHABLE INFORMATION ═══
  sections.push(sectionHeader('D. PUBLISHABLE INFORMATION'));
  sections.push(instruction('All information in section \'D\' is considered PUBLISHABLE. Do not include any confidential information in this section. Confidential information can be included in section \'E\'. Information in section \'D\' may be printed in Chambers and Partners publications. If any part of a matter is confidential it should be included in section \'E\' not this section \'D\'.'));

  // D0 — Publishable Clients
  sections.push(subHeader('D0 – PUBLISHABLE CLIENTS'));
  sections.push(instruction('List of this department\'s PUBLISHABLE clients. Please indicate whether a client is a new client (within the last 12 months).'));

  const matters = submission.matters || [];
  const uniqueClients = [...new Set(matters.map((m: any) => m.client).filter(Boolean))];
  if (uniqueClients.length > 0) {
    sections.push(new Paragraph({ children: [new TextRun({ text: 'Name of Client', bold: true, size: 20 }), new TextRun({ text: '\t\tNew Client (Y/N)', bold: true, size: 20 })], spacing: { after: 60 } }));
    for (const client of uniqueClients) {
      sections.push(new Paragraph({ children: [new TextRun({ text: String(client), size: 22 }), new TextRun({ text: '\t\tNo', size: 22 })], spacing: { after: 40 } }));
    }
  }

  // Individual Matters (D1-D9 format)
  for (let i = 0; i < matters.length; i++) {
    const m = matters[i];
    const matterNum = i + 1;

    sections.push(
      new Paragraph({ spacing: { before: 300 } }),
      subHeader(`Publishable Work Highlights in last 12 months`),
      new Paragraph({ children: [new TextRun({ text: `Publishable Matter ${matterNum}`, bold: true, size: 24, color: '1A237E' })], spacing: { before: 200, after: 100 } }),

      // D1 — Client
      field('D1 Name of client – this will be publishable. If you cannot reveal the client name, give a general description.', ''),
      new Paragraph({ children: [new TextRun({ text: m.client || 'Undisclosed client', size: 22 })], spacing: { after: 100 } }),

      // D2 — Summary
      field('D2 Summary of matter and your department\'s role – Please say why this matter was important. Also, tell us exactly what role your department played.', ''),
      new Paragraph({ children: [new TextRun({ text: m.optimizedText || m.rawNotes || 'No description available.', size: 22 })], spacing: { after: 100 } }),

      // D3 — Value
      field('D3 Matter value – include currency and amount in figures', ''),
      new Paragraph({ children: [new TextRun({ text: m.value || 'N/A', size: 22 })], spacing: { after: 100 } }),

      // D4 — Cross-border
      field('D4 Is this a cross-border matter? If yes, please indicate the jurisdictions involved.', ''),
      new Paragraph({ children: [new TextRun({ text: '', size: 22 })], spacing: { after: 100 } }),

      // D5 — Lead partner
      field('D5 Lead partner', ''),
      new Paragraph({ children: [new TextRun({ text: m.leadPartner || '', size: 22 })], spacing: { after: 100 } }),

      // D6 — Team members
      field('D6 Other team members', ''),
      new Paragraph({ children: [new TextRun({ text: '', size: 22 })], spacing: { after: 100 } }),

      // D7 — Other firms
      field('D7 Other firms advising on the matter and their role(s)', ''),
      new Paragraph({ children: [new TextRun({ text: '', size: 22 })], spacing: { after: 100 } }),

      // D8 — Date/status
      field('D8 Date of completion or current status', ''),
      new Paragraph({ children: [new TextRun({ text: '', size: 22 })], spacing: { after: 100 } }),

      // D9 — Other info
      field('D9 Other information about this matter', ''),
      new Paragraph({ children: [new TextRun({ text: '', size: 22 })], spacing: { after: 100 } }),

      instruction('IMPORTANT: Please do not exceed one page per deal.'),
      separator()
    );
  }

  if (matters.length === 0) {
    sections.push(instruction('No publishable matters associated with this submission.'));
  }

  // ═══ SECTION E: CONFIDENTIAL INFORMATION ═══
  sections.push(sectionHeader('E. CONFIDENTIAL INFORMATION'));
  sections.push(instruction('All information in section \'E\' is considered CONFIDENTIAL and NOT FOR PUBLICATION. Information in this section will only be used for our internal ranking purposes. If any part of a matter is confidential it should be included in this section \'E\' not section \'D\'.'));

  sections.push(subHeader('E0 – CONFIDENTIAL CLIENTS'));
  sections.push(instruction('List of this department\'s CONFIDENTIAL clients. Please indicate whether a client is a new client (within the last 12 months).'));

  sections.push(subHeader('Confidential Work Highlights in last 12 months'));
  sections.push(instruction('No confidential matters have been added yet. Use this section for any matters where any element is confidential.'));

  return new Document({ sections: [{ children: sections }] });
}

