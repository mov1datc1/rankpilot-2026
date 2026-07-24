import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, VerticalAlign, TableLayoutType
} from 'docx';
import { buildSubmissionDoc } from './submission-builder';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const submissionId = searchParams.get('id');
    const docType = searchParams.get('type') || 'audit';
    const exportMode = searchParams.get('mode') || 'optimized'; // 'original' | 'optimized'

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
    const firmName = chambersData.firm_name || chambersData.firmName || chambersData.metadata?.firm_name || context.firm_name || submission.practiceArea || 'The Firm';
    const practiceArea = submission.practiceArea || 'General Practice';

    let doc: Document;
    if (docType === 'submission') {
      doc = buildSubmissionDoc(firmName, practiceArea, chambersData, submission, exportMode);
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
    layout: TableLayoutType.FIXED,
  });
}

// ═══════════════════════════════════════════════════════════════
// AUDIT DOCUMENT (Strategic Report with AI Recommendations)
// ═══════════════════════════════════════════════════════════════

function buildAuditDoc(firmName: string, practiceArea: string, analysis: any, context: any, letter: any, submission: any): Document {
  const dateStr = new Date(submission.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const sections: (Paragraph | Table)[] = [];

  // Extract v6.0-v10.0 data from chambersData
  const chambersData = (submission.chambersData || submission.chambers_data || {}) as any;
  const competitiveIdentity = chambersData.competitive_identity || {};
  const editorialConfidence = chambersData.editorial_confidence || {};
  const narrativeArch = chambersData.narrative_architecture || {};
  const reasoningTrace = chambersData.reasoning_trace || [];
  const submissionBlueprint = chambersData.submission_blueprint || {};
  const comparativeAnalysis = chambersData.comparative_analysis || {};

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

  // ═══ NEW §1: Evaluation Context Banner ═══
  const ctxLine = [
    `Directory: ${submission.targetDirectory || 'N/A'}`,
    `Practice: ${submission.practiceArea || 'N/A'}`,
    `Jurisdiction: ${submission.guideRegion || 'N/A'}`,
    `Current Band: ${submission.currentBand || 'Unranked'}`
  ].join('  |  ');
  sections.push(
    p(ctxLine, { bold: true, color: '4338CA', size: 20, spacing: { after: 300 } })
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

  // ═══ NEW §2: Competitive Identity Statement ═══
  const identityStatement = competitiveIdentity.identity_statement || '';
  const identityCoherence = competitiveIdentity.identity_coherence || '';
  if (identityStatement) {
    sections.push(
      sectionTitle('Competitive Identity'),
      p(`Coherence: ${identityCoherence ? identityCoherence.charAt(0).toUpperCase() + identityCoherence.slice(1) : 'Pending'}`, { bold: true, color: '6366F1', spacing: { after: 80 } }),
      p(String(identityStatement), { size: 24, spacing: { after: 100 } })
    );
    if (competitiveIdentity.sub_specialization) {
      sections.push(p(`Sub-specialization: ${competitiveIdentity.sub_specialization}`, { italics: true, color: GRAY, spacing: { after: 200 } }));
    }
  }

  // ═══ NEW §3: Editorial Thesis + Hero Matter ═══
  const thesis = narrativeArch.thesis_statement || '';
  const heroMatter = narrativeArch.hero_matter || '';
  if (thesis || heroMatter) {
    sections.push(sectionTitle('Editorial Thesis & Hero Matter'));
    if (thesis) {
      sections.push(
        subTitle('Editorial Thesis'),
        p(String(thesis), { spacing: { after: 200 } })
      );
    }
    if (heroMatter) {
      sections.push(
        subTitle('Hero Matter'),
        p(String(heroMatter), { bold: true, spacing: { after: 80 } })
      );
      if (narrativeArch.hero_matter_rationale) {
        sections.push(p(`Rationale: ${narrativeArch.hero_matter_rationale}`, { italics: true, color: GRAY, spacing: { after: 80 } }));
      }
      if (submissionBlueprint.hero_selection_reasoning) {
        sections.push(p(`Why this matter: ${submissionBlueprint.hero_selection_reasoning}`, { italics: true, color: '4338CA', spacing: { after: 200 } }));
      }
    }
  }

  // ═══ NEW §4: Editorial Confidence Breakdown (6 dimensions) ═══
  const confDimensions = [
    { label: 'Evidence Completeness', score: editorialConfidence.evidence_completeness_score || 0 },
    { label: 'Matter Quality', score: editorialConfidence.matter_quality_score || 0 },
    { label: 'Leadership Visibility', score: editorialConfidence.leadership_visibility_score || 0 },
    { label: 'Narrative Cohesion', score: editorialConfidence.narrative_cohesion_score || 0 },
    { label: 'Differentiation', score: editorialConfidence.differentiation_score || 0 },
    { label: 'Institutional Depth', score: editorialConfidence.institutional_depth_score || 0 },
  ];
  const hasConfScores = confDimensions.some(d => d.score > 0);
  if (hasConfScores) {
    sections.push(sectionTitle('Editorial Confidence Breakdown'));
    const overallConf = editorialConfidence.overall_confidence || 'Pending';
    const passesDefensibility = editorialConfidence.passes_defensibility_test ? 'Yes' : 'No';
    sections.push(
      p(`Overall Confidence: ${overallConf.charAt(0).toUpperCase() + overallConf.slice(1)}  |  Passes Defensibility Test: ${passesDefensibility}`, { bold: true, color: NAVY, spacing: { after: 100 } })
    );
    if (editorialConfidence.defensibility_summary) {
      sections.push(p(String(editorialConfidence.defensibility_summary), { italics: true, color: GRAY, spacing: { after: 100 } }));
    }
    // Confidence dimensions as table
    const confRows = confDimensions.map(d => [d.label, `${d.score}%`, d.score >= 70 ? 'Strong' : d.score >= 40 ? 'Moderate' : 'Weak']);
    sections.push(makeTable(['Dimension', 'Score', 'Rating'], confRows));
    sections.push(emptyRow());
  }

  // Band Alignment from comparative analysis
  const bandAlignment = comparativeAnalysis.band_alignment || '';
  if (bandAlignment) {
    sections.push(
      p(`Band Alignment: ${bandAlignment}`, { bold: true, color: NAVY, spacing: { after: 200 } })
    );
  }

  // ═══ NEW §5: Narrative Strategy ═══
  const narrativeStrategy = Array.isArray(letter.narrative_strategy) ? letter.narrative_strategy : [];
  if (narrativeStrategy.length > 0) {
    sections.push(sectionTitle('Narrative Strategy'));
    for (const bullet of narrativeStrategy) {
      sections.push(new Paragraph({
        children: [new TextRun({ text: `→  ${typeof bullet === 'string' ? bullet : JSON.stringify(bullet)}`, size: 22 })],
        indent: { left: 400 },
        spacing: { after: 80 },
      }));
    }
    sections.push(emptyRow());
  }

  // State of Play
  if (letter.the_state_of_play) {
    sections.push(sectionTitle('The State of Play'), p(String(letter.the_state_of_play), { spacing: { after: 300 } }));
  }

  // Unfair Advantage
  if (letter.the_unfair_advantage) {
    sections.push(sectionTitle('The Unfair Advantage'), p(String(letter.the_unfair_advantage), { spacing: { after: 300 } }));
  }

  // Competitive Context
  if (letter.competitive_context) {
    sections.push(sectionTitle('Competitive Positioning'), p(String(letter.competitive_context), { spacing: { after: 300 } }));
  }

  // Reality Check
  const realityCheck = Array.isArray(letter.the_reality_check) ? letter.the_reality_check : (typeof letter.the_reality_check === 'string' ? [letter.the_reality_check] : []);
  if (realityCheck.length > 0) {
    sections.push(
      sectionTitle('The Reality Check'),
      p('Editorial observations on the submission\'s competitive positioning:', { color: GRAY, spacing: { after: 100 } })
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
        p(`STEP ${i + 1}: ${title}`, { bold: true, size: 24, color: NAVY, spacing: { before: 200, after: 80 } })
      );
      if (typeof step === 'object' && step.why) {
        sections.push(p(`Why: ${step.why}`, { italics: true, color: '6366F1', spacing: { after: 60 } }));
      }
      if (typeof step === 'object' && step.what_must_be_delivered) {
        sections.push(p(`What must be delivered: ${step.what_must_be_delivered}`, { color: '15803D', spacing: { after: 60 } }));
      }
      if (typeof step === 'object' && step.deadline) {
        sections.push(p(`Deadline: ${step.deadline}`, { bold: true, color: 'D97706', spacing: { after: 60 } }));
      }
      sections.push(p(desc, { spacing: { after: 200 } }));
    }
  }

  // ═══ NEW §6: Matter Evaluations Table ═══
  const matterEvals = Array.isArray(letter.matter_evaluations) ? letter.matter_evaluations : [];
  if (matterEvals.length > 0) {
    sections.push(sectionTitle('Case Evaluation — Matter Scores'));
    const evalRows = matterEvals.map((ev: any) => [
      ev.matter_name || 'Unknown',
      ev.type || 'publishable',
      ev.quality_label || 'Pending',
      `${typeof ev.score === 'number' ? ev.score : 0}/100`,
      ev.improvement_note || ''
    ]);
    sections.push(makeTable(['Matter', 'Type', 'Quality Label', 'Score', 'Improvement Note'], evalRows));
    sections.push(emptyRow());
  }

  // AI Recommended Rewrites
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

  // AI Competitive Positioning Text
  if (letter.competitive_positioning_text) {
    sections.push(sectionTitle('Ready-to-Use Competitive Positioning'));
    sections.push(p('The following paragraph is AI-generated and ready to be inserted into Section B7 or C2 of your submission:', { italics: true, color: GRAY, spacing: { after: 100 } }));
    sections.push(p(String(letter.competitive_positioning_text), { spacing: { after: 300 } }));
  }

  // ═══ NEW §7: Editorial Reasoning Trace ═══
  if (Array.isArray(reasoningTrace) && reasoningTrace.length > 0) {
    sections.push(sectionTitle('Editorial Reasoning Trace'));
    sections.push(p('Why the AI made each editorial decision — full transparency:', { italics: true, color: GRAY, spacing: { after: 200 } }));
    for (let i = 0; i < reasoningTrace.length; i++) {
      const entry = reasoningTrace[i];
      if (!entry) continue;
      const stage = entry.stage || 'unknown';
      const decision = typeof entry.decision === 'string' ? entry.decision : (entry.decision ? JSON.stringify(entry.decision) : 'Decision recorded');
      const conf = entry.confidence ? `${Math.round(entry.confidence * 100)}%` : '';
      sections.push(
        p(`[${stage.toUpperCase()}] ${decision}${conf ? ` — Confidence: ${conf}` : ''}`, { bold: true, size: 20, spacing: { before: 200, after: 60 } })
      );
      if (Array.isArray(entry.evidence_used) && entry.evidence_used.length > 0) {
        sections.push(p('Evidence used:', { bold: true, size: 18, color: GRAY, spacing: { after: 40 } }));
        for (const ev of entry.evidence_used) {
          sections.push(new Paragraph({
            children: [new TextRun({ text: `  · ${String(ev)}`, size: 18, color: LIGHT_GRAY })],
            spacing: { after: 30 },
          }));
        }
      }
      if (entry.principle_applied) {
        sections.push(p(`Principle: ${entry.principle_applied}`, { italics: true, color: '6366F1', size: 18, spacing: { after: 80 } }));
      }
    }
  }

  // ═══ NEW §8: Matter Accountability Panel ═══
  const allDispositions = Array.isArray(submissionBlueprint.all_matter_dispositions) ? submissionBlueprint.all_matter_dispositions : [];
  if (allDispositions.length > 0 || submissionBlueprint.transformation_summary) {
    sections.push(sectionTitle('Matter Accountability'));
    sections.push(p(`${submission.matters?.length || allDispositions.length} matters tracked — zero loss guarantee`, { bold: true, color: '065F46', spacing: { after: 100 } }));
    
    if (submissionBlueprint.transformation_summary) {
      sections.push(
        subTitle('Transformation Summary'),
        p(String(submissionBlueprint.transformation_summary), { spacing: { after: 200 } })
      );
    }

    if (allDispositions.length > 0) {
      const dispRows = allDispositions.map((disp: any) => [
        disp.matter_title || 'Unknown',
        (disp.disposition || 'tracked').replace(/_/g, ' '),
        disp.rationale || ''
      ]);
      sections.push(makeTable(['Matter', 'Disposition', 'Rationale'], dispRows));
    }
  }

  return new Document({
    title: `RankPilot Strategic Audit - ${firmName} - ${practiceArea}`,
    creator: 'RankPilot 2026',
    description: `Strategic audit letter for ${firmName} in ${practiceArea}`,
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          run: { font: 'Calibri', size: 22 },
          paragraph: { spacing: { after: 60 } },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Calibri', size: 28, bold: true, color: NAVY },
          paragraph: { spacing: { before: 400, after: 200 } },
        },
      ],
    },
    sections: [{ children: sections }],
  });
}

