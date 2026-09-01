import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, VerticalAlign, TableLayoutType
} from 'docx';
import { buildSubmissionDoc } from './submission-builder';

// Letter page width (8.5") minus 1" margins on both sides, in twentieths
// of a point. Google Docs requires explicit DXA table/grid/cell widths.
const CONTENT_WIDTH_DXA = 9360;

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
    let analysis = chambersData.analysis || {};
    const context = chambersData.strategicContext || {};
    
    // v17.1.3: Unwrap gpt-4o's nested {"analysis": {...}} wrapper
    // The Python pipeline saves the raw gpt-4o response which nests everything inside analysis.analysis
    if (analysis.analysis && typeof analysis.analysis === 'object' && !analysis.score) {
      const inner = analysis.analysis;
      // Always promote these critical fields from inner to top level
      const alwaysPromote = ['score', 'risk_level', 'summary', 'firm_name', 'practice_area',
        'location', 'current_band', 'matter_evaluations',
        'narrative_analysis', 'editorial_confidence', 'entry_case', 'competitive_identity',
        'surviving_hypotheses', 'comparative_analysis_summary', 'submission_summary'];
      for (const key of alwaysPromote) {
        if (inner[key] !== undefined) {
          (analysis as any)[key] = inner[key];
        }
      }
      // Also promote any other keys that don't exist at the top level
      for (const [k, v] of Object.entries(inner)) {
        if (k === 'analysis') continue; // Skip self-reference
        if (!(k in analysis)) {
          (analysis as any)[k] = v;
        }
      }
    }
    
    // v17.1: Build audit_letter from analysis fields if audit_letter is empty
    let letter = analysis.audit_letter || {};
    if (!letter.the_state_of_play && !letter.the_unfair_advantage) {
      // Reconstruct audit_letter from analysis fields that gpt-4o placed elsewhere
      const na = analysis.narrative_analysis || {};
      const ec = analysis.editorial_confidence || {};
      const comp = analysis.comparative_analysis_summary || analysis.comparative_analysis || '';
      const entryCase = analysis.entry_case || {};
      
      letter = {
        ...letter,
        the_state_of_play: letter.the_state_of_play 
          || (typeof na === 'string' ? na : na.thesis_statement || analysis.submission_summary?.overview || '')
          || analysis.summary || '',
        the_unfair_advantage: letter.the_unfair_advantage 
          || entryCase.strongest_entry_evidence?.join('. ')
          || (typeof na === 'object' ? na.hero_matter_rationale : '') || '',
        the_reality_check: letter.the_reality_check 
          || entryCase.critical_gaps 
          || (ec.recommendation === 'proceed_with_caveats' ? [ec.defensibility_summary || 'Evidence gaps identified'] : []),
        competitive_context: letter.competitive_context
          || (typeof comp === 'string' ? comp : comp.band_alignment || ''),
        narrative_strategy: letter.narrative_strategy || [],
        the_path_to_dominance: letter.the_path_to_dominance || [],
        matter_evaluations: letter.matter_evaluations || analysis.matter_evaluations || [],
        competitive_positioning_text: letter.competitive_positioning_text || '',
      };
    }
    
    // v17.1: Derive score from editorial_confidence if missing
    if (!analysis.score && analysis.editorial_confidence) {
      const confMap: Record<string, number> = { 'very high': 90, 'high': 80, 'moderate': 65, 'low': 45, 'limited': 30, 'insufficient': 35 };
      const overall = String(analysis.editorial_confidence.overall_confidence || '').toLowerCase();
      if (confMap[overall]) {
        analysis.score = confMap[overall];
      }
    }
    
    // v17.1.6: FIXED PRIORITY — AI-detected country FIRST
    // analysis.location = AI-detected "Venezuela" (country)
    // context.jurisdiction = UI dropdown "Latin America" (region)
    // chambersData.detectedJurisdiction = previously saved (might be stale)
    const detectedJurisdiction = analysis.location
      || chambersData.detectedJurisdiction
      || chambersData.metadata?.jurisdiction 
      || context.jurisdiction
      || analysis.practice_area_location;
    console.log(`[DOCX JURISDICTION] detectedJurisdiction='${detectedJurisdiction}' | analysis.location='${analysis.location}' | chambersData.detectedJurisdiction='${chambersData.detectedJurisdiction}' | context.jurisdiction='${context.jurisdiction}' | guideRegion='${submission.guideRegion}'`);
    // Always inject
    if (detectedJurisdiction) {
      chambersData.detectedJurisdiction = detectedJurisdiction;
    }
    
    const firmName = chambersData.firm_name || chambersData.firmName || chambersData.metadata?.firm_name || context.firm_name || analysis.firm_name || submission.practiceArea || 'The Firm';
    const practiceArea = submission.practiceArea || 'General Practice';

    // ═══════════════════════════════════════════════════════════
    // v19.0: CLONE-AND-REPLACE — Serve pre-built DOCX if available
    // The Python pipeline clones the original DOCX and only replaces
    // B10 + D2/E2 cells. This preserves ALL formatting (colors, bold,
    // logos, diversity sections, numbering, etc.)
    // ═══════════════════════════════════════════════════════════
    if (docType === 'submission' && chambersData.cloned_docx_b64) {
      console.log('[DOCX GENERATOR] ✅ Serving cloned DOCX (v19.0 Clone-and-Replace)');
      try {
        const docxBuffer = Buffer.from(chambersData.cloned_docx_b64, 'base64');
        const prefix = 'Submission_Form';
        return new NextResponse(new Uint8Array(docxBuffer), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="RankPilot_${prefix}_${practiceArea.replace(/\s+/g, '_')}.docx"`,
          },
        });
      } catch (cloneErr: any) {
        console.error('[DOCX GENERATOR] Failed to decode cloned DOCX, falling back to builder:', cloneErr.message);
        // Fall through to the TypeScript builder below
      }
    }

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
  const baseColumnWidth = Math.floor(CONTENT_WIDTH_DXA / headers.length);
  const columnWidths = headers.map((_, index) =>
    index === headers.length - 1
      ? CONTENT_WIDTH_DXA - baseColumnWidth * (headers.length - 1)
      : baseColumnWidth
  );

  const headerCells = headers.map((h, index) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: NAVY })], spacing: { after: 40 } })],
    shading: { type: ShadingType.SOLID, color: HEADER_BG },
    verticalAlign: VerticalAlign.CENTER,
    width: { size: columnWidths[index], type: WidthType.DXA },
  }));

  const dataRows = rows.map(row => new TableRow({
    children: headers.map((_, index) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: row[index] || '', size: 20 })], spacing: { after: 40 } })],
      verticalAlign: VerticalAlign.CENTER,
      width: { size: columnWidths[index], type: WidthType.DXA },
    })),
  }));

  return new Table({
    rows: [new TableRow({ children: headerCells }), ...dataRows],
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths,
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
  const pipelineManifest = chambersData.pipeline_manifest || {};
  const gapAnalysis = chambersData.matter_evidence_gaps || {};
  const artifactValidation = chambersData.artifact_validation || {};
  const evidenceReconciliation = chambersData.evidence_reconciliation || {};
  const strategicAudit = chambersData.strategic_audit || {};
  const lawyerAccountability = Array.isArray(strategicAudit.lawyer_accountability)
    ? strategicAudit.lawyer_accountability
    : [];

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
    fieldLabel('Re: ', (() => {
      const directory = submission.targetDirectory || 'Chambers & Partners';
      const region = submission.guideRegion || '';
      // v21.0.2: Priority chain for jurisdiction (Fix #2 from owner feedback)
      // 1. resolved_jurisdiction from pipeline context (most accurate — e.g., "Venezuela")
      // 2. detectedJurisdiction from DOCX template
      // 3. guideRegion from UI dropdown (may be generic like "Latin America")
      const resolvedJurisdiction = (submission.chambersData as any)?.strategic_context?.resolved_jurisdiction || '';
      const detectedJurisdiction = (submission.chambersData as any)?.detectedJurisdiction || '';
      const jurisdiction = resolvedJurisdiction || detectedJurisdiction || '';
      const practice = practiceArea || '';
      
      // Build hierarchy: Directory (Editorial) · Jurisdiction · Practice Area
      // v21.0.2: If we have a specific jurisdiction, DON'T show the generic region
      // Owner feedback: "Dice Latin America pero debería decir Venezuela"
      const genericRegions = ['latin america', 'europe', 'asia', 'global', 'africa', 'middle east', 'north america'];
      const regionIsGeneric = genericRegions.includes(region.toLowerCase().trim());
      
      const parts: string[] = [`${directory} (Editorial)`];
      if (jurisdiction) {
        parts.push(`${jurisdiction} (Jurisdiction)`);
        // Only show region separately if it's NOT generic AND different from jurisdiction
        if (region && !regionIsGeneric && region.toLowerCase() !== jurisdiction.toLowerCase()) {
          parts.push(`${region} (Region)`);
        }
      } else if (region) {
        parts.push(`${region} (Region/Jurisdiction)`);
      }
      if (practice) parts.push(`${practice} (Practice Area)`);
      return parts.join(' · ');
    })()),
    fieldLabel('Date: ', dateStr),
    emptyRow()
  );

  // ═══ v14.0 TRUST LAYER — Pipeline Manifest ═══
  if (pipelineManifest?.document) {
    const docInfo = pipelineManifest.document || {};
    const sourceMatters = docInfo.source_matters || {};
    const extraction = pipelineManifest.extraction || {};
    const ragFiles = pipelineManifest.rag_files_loaded || [];
    const ragChunks = Array.isArray(pipelineManifest.rag_chunks_loaded) ? pipelineManifest.rag_chunks_loaded : [];
    const modelProfiles = pipelineManifest.model_profiles || {};
    const hasLoss = (extraction.loss_count || 0) > 0 || (extraction.over_extraction_count || 0) > 0;
    const isMatch = extraction.match === true;

    sections.push(
      sectionTitle('Pipeline Manifest — Trust Layer'),
      p(`File: ${docInfo.file_name || 'Unknown'} | Hash: ${docInfo.file_hash || 'N/A'}`, { size: 20, spacing: { after: 60 } }),
      p(`Words: ${docInfo.word_count || 0} | Paragraphs: ${docInfo.paragraph_count || 0} | Tables: ${docInfo.table_count || 0}`, { size: 20, spacing: { after: 120 } }),
      p(`Source matters: ${sourceMatters.total ?? 'N/A'} (publishable: ${sourceMatters.publishable ?? 0}, confidential: ${sourceMatters.confidential ?? 0})`, { bold: true, spacing: { after: 60 } }),
      p(`Extracted by AI: ${extraction.extracted_matter_count ?? 'N/A'}`, { bold: true, spacing: { after: 60 } })
    );

    if (hasLoss) {
      sections.push(
        p(`⚠️ MATTER REGISTER MISMATCH: ${extraction.loss_count || 0} missing; ${extraction.over_extraction_count || 0} unsupported additions`, { bold: true, color: 'DC2626', size: 22, spacing: { after: 120 } })
      );
    } else if (isMatch) {
      sections.push(
        p('✅ Matter count VERIFIED — extraction matches source document', { bold: true, color: '16A34A', size: 22, spacing: { after: 120 } })
      );
    }

    if (sourceMatters.matter_labels?.length) {
      sections.push(p('Source matter labels:', { bold: true, size: 20, spacing: { after: 60 } }));
      for (const label of sourceMatters.matter_labels) {
        sections.push(p(`  • ${label}`, { size: 18, spacing: { after: 30 } }));
      }
    }

    if (extraction.extracted_titles?.length) {
      sections.push(p('Extracted matter titles:', { bold: true, size: 20, spacing: { after: 60 } }));
      for (const title of extraction.extracted_titles) {
        sections.push(p(`  • ${title}`, { size: 18, spacing: { after: 30 } }));
      }
    }

    if (ragFiles.length) {
      sections.push(p('RAG Knowledge Files Loaded:', { bold: true, size: 20, spacing: { after: 60 } }));
      for (const fn of ragFiles) {
        sections.push(p(`  • ${fn}`, { size: 18, spacing: { after: 30 } }));
      }
    }

    if (Object.keys(modelProfiles).length > 0) {
      sections.push(p('AI Model Execution Profiles:', { bold: true, size: 20, spacing: { before: 100, after: 60 } }));
      const modelRows = Object.entries(modelProfiles as Record<string, Record<string, unknown>>).map(([stage, rawProfile]) => {
        const profile = rawProfile || {};
        return [stage, String(profile.model || 'N/A'), String(profile.reasoning_effort || 'N/A'), String(profile.api_mode || 'N/A')];
      });
      sections.push(makeTable(['Stage', 'Model', 'Reasoning', 'API'], modelRows));
      sections.push(emptyRow());
    }

    if (ragChunks.length > 0) {
      sections.push(p('RAG Chunks Used (methodology only):', { bold: true, size: 20, spacing: { before: 100, after: 60 } }));
      const ragRows = ragChunks.map((chunk: Record<string, unknown>) => [
        String(chunk.chunk_id || ''),
        String(chunk.source || ''),
        String(chunk.tier || ''),
        String(chunk.score ?? ''),
      ]);
      sections.push(makeTable(['Chunk ID', 'Source', 'Tier', 'Score'], ragRows));
      sections.push(emptyRow());
    }

    if (Object.keys(evidenceReconciliation).length > 0) {
      const reconciliationPassed = evidenceReconciliation.passed === true;
      sections.push(p(
        `Canonical evidence reconciliation: ${reconciliationPassed ? 'PASSED' : 'FAILED'} | Matters: ${evidenceReconciliation.matter_count ?? 'N/A'} | Source spans: ${evidenceReconciliation.source_span_count ?? 'N/A'}`,
        { bold: true, color: reconciliationPassed ? '16A34A' : 'DC2626', spacing: { before: 100, after: 80 } }
      ));
      if (Array.isArray(evidenceReconciliation.errors)) {
        for (const error of evidenceReconciliation.errors) {
          sections.push(p(`• ${String(error)}`, { color: 'DC2626', size: 18, spacing: { after: 30 } }));
        }
      }
    }

    sections.push(
      p(`Timestamp: ${pipelineManifest.timestamp || 'N/A'}`, { italics: true, color: GRAY, size: 18, spacing: { after: 200 } }),
      p('━'.repeat(60), { color: 'F59E0B', size: 16, spacing: { after: 300 } })
    );
  }

  // ═══ NEW §1: Evaluation Context Banner ═══
  const ctxLine = [
    `Directory: ${submission.targetDirectory || 'N/A'}`,
    `Practice: ${submission.practiceArea || 'N/A'}`,
    `Jurisdiction: ${(submission.chambersData as any)?.detectedJurisdiction || submission.guideRegion || 'N/A'}`,
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

  // v17.1: Insufficient Evidence Warning (owner praised this in v15)
  const evidenceScore = editorialConfidence.evidence_completeness_score || 0;
  const overallConf = String(editorialConfidence.overall_confidence || '').toLowerCase();
  const evidenceThresholdMet = editorialConfidence.evidence_threshold_met !== false;
  const matterRegisterReconciled = pipelineManifest?.extraction?.match === true;
  if (!matterRegisterReconciled || !evidenceThresholdMet) {
    sections.push(
      sectionTitle('⚠️ Insufficient Evidence for Full Analysis'),
      p(matterRegisterReconciled
        ? 'The numbered matter register is complete, but one or more material conclusions require additional support. The targeted questions later in this Audit identify exactly what should be confirmed.'
        : 'The source and extracted matter registers did not reconcile exactly. Strategic conclusions must remain provisional until the register is corrected.', { spacing: { after: 100 } }),
      p(`Evidence Completeness: ${evidenceScore}% | Overall Confidence: ${overallConf || 'pending'} | Recommendation: ${editorialConfidence.recommendation || 'proceed_with_caveats'}`, { bold: true, color: 'DC2626', spacing: { after: 100 } }),
      p('This assessment is based on the evidence provided. Stronger evidence (specific transaction details, client names, deal values, regulatory outcomes) would significantly improve the ranking case.', { italics: true, color: GRAY, spacing: { after: 300 } })
    );
  }

  // ═══ NEW §2: Practice Positioning Statement ═══
  const identityStatement = competitiveIdentity.identity_statement || '';
  const identityCoherence = competitiveIdentity.identity_coherence || '';
  if (identityStatement) {
    sections.push(
      sectionTitle('Practice Positioning'),
      p(`Coherence: ${identityCoherence ? identityCoherence.charAt(0).toUpperCase() + identityCoherence.slice(1) : 'Pending'}`, { bold: true, color: '6366F1', spacing: { after: 80 } }),
      p(String(identityStatement), { size: 24, spacing: { after: 100 } })
    );
    if (competitiveIdentity.sub_specialization) {
      sections.push(p(`Sub-specialization: ${competitiveIdentity.sub_specialization}`, { italics: true, color: GRAY, spacing: { after: 200 } }));
    }
  }

  // ═══ NEW §3: Editorial Thesis + Lead Matter ═══
  const thesis = narrativeArch.thesis_statement || '';
  const heroMatter = narrativeArch.hero_matter || '';
  if (thesis || heroMatter) {
    sections.push(sectionTitle('Editorial Thesis & Lead Engagement'));
    if (thesis) {
      sections.push(
        subTitle('Editorial Thesis'),
        p(String(thesis), { spacing: { after: 200 } })
      );
    }
    if (heroMatter) {
      sections.push(
        subTitle('Lead Engagement'),
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
    const evalRows = matterEvals.map((ev: Record<string, unknown>) => [
      ev.matter_name || 'Unknown',
      ev.type || 'publishable',
      ev.quality_label || 'Pending',
      `${typeof ev.score === 'number' ? ev.score : 0}/100`,
      ev.improvement_note || ''
    ]);
    sections.push(makeTable(['Matter', 'Type', 'Quality Label', 'Score', 'Improvement Note'], evalRows));
    sections.push(emptyRow());

  }

  // Evidence gaps are questions, never invented rewrites.
  const evidenceGaps = Array.isArray(gapAnalysis.gaps) ? gapAnalysis.gaps : [];
  if (evidenceGaps.length > 0 || gapAnalysis.c2_question) {
    sections.push(sectionTitle('Evidence Development — Ask, Don’t Invent'));
    sections.push(p('Each item separates the current evidentiary record from information that should be confirmed before any further rewrite.', { italics: true, color: GRAY, spacing: { after: 200 } }));
    for (const gap of evidenceGaps) {
      sections.push(
        p(String(gap.matter_name || gap.matter_id || 'Matter'), { bold: true, size: 24, color: NAVY, spacing: { before: 220, after: 70 } }),
        p(`Known facts: ${(Array.isArray(gap.known_facts) ? gap.known_facts : []).join('; ')}`, { spacing: { after: 60 } }),
        p(`Evidentiary value: ${String(gap.evidentiary_value || '')}`, { spacing: { after: 60 } }),
        p(`Missing fact: ${String(gap.missing_fact || '')}`, { color: GRAY, spacing: { after: 60 } }),
        p(`Question for the firm: ${String(gap.targeted_question || '')}`, { bold: true, color: 'D97706', spacing: { after: 60 } }),
        p(`Positioning supportable now: ${String(gap.proposed_positioning || '')}`, { color: '15803D', spacing: { after: 120 } })
      );
    }
    if (gapAnalysis.c2_question) {
      sections.push(
        p('C2 — Competitive Feedback', { bold: true, size: 24, color: NAVY, spacing: { before: 220, after: 70 } }),
        p(`Question for the firm: ${String(gapAnalysis.c2_question)}`, { bold: true, color: 'D97706', spacing: { after: 180 } })
      );
    }
  }

  if (artifactValidation.matter_rollbacks?.length) {
    sections.push(sectionTitle('Evidence Integrity Controls Applied'));
    sections.push(p(`${artifactValidation.matter_rollbacks.length} matter rewrite(s) were reverted to source-backed text because the generated candidate introduced or omitted a protected fact.`, { color: 'B45309', spacing: { after: 200 } }));
  }

  if (lawyerAccountability.length > 0) {
    sections.push(sectionTitle('Lawyer Ranking Accountability'));
    sections.push(p('Each submitted lawyer is tied to the matters that support a personal ranking case. A question is shown where the source does not yet identify that lawyer’s role.', { italics: true, color: GRAY, spacing: { after: 200 } }));
    const lawyerRows = lawyerAccountability.map((lawyer: Record<string, unknown>) => [
      String(lawyer.name || 'Unknown'),
      String(lawyer.current_ranking || (lawyer.is_ranked ? 'Ranked — band not stated' : 'No ranking stated')),
      Array.isArray(lawyer.supporting_matter_ids) && lawyer.supporting_matter_ids.length > 0
        ? lawyer.supporting_matter_ids.join(', ')
        : 'No submitted matter linked',
      lawyer.defensible_on_submitted_evidence ? 'Supported' : 'Evidence gap',
    ]);
    sections.push(makeTable(['Lawyer', 'Current ranking', 'Supporting matters', 'Status'], lawyerRows));
    for (const lawyer of lawyerAccountability) {
      if (lawyer.follow_up_question) {
        sections.push(p(`${lawyer.name}: ${lawyer.follow_up_question}`, { bold: true, color: 'D97706', spacing: { before: 100, after: 80 } }));
      }
    }
    sections.push(emptyRow());
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
    sections.push(p(`${submission.matters?.length || allDispositions.length} matters tracked — ${matterRegisterReconciled ? 'count reconciled to source' : 'reconciliation pending'}`, { bold: true, color: matterRegisterReconciled ? '065F46' : 'B45309', spacing: { after: 100 } }));
    
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
