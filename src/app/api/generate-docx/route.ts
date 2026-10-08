import { artifactHash, deliveryInputHash } from '@/lib/audit/artifact-binding';
import { getDeliveryState } from '@/lib/audit/delivery-state';
import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, VerticalAlign, TableLayoutType
} from 'docx';
import { buildSubmissionDoc, resolveCountryJurisdiction } from './submission-builder';
import { buildAuditDoc } from './audit-builder';
import { curateMatters } from '@/lib/docx/matter-curator';
import { curateLawyers } from '@/lib/docx/lawyer-curator';
import { buildSafeContentDisposition } from '@/lib/headers';
import { evaluateStrategicSufficiency } from '@/lib/audit/evidence-sufficiency-gate';

// Letter page width (8.5") minus 1" margins on both sides, in twentieths
// of a point. Google Docs requires explicit DXA table/grid/cell widths.
function canonicalizePracticeArea(pa?: string): string {
  if (!pa) return 'General Practice';
  const trimmed = pa.trim();
  if (/^(?:labor|labour)(?:\s*(?:&|and)\s*(?:employment|labor|labour))?$/i.test(trimmed) ||
      /^(?:employment)(?:\s*(?:&|and)\s*(?:labor|labour))$/i.test(trimmed)) {
    return 'Labour & Employment';
  }
  return trimmed;
}

