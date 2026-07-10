import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, VerticalAlign
} from 'docx';
import { buildSubmissionDoc } from './submission-builder';

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

