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

    const prefix = docType === 'submission' ? 'Submission_Form' : 'Strategic_Audit';
    return new NextResponse(buffer, {
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

// ─── CHAMBERS SUBMISSION DOCUMENT ───
function buildSubmissionDoc(firmName: string, practiceArea: string, chambersData: any, submission: any): Document {
  const sections: Paragraph[] = [];

  // Title
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: 'SUBMISSION FORM', size: 32, bold: true, color: '1A237E' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Please do not alter this submission template. If a question does not apply to you, please leave it blank.', size: 20, color: '475569', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'If something is confidential, mark it as such throughout.', size: 20, color: '475569', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Section A
  sections.push(
    new Paragraph({ text: 'A. PRELIMINARY INFORMATION', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: 'Firm Name: ', bold: true, size: 22 }), new TextRun({ text: firmName, size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: 'Practice Area: ', bold: true, size: 22 }), new TextRun({ text: practiceArea, size: 22 })] }),
  );
  if (chambersData.jurisdiction) {
    sections.push(new Paragraph({ children: [new TextRun({ text: 'Jurisdiction: ', bold: true, size: 22 }), new TextRun({ text: chambersData.jurisdiction, size: 22 })] }));
  }
  if (chambersData.period) {
    sections.push(new Paragraph({ children: [new TextRun({ text: 'Period: ', bold: true, size: 22 }), new TextRun({ text: chambersData.period, size: 22 })] }));
  }

  // Section B
  sections.push(new Paragraph({ text: 'B. DEPARTMENT INFORMATION', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
  if (chambersData.departmentDesc) {
    sections.push(
      new Paragraph({ children: [new TextRun({ text: 'Department Description:', bold: true, size: 22 })], spacing: { after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: String(chambersData.departmentDesc), size: 22 })], spacing: { after: 200 } })
    );
  }
  if (chambersData.teamSize) {
    sections.push(new Paragraph({ children: [new TextRun({ text: 'Team Size: ', bold: true, size: 22 }), new TextRun({ text: String(chambersData.teamSize), size: 22 })] }));
  }
  if (chambersData.specialties) {
    sections.push(new Paragraph({ children: [new TextRun({ text: 'Key Specialties: ', bold: true, size: 22 }), new TextRun({ text: String(chambersData.specialties), size: 22 })] }));
  }

  // Section C
  sections.push(new Paragraph({ text: 'C. FEEDBACK & DIFFERENTIATORS', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
  if (chambersData.feedback) {
    sections.push(new Paragraph({ children: [new TextRun({ text: String(chambersData.feedback), size: 22 })], spacing: { after: 200 } }));
  }
  if (chambersData.differentiators) {
    sections.push(
      new Paragraph({ children: [new TextRun({ text: 'Differentiators:', bold: true, size: 22 })], spacing: { after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: String(chambersData.differentiators), size: 22 })], spacing: { after: 200 } })
    );
  }

  // Section D — Matters
  sections.push(
    new Paragraph({ text: 'WORK HIGHLIGHTS AND CLIENTS', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 100 } }),
    new Paragraph({ children: [new TextRun({ text: 'Provide details of up to a total of 20 work highlights for this area.', size: 20, italics: true, color: '64748B' })], spacing: { after: 200 } }),
    new Paragraph({ text: 'D. PUBLISHABLE INFORMATION', heading: HeadingLevel.HEADING_2, spacing: { after: 200 } })
  );

  const matters = submission.matters || [];
  for (let i = 0; i < matters.length; i++) {
    const m = matters[i];
    sections.push(
      new Paragraph({ children: [new TextRun({ text: `Matter ${i + 1}: ${m.name || 'Untitled'}`, bold: true, size: 24, color: '1A237E' })], spacing: { before: 300, after: 100 } }),
      new Paragraph({ children: [new TextRun({ text: 'Client: ', bold: true, size: 22 }), new TextRun({ text: m.client || 'N/A', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: 'Value: ', bold: true, size: 22 }), new TextRun({ text: m.value || 'N/A', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: 'Lead Partner: ', bold: true, size: 22 }), new TextRun({ text: m.leadPartner || 'N/A', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: 'Matter Summary (Publishable):', bold: true, size: 22 })], spacing: { before: 100, after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: m.optimizedText || m.rawNotes || 'No description available.', size: 22 })], spacing: { after: 100 } }),
      new Paragraph({ children: [new TextRun({ text: '─'.repeat(50), color: 'CBD5E1', size: 18 })], spacing: { after: 200 } })
    );
  }

  if (matters.length === 0) {
    sections.push(new Paragraph({ children: [new TextRun({ text: 'No matters associated with this submission.', size: 22, italics: true, color: '94A3B8' })] }));
  }

  return new Document({ sections: [{ children: sections }] });
}