function getPracticeDilutionDescription(practiceArea?: string): string {
  const pa = (practiceArea || '').toLowerCase();
  if (pa.includes('labour') || pa.includes('labor') || pa.includes('employment')) {
    return 'Matters focusing strictly on routine single-employee dismissals, isolated administrative filings, or day-to-day HR advisory without collective bargaining, strike prevention, cross-border workforce integration, or high-stakes USMCA/compliance exposure dilute practice positioning:';
  }
  if (pa.includes('tax') || pa.includes('fiscal')) {
    return 'Routine tax compliance reviews, basic bookkeeping queries, or repetitive administrative filings without high-magnitude fiscal audits, transfer pricing controversies, complex transactional structuring, or constitutional amparo litigation dilute practice positioning:';
  }
  if (pa.includes('real estate') || pa.includes('inmobiliario') || pa.includes('urbanístico')) {
    return 'Matters that do not center on core property development, land-use, zoning, or high-stakes environmental permitting dilute practice positioning:';
  }
  if (pa.includes('dispute') || pa.includes('litigation') || pa.includes('arbitration')) {
    return 'Low-stake collection claims, routine procedural motions, or non-material administrative disputes without strategic jurisprudence impact or multi-million controversy dilute practice positioning:';
  }
  if (pa.includes('corporate') || pa.includes('m&a')) {
    return 'Routine corporate secretarial maintenance, simple entity formation, or commercial contract drafting without substantial transactional deal value or cross-border complexity dilute practice positioning:';
  }
  if (pa.includes('banking') || pa.includes('finance')) {
    return 'Standard bilateral loan renewals or routine retail credit reviews without syndicated facilities, debt restructuring, structured project finance, or regulatory capital complexity dilute practice positioning:';
  }
  return 'Matters outside the core substantive focus of the practice area dilute directory ranking competitiveness:';
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }

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
    if(exportMode==='previous') {
      const prior=chambersData.previous_approved_artifact;
      const encoded=docType==='submission'?prior?.base64:docType==='audit'?prior?.audit_base64:null;
      const expected=docType==='submission'?prior?.sha256:prior?.audit_sha256;
      if(!encoded || !prior?.input_hash || !prior?.archived_at) return NextResponse.json({error:'No hay una versión anterior revisada disponible.'},{status:404});
      const bytes=Buffer.from(encoded,'base64');
      if(artifactHash(bytes)!==expected)return NextResponse.json({error:'No se pudo comprobar la versión anterior.'},{status:409});
      return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Cache-Control':'private, no-store','Content-Disposition':`attachment; filename="${docType==='submission'?'Submission':'Audit'}_version_anterior.docx"`}});
    }
    const pair=chambersData.approved_artifact;
    if(docType==='audit' && chambersData.release_verdict?.passed && pair?.audit_base64 && pair?.input_hash===deliveryInputHash(submission,chambersData)) {
      const bytes=Buffer.from(pair.audit_base64,'base64');
      if(artifactHash(bytes)!==pair.audit_sha256) return NextResponse.json({error:'El Audit guardado no coincide con la revisión aprobada.'},{status:409});
      return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':'attachment; filename="Strategic_Audit.docx"'}});
    }
    const releaseVerdict = chambersData.release_verdict || {};
    const isSubmission = docType === 'submission';
    const isOriginalSubmissionExport = isSubmission && exportMode === 'original';
    if (isSubmission && !isOriginalSubmissionExport) {
      const isApproved = getDeliveryState(chambersData, chambersData.matters || submission.matters, true).approved;
      if (!isApproved) {
        const blockingIssues = getDeliveryState(chambersData, chambersData.matters || submission.matters, true).errors;
        const requiredAction = 'Please review the Strategic Audit findings and verify source matter headings, or re-run optimization once matters are confirmed.';
        
        const acceptsHtml = request.headers.get('accept')?.includes('text/html');
        if (acceptsHtml) {
          const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Submission Not Approved for Delivery - RankPilot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; padding: 2rem; display: flex; justify-content: center; align-items: center; min-height: 80vh; margin: 0; }
    .card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); max-width: 600px; width: 100%; padding: 2.5rem; box-sizing: border-box; }
    .badge { display: inline-flex; align-items: center; gap: 0.5rem; background: #fee2e2; color: #b91c1c; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.35rem 0.75rem; border-radius: 9999px; margin-bottom: 1.25rem; }
    h1 { font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0 0 1rem; }
    p { font-size: 0.95rem; color: #475569; line-height: 1.6; margin: 0 0 1.25rem; }
    .issues { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; }
    .issues h4 { margin: 0 0 0.5rem; font-size: 0.85rem; color: #9f1239; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .issues ul { margin: 0; padding-left: 1.25rem; color: #be123c; font-size: 0.9rem; }
    .action { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.75rem; }
    .action h4 { margin: 0 0 0.25rem; font-size: 0.85rem; color: #166534; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .action p { margin: 0; color: #15803d; font-size: 0.9rem; }
    .btn { display: inline-block; background: #2563eb; color: white; text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 0.75rem 1.5rem; border-radius: 8px; transition: background 0.2s; }
    .btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🛡️ Quality Delivery Gate</div>
    <h1>Submission Not Approved for Delivery</h1>
    <p>RankPilot's Editorial Quality Verification engine prevented the automatic release of this submission draft because one or more integrity gates require attention:</p>
    <div class="issues">
      <h4>Blocking Issues Detected</h4>
      <ul>
        ${blockingIssues.map((issue: string) => `<li>${escapeHtml(issue)}</li>`).join('')}
      </ul>
    </div>
    <div class="action">
      <h4>Required Action</h4>
      <p>${requiredAction}</p>
    </div>
    <a href="javascript:window.history.back()" class="btn">← Return to Studio</a>
  </div>
</body>
</html>`;
          return new NextResponse(html, {
            status: 409,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }

        return NextResponse.json(
          {
            error: 'Submission not approved for delivery',
            blocking_issues: blockingIssues,
            required_action: requiredAction
          },
          { status: 409 }
        );
      }
    }
    if (isSubmission && !isOriginalSubmissionExport) {
      const artifact = chambersData.approved_artifact;
      if (!artifact || artifact.input_hash !== deliveryInputHash(submission, chambersData)) {
        return NextResponse.json({error: 'El expediente cambió después de la revisión. Revisa la versión actual antes de descargar.'}, {status: 409});
      }
      const requestedFormat = searchParams.get('template') || searchParams.get('format') || '';
      const wantsLegal500 = /legal.?500/.test(requestedFormat);
      if (requestedFormat && wantsLegal500 !== /legal.?500/i.test(submission.targetDirectory || '')) {
        return NextResponse.json({error: 'El formato solicitado no corresponde al archivo revisado.'}, {status: 409});
      }
      const bytes = Buffer.from(artifact.base64, 'base64');
      if (artifactHash(bytes) !== artifact.sha256) return NextResponse.json({error:'La integridad del archivo no pudo verificarse.'}, {status:409});
      return new NextResponse(new Uint8Array(bytes), {headers:{
        'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition':buildSafeContentDisposition('Submission_Form', submission.practiceArea, 'docx'),
        'X-Artifact-SHA256':artifact.sha256, 'Cache-Control':'private, no-store'
      }});
    }
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
        matter_evaluations: letter.matter_evaluations || analysis.matter_evaluations || [],
        competitive_positioning_text: letter.competitive_positioning_text || '',
        portfolio_curation: letter.portfolio_curation || analysis.portfolio_curation || null,
        score_rationale: letter.score_rationale || analysis.score_rationale || '',
      };
    }
    if (!letter.portfolio_curation && analysis.portfolio_curation) {
      letter.portfolio_curation = analysis.portfolio_curation;
    }
    if (!letter.score_rationale && analysis.score_rationale) {
      letter.score_rationale = analysis.score_rationale;
    }
    
    // v17.1: Derive score from editorial_confidence if missing
    if (!analysis.score && analysis.editorial_confidence) {
      const confMap: Record<string, number> = { 'very high': 90, 'high': 80, 'moderate': 65, 'low': 45, 'limited': 30, 'insufficient': 35 };
      const overall = String(analysis.editorial_confidence.overall_confidence || '').toLowerCase();
      if (confMap[overall]) {
        analysis.score = confMap[overall];
      }
    }
    
    let firmName = chambersData.firm_name || chambersData.firmName || chambersData.metadata?.firm_name || chambersData.firm || context.firm_name || analysis.firm_name || (submission as any).firmName || (submission as any).firm_name;
    if (!firmName || firmName === submission.practiceArea) {
      const subTitle = (submission as any).title || '';
      const titleParts = subTitle.split(/\s+[-–—]\s+/);
      if (titleParts.length > 1 && titleParts[0].trim()) {
        firmName = titleParts[0].trim();
      } else {
        firmName = subTitle || 'The Firm';
      }
    }
    const rawPracticeArea = submission.practiceArea || chambersData.practice_area || chambersData.metadata?.practice_area || 'General Practice';
    let safePracticeArea = rawPracticeArea;
    if (safePracticeArea.length > 80 || safePracticeArea.includes('\n') || safePracticeArea.includes('?') || safePracticeArea.includes('SOURCE DOCUMENT') || safePracticeArea.startsWith('===')) {
      safePracticeArea = chambersData?.metadata?.calibrated_practice_area
        || chambersData?.strategicContext?.practice_area
        || 'Energy & Natural Resources';
    }
    const practiceArea = canonicalizePracticeArea(safePracticeArea);

    // v26.36: Deterministic country jurisdiction resolution (e.g., Mexico instead of generic Latin America)
    const detectedJurisdiction = resolveCountryJurisdiction(firmName, practiceArea, chambersData, submission);
    console.log(`[DOCX JURISDICTION] detectedJurisdiction='${detectedJurisdiction}' | analysis.location='${analysis.location}' | guideRegion='${submission.guideRegion}'`);
    // Always inject
    if (detectedJurisdiction) {
      chambersData.detectedJurisdiction = detectedJurisdiction;
    }

    const requestedTemplate = searchParams.get('template') || searchParams.get('format');
    const forceMaster = requestedTemplate === 'master_chambers'
      || requestedTemplate === 'master_legal500'
      || requestedTemplate === 'chambers'
      || requestedTemplate === 'legal500'
      || requestedTemplate === 'canonical'
      || searchParams.get('engine') === 'master';

    // Route target directory if explicit template passed
    if (requestedTemplate === 'master_legal500' || requestedTemplate === 'legal500') {
      submission.targetDirectory = 'Legal 500';
    } else if (requestedTemplate === 'master_chambers' || requestedTemplate === 'chambers') {
      submission.targetDirectory = 'Chambers';
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
        'Content-Disposition': buildSafeContentDisposition(prefix, practiceArea, 'docx'),
        'X-Artifact-SHA256': createHash('sha256').update(buffer).digest('hex'),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: any) {
    console.error('DOCX generation error:', error);
    const acceptHeader = request.headers.get('accept') || '';
    const isHtmlRequest = acceptHeader.includes('text/html') || !acceptHeader.includes('application/json');

    if (isHtmlRequest) {
      const errMsg = error.message || 'Generation failed';
      const submissionIdParam = request.nextUrl.searchParams.get('id') || 'default';
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RankPilot — Quality Gate Active</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0B0F19; color: #F8FAFC; margin: 0; padding: 40px 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; box-sizing: border-box; }
    .card { background: #111827; border: 1px solid #1F2937; border-radius: 16px; max-width: 640px; width: 100%; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); margin-bottom: 20px; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px 0; color: #FFFFFF; }
    p.subtitle { font-size: 14px; color: #94A3B8; margin: 0 0 24px 0; line-height: 1.5; }
    .box { background: #1E293B; border-left: 4px solid #EF4444; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
    .box-title { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #94A3B8; margin-bottom: 6px; }
    .box-msg { font-size: 14px; color: #F1F5F9; line-height: 1.5; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; transition: all 0.15s ease; }
    .btn-primary { background: #3B82F6; color: #FFFFFF; border: none; }
    .btn-primary:hover { background: #2563EB; }
    .btn-secondary { background: #1F2937; color: #CBD5E1; border: 1px solid #374151; }
    .btn-secondary:hover { background: #374151; color: #FFFFFF; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🛡️ Quality Gate Fail-Closed Guardrail</div>
    <h1>Deliverable Blocked — Artifact Integrity Check</h1>
    <p class="subtitle">RankPilot strictly prevents downstream delivery of documents containing unverified ranking drift or confidential information leaks.</p>
    <div class="box">
      <div class="box-title">Validation Diagnosis</div>
      <div class="box-msg">${escapeHtml(errMsg)}</div>
    </div>
    <div class="actions">
      <a href="javascript:history.back()" class="btn btn-primary">Return to Submission Studio</a>
      <a href="/api/generate-docx?id=${submissionIdParam}&type=audit" class="btn btn-secondary">Download Strategic Audit</a>
    </div>
  </div>
</body>
</html>`;
      return new NextResponse(html, {
        status: 422,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}
