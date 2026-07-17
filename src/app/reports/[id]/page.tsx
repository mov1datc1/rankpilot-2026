import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { ChevronLeft, Download, Zap, RefreshCw, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import PrintButton from "@/components/PrintButton";
import StatusActionButtons from "./StatusActionButtons";
import SupplementalUpload from "./SupplementalUpload";


export default async function ReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let resolvedUserId = user.id;
  if (user.email) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });
    if (existingByEmail) {
      resolvedUserId = existingByEmail.id;
    }
  }

  const submission = await prisma.submission.findUnique({
    where: { id: id },
    include: { matters: true }
  });

  if (!submission || (submission.userId !== user.id && submission.userId !== resolvedUserId)) {
    redirect('/reports');
  }

  const chambersData = submission.chambersData as any || {};
  const analysis = chambersData.analysis || {};
  const context = chambersData.strategicContext || {};
  const letter = analysis.audit_letter || {};
  const firmName = chambersData.firm_name || chambersData.firmName || context.firm_name || submission.practiceArea || 'The Firm';

  // Editorial Reasoning Engine data
  const competitiveIdentity = chambersData.competitive_identity || {};
  const editorialConfidence = chambersData.editorial_confidence || {};
  const narrativeArch = chambersData.narrative_architecture || {};
  const comparativeAnalysis = chambersData.comparative_analysis || {};
  const reasoningTrace = chambersData.reasoning_trace || [];
  const comprehension = chambersData.comprehension || {};
  const pipelineError = chambersData._pipeline_error || null;
  const isEmptyAnalysis = !analysis.score && !analysis.summary && !letter.the_state_of_play;

  const score = analysis.score || 0;
  const riskLevel = analysis.risk_level ? String(analysis.risk_level) : "Pending";
  const archetype = context.archetype ? String(context.archetype) : "Strategic model pending";
  const detectedTier = context.starting_position ? String(context.starting_position) : "Not classified";
  const target = context.target_realistic ? String(context.target_realistic) : "Target pending";

  // Editorial Intelligence metrics
  const identityStatement = competitiveIdentity.identity_statement || '';
  const identityCoherence = competitiveIdentity.identity_coherence || '';
  const confidence = editorialConfidence.overall_confidence || '';
  const passesDefensibility = editorialConfidence.passes_defensibility_test || false;
  const thesis = narrativeArch.thesis_statement || '';
  const heroMatter = narrativeArch.hero_matter || '';
  const bandAlignment = comparativeAnalysis.band_alignment || '';

  // Safely parse arrays that AI might hallucinate as strings
  const realityCheck = Array.isArray(letter.the_reality_check) 
    ? letter.the_reality_check 
    : (typeof letter.the_reality_check === 'string' ? [letter.the_reality_check] : []);
    
  const pathToDominance = Array.isArray(letter.the_path_to_dominance)
    ? letter.the_path_to_dominance
    : [];

  const recommendedRewrites = Array.isArray(letter.recommended_rewrites)
    ? letter.recommended_rewrites
    : [];

  const competitiveContext = letter.competitive_context ? String(letter.competitive_context) : '';
  const positioningText = letter.competitive_positioning_text ? String(letter.competitive_positioning_text) : '';
  
  // Format Date
  const dateStr = submission.createdAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc', paddingBottom: '5rem' }}>
      {/* Top Navigation */}
      <div className="print-hidden" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link 
            href="/reports"
            style={{ color: '#64748b', textDecoration: 'none', padding: '0.375rem 0.75rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}
          >
            <ChevronLeft style={{ width: '16px', height: '16px', marginRight: '0.25rem' }} />
            Back to Reports
          </Link>
          <div style={{ height: '24px', width: '1px', background: '#e2e8f0' }}></div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>RankPilot: Strategic Audit</h1>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>{submission.targetDirectory} | {submission.practiceArea}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <StatusActionButtons submissionId={submission.id} currentStatus={submission.status} />
          
          <div style={{ height: '24px', width: '1px', background: '#e2e8f0', margin: '0 0.375rem' }}></div>
          
          <PrintButton />
          
          <div style={{ height: '24px', width: '1px', background: '#e2e8f0', margin: '0 0.375rem' }}></div>
          
          <a 
            href={`/api/generate-docx?id=${submission.id}&type=audit`} 
            style={{ background: '#f1f5f9', color: '#0f172a', textDecoration: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}
          >
            <Download style={{ width: '14px', height: '14px', marginRight: '0.375rem' }} />
            Audit DOCX
          </a>

          <a 
            href={`/api/generate-docx?id=${submission.id}&type=submission`} 
            style={{ background: '#1A237E', color: '#ffffff', textDecoration: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}
          >
            <Download style={{ width: '14px', height: '14px', marginRight: '0.375rem' }} />
            Chambers DOCX
          </a>
        </div>
      </div>

      <div className="print-area" style={{ maxWidth: '64rem', margin: '2rem auto 0', width: '100%', padding: '0 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Evaluation Context Banner */}
        <div style={{ background: '#f0f4ff', borderRadius: '12px', border: '1px solid #c7d2fe', padding: '1rem 1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Directory</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e1b4b' }}>{submission.targetDirectory || 'N/A'}</span>
          </div>
          <div style={{ width: '1px', height: '20px', background: '#c7d2fe' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Practice</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e1b4b' }}>{submission.practiceArea || 'N/A'}</span>
          </div>
          <div style={{ width: '1px', height: '20px', background: '#c7d2fe' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jurisdiction</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e1b4b' }}>{submission.guideRegion || 'N/A'}</span>
          </div>
          <div style={{ width: '1px', height: '20px', background: '#c7d2fe' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Band</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e1b4b' }}>{submission.currentBand || 'Unranked'}</span>
          </div>
        </div>

        {/* Pipeline Error / Empty Analysis Banner */}
        {(pipelineError || (isEmptyAnalysis && submission.status !== 'Submitted')) && (
          <div style={{ background: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca', padding: '1.5rem 2rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem' }}>⚠️</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#991b1b', margin: 0 }}>
                  {pipelineError ? 'El procesamiento de IA encontró un error' : 'Análisis pendiente de generación'}
                </h3>
                {pipelineError?.code && (
                  <span style={{ padding: '0.2rem 0.6rem', background: '#fee2e2', color: '#dc2626', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 600 }}>
                    {pipelineError.code}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.9rem', color: '#b91c1c', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                {pipelineError?.message || 'El motor de IA no pudo completar el análisis de este documento. Los datos que se lograron extraer se muestran abajo como vista parcial.'}
              </p>
              {pipelineError?.details && (
                <p style={{ fontSize: '0.8rem', color: '#92400e', margin: '0 0 1rem', padding: '0.5rem 0.75rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  💡 Detalle técnico: {pipelineError.details}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a
                  href={`/submissions/processing?submissionId=${submission.id}`}
                  style={{ padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
                >
                  🔄 Reprocesar documento
                </a>
                <a
                  href="/submissions"
                  style={{ padding: '0.5rem 1.25rem', background: '#f1f5f9', color: '#475569', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}
                >
                  ← Volver a Submissions
                </a>
              </div>
              {pipelineError?.timestamp && (
                <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0.75rem 0 0' }}>Error registrado: {new Date(pipelineError.timestamp).toLocaleString()}</p>
              )}
            </div>
          </div>
        )}

        {/* Competitive Identity Banner */}
        {identityStatement && (
          <div style={{ background: 'linear-gradient(135deg, #1A237E 0%, #283593 50%, #3949AB 100%)', borderRadius: '12px', padding: '1.5rem 2rem', color: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: identityCoherence === 'coherent' ? '#4ade80' : identityCoherence === 'emerging' ? '#fbbf24' : '#f87171' }}></div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)' }}>Competitive Identity · {identityCoherence || 'Pending'}</span>
            </div>
            <p style={{ fontSize: '1.15rem', fontWeight: 600, lineHeight: 1.5, margin: 0 }}>{identityStatement}</p>
            {competitiveIdentity.sub_specialization && (
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', margin: '0.75rem 0 0', fontStyle: 'italic' }}>Sub-specialization: {competitiveIdentity.sub_specialization}</p>
            )}
          </div>
        )}

        {/* Editorial Intelligence Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.75rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Editorial Confidence</h3>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: confidence === 'high' ? '#16a34a' : confidence === 'moderate' ? '#d97706' : confidence === 'low' ? '#dc2626' : '#94a3b8' }}>
              {confidence ? confidence.charAt(0).toUpperCase() + confidence.slice(1) : 'Pending'}
            </p>
            {passesDefensibility && <p style={{ fontSize: '0.65rem', color: '#16a34a', margin: '0.25rem 0 0', fontWeight: 600 }}>✓ Defensible</p>}
          </div>
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Band Alignment</h3>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: bandAlignment ? '#0f172a' : '#94a3b8', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{bandAlignment || detectedTier}</p>
          </div>
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Risk Level</h3>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: riskLevel === 'Low' ? '#16a34a' : riskLevel === 'High' ? '#dc2626' : riskLevel === 'Pending' ? '#94a3b8' : '#d97706' }}>{riskLevel}</p>
          </div>
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Archetype</h3>
            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{archetype}</p>
          </div>
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Target</h3>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: target === 'Pending' ? '#94a3b8' : '#1A237E', margin: 0 }}>{target}</p>
          </div>
        </div>

        {/* Thesis & Hero Matter */}
        {(thesis || heroMatter) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {thesis && (
              <div style={{ background: '#fefce8', borderRadius: '12px', border: '1px solid #fef08a', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a16207', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Editorial Thesis</h3>
                <p style={{ fontSize: '0.95rem', color: '#78350f', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{thesis}</p>
              </div>
            )}
            {heroMatter && (
              <div style={{ background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Hero Matter</h3>
                <p style={{ fontSize: '0.95rem', color: '#1e3a8a', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{heroMatter}</p>
                {narrativeArch.hero_matter_rationale && (
                  <p style={{ fontSize: '0.8rem', color: '#3b82f6', margin: '0.5rem 0 0', fontStyle: 'italic' }}>{narrativeArch.hero_matter_rationale}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Insufficient Evidence Warning Banner */}
        {(confidence === 'insufficient' || confidence === 'low') && (
          <div style={{ background: '#FFF7ED', borderRadius: '12px', border: '1px solid #FED7AA', padding: '1.5rem 2rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#FFEDD5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem' }}>⚠️</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#9A3412', margin: '0 0 0.5rem' }}>
                Insufficient Evidence for Full Analysis
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#C2410C', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
                The Editorial Reasoning Engine determined that the submitted document does not contain enough evidence to produce a fully defensible audit letter. The analysis below is preliminary and should be treated as a draft requiring supplemental information.
              </p>
              {editorialConfidence.defensibility_summary && (
                <p style={{ fontSize: '0.85rem', color: '#7C2D12', margin: '0 0 0.75rem', fontStyle: 'italic' }}>
                  &quot;{editorialConfidence.defensibility_summary}&quot;
                </p>
              )}
              {comprehension.missing_information && Array.isArray(comprehension.missing_information) && comprehension.missing_information.length > 0 && (
                <div style={{ background: '#FFFFFF', borderRadius: '8px', border: '1px solid #FED7AA', padding: '1rem', marginTop: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9A3412', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>What&apos;s needed to complete the analysis:</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#7C2D12', lineHeight: 1.8 }}>
                    {comprehension.missing_information.map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CTA Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <SupplementalUpload submissionId={id} />
                <a
                  href="/submissions"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.25rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600,
                    background: '#FFFFFF', color: '#9A3412',
                    textDecoration: 'none', cursor: 'pointer',
                    border: '1.5px solid #FED7AA',
                  }}
                >
                  🔄 Start New Submission
                </a>
              </div>
            </div>
          </div>
        )}

        {/* The Audit Letter Paper */}
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
          {/* Header Line */}
          <div style={{ height: '4px', width: '100%', background: 'linear-gradient(to right, #fbbf24, #f59e0b)' }}></div>
          
          <div style={{ padding: '3rem' }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1A237E', marginBottom: '1.5rem' }}>Strategic Audit Letter</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', color: '#475569' }}>
                <p style={{ margin: 0 }}><strong>To:</strong> The Board of Directors — {firmName}</p>
                <p style={{ margin: 0 }}><strong>From:</strong> RankPilot Consulting</p>
                <p style={{ margin: 0 }}><strong>Re:</strong> {submission.targetDirectory} · {submission.practiceArea} · {submission.guideRegion}</p>
                <p style={{ margin: 0 }}><strong>Date:</strong> {dateStr}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', color: '#1e293b', lineHeight: 1.6 }}>
              
              {/* Score Circle + Executive Summary */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem' }}>
                <div style={{ flexShrink: 0, width: '80px', height: '80px', borderRadius: '50%', background: `conic-gradient(${score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626'} ${score * 3.6}deg, #f1f5f9 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.25rem', color: '#0f172a' }}>
                    {score}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '1.125rem', color: '#475569', fontStyle: 'italic', margin: 0 }}>
                    {analysis.summary ? String(analysis.summary) : "Pending analysis generation."}
                  </p>
                </div>
              </div>

              {/* Narrative Strategy */}
              {letter.narrative_strategy && Array.isArray(letter.narrative_strategy) && letter.narrative_strategy.length > 0 && (
                <div style={{ background: '#fefce8', borderRadius: '8px', padding: '1.5rem', border: '1px solid #fef08a' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#854d0e', marginBottom: '1rem' }}>Narrative Strategy</h3>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: 0, margin: 0, listStyleType: 'none' }}>
                    {letter.narrative_strategy.map((bullet: any, i: number) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <span style={{ color: '#d97706', marginRight: '0.75rem', marginTop: '0.1rem', fontWeight: 700 }}>→</span>
                        <span style={{ color: '#78350f' }}>{typeof bullet === 'string' ? bullet : JSON.stringify(bullet)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* State of Play */}
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>THE STATE OF PLAY</h3>
                <div style={{ whiteSpace: 'pre-line' }}>
                  <p style={{ margin: 0 }}>{letter.the_state_of_play ? String(letter.the_state_of_play) : "Pending."}</p>
                </div>
              </div>

              {/* Unfair Advantage — THE WEAPON */}
              <div style={{ background: '#eef2ff', borderRadius: '8px', padding: '1.5rem', border: '1px solid #c7d2fe' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1A237E', marginBottom: '1rem' }}>THE UNFAIR ADVANTAGE <span style={{ fontWeight: 400, color: '#6366f1' }}>(THE WEAPON)</span></h3>
                <div style={{ whiteSpace: 'pre-line' }}>
                  <p style={{ margin: 0 }}>{letter.the_unfair_advantage ? String(letter.the_unfair_advantage) : "Pending."}</p>
                </div>
              </div>

              {/* Reality Check — VOICE OF TRUTH */}
              <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '1.5rem', border: '1px solid #fecaca' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#991b1b', marginBottom: '0.5rem' }}>THE REALITY CHECK <span style={{ fontWeight: 400, color: '#dc2626' }}>(VOICE OF TRUTH)</span></h3>
                <p style={{ marginBottom: '1rem', color: '#7f1d1d', fontSize: '0.9rem' }}>The Board must accept the hard truth: rank movement requires the following to be addressed.</p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: 0, margin: 0, listStyleType: 'none' }}>
                  {realityCheck.length > 0 ? realityCheck.map((point: any, i: number) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <span style={{ color: '#dc2626', marginRight: '0.75rem', marginTop: '0.1rem', fontWeight: 700 }}>⚠</span>
                      <span>{typeof point === 'object' ? JSON.stringify(point) : String(point)}</span>
                    </li>
                  )) : (
                    <li style={{ color: '#64748b', fontStyle: 'italic' }}>No defects identified.</li>
                  )}
                </ul>
              </div>

              {/* Path to Dominance — Milestones */}
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1A237E', marginBottom: '1.5rem' }}>THE PATH TO DOMINANCE</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {pathToDominance.length > 0 ? pathToDominance.map((step: any, i: number) => (
                    <div key={i} style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <span style={{ background: '#1A237E', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <h4 style={{ fontWeight: 700, color: '#0f172a', margin: 0, fontSize: '1rem' }}>
                          STEP {i + 1}: {typeof step === 'object' ? (step?.title ? String(step.title) : "Strategic Step") : "Strategic Step"}
                        </h4>
                        {typeof step === 'object' && step?.deadline && (
                          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600, color: '#d97706', background: '#fef3c7', padding: '0.25rem 0.75rem', borderRadius: '999px' }}>
                            {step.deadline}
                          </span>
                        )}
                      </div>
                      {typeof step === 'object' && step?.why && (
                        <p style={{ color: '#6366f1', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 0.5rem' }}>Why: <span style={{ fontWeight: 400, color: '#475569' }}>{step.why}</span></p>
                      )}
                      {typeof step === 'object' && step?.what_must_be_delivered && (
                        <p style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 0.5rem' }}>What must be delivered: <span style={{ fontWeight: 400, color: '#475569' }}>{step.what_must_be_delivered}</span></p>
                      )}
                      <p style={{ color: '#475569', margin: 0, lineHeight: 1.6 }}>{typeof step === 'object' ? (step?.description ? String(step.description) : JSON.stringify(step)) : String(step)}</p>
                    </div>
                  )) : (
                    <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>Strategic path is being formulated.</p>
                  )}
                </div>
              </div>

              {/* Matter Evaluations / Case Evaluation */}
              {letter.matter_evaluations && Array.isArray(letter.matter_evaluations) && letter.matter_evaluations.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Case Evaluation / Matters</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {letter.matter_evaluations.map((ev: any, i: number) => {
                      const mScore = typeof ev.score === 'number' ? ev.score : 0;
                      const labelColor = ev.quality_label?.includes('Strong') || ev.quality_label?.includes('Flagship') ? '#16a34a'
                        : ev.quality_label?.includes('Good') ? '#d97706'
                        : '#dc2626';
                      return (
                        <div key={i} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
                          <h4 style={{ fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem', fontSize: '0.95rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{ev.matter_name || `Matter ${i + 1}`}</h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: ev.type === 'confidential' ? '#dc2626' : '#2563eb', textTransform: 'uppercase' as const }}>Type: {ev.type || 'publishable'}</span>
                          </div>
                          <p style={{ color: labelColor, fontWeight: 600, fontSize: '0.85rem', margin: '0 0 0.5rem' }}>{ev.quality_label || 'Pending evaluation'}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '1.25rem', color: mScore >= 70 ? '#16a34a' : mScore >= 40 ? '#d97706' : '#dc2626' }}>{mScore}</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>/100</span>
                          </div>
                          {ev.improvement_note && (
                            <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0, fontStyle: 'italic' }}>{ev.improvement_note}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Competitive Positioning */}
              {competitiveContext && (
                <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '1.5rem', border: '1px solid #bbf7d0' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#166534', marginBottom: '1rem' }}>Competitive Positioning</h3>
                  <p style={{ color: '#1e293b', lineHeight: 1.7, margin: 0 }}>{competitiveContext}</p>
                </div>
              )}

              {/* AI-Recommended Matter Rewrites */}
              {recommendedRewrites.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1A237E', marginBottom: '0.5rem' }}>AI-Recommended Matter Rewrites</h3>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>The following matters have been identified as strategically weak. Below are AI-generated Chambers-grade improved versions (220-260 words each):</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {recommendedRewrites.map((rw: any, i: number) => (
                      <div key={i} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Original (Weak)</span>
                          <p style={{ color: '#6b7280', margin: '0.5rem 0 0', fontSize: '0.9rem', fontStyle: 'italic' }}>{typeof rw === 'object' ? (rw.original || 'N/A') : String(rw)}</p>
                        </div>
                        <div style={{ padding: '1.25rem', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI-Improved Version</span>
                          <p style={{ color: '#1e293b', margin: '0.5rem 0 0', fontSize: '0.9rem', lineHeight: 1.6 }}>{typeof rw === 'object' ? (rw.improved || 'N/A') : ''}</p>
                        </div>
                        {typeof rw === 'object' && rw.rationale && (
                          <div style={{ padding: '1rem 1.25rem', background: '#fefce8', borderTop: '1px solid #fef08a' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a16207' }}>Rationale: </span>
                            <span style={{ fontSize: '0.85rem', color: '#78716c' }}>{rw.rationale}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ready-to-Use Positioning Text */}
              {positioningText && (
                <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '1.5rem', border: '1px solid #bfdbfe' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e40af', marginBottom: '0.5rem' }}>Ready-to-Use Positioning Text (B7/C2)</h3>
                  <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '1rem' }}>AI-generated paragraph ready to copy-paste into your Chambers submission:</p>
                  <div style={{ background: '#ffffff', border: '1px solid #dbeafe', borderRadius: '8px', padding: '1.25rem' }}>
                    <p style={{ color: '#1e293b', lineHeight: 1.7, margin: 0, fontSize: '0.95rem' }}>{positioningText}</p>
                  </div>
                </div>
              )}

              {/* Closing */}
              {letter.closing && (
                <div style={{ borderTop: '2px solid #1A237E', paddingTop: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1A237E', marginBottom: '1rem' }}>CLOSING</h3>
                  <p style={{ color: '#1e293b', lineHeight: 1.7, margin: '0 0 1rem' }}>{String(letter.closing)}</p>
                  <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>Respectfully,<br />RankPilot Consulting</p>
                </div>
              )}

              {/* Execution Layer Actions */}
              <div className="print-hidden" style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.25rem' }}>Execution Engine</h3>
                    <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Take action: optimize matters or download the improved submission.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Link
                      href="/submissions/matters"
                      style={{ background: '#f1f5f9', color: '#0f172a', textDecoration: 'none', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}
                    >
                      <RefreshCw style={{ width: '16px', height: '16px', marginRight: '0.5rem' }} />
                      Rewrite Matters
                    </Link>
                    <a
                      href={`/api/generate-docx?id=${submission.id}&type=submission`}
                      style={{ background: '#1A237E', color: '#ffffff', textDecoration: 'none', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}
                    >
                      <Zap style={{ width: '16px', height: '16px', marginRight: '0.5rem' }} />
                      Download Submission
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
