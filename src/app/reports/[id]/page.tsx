import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { ChevronLeft, Download, Zap, RefreshCw, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import PrintButton from "@/components/PrintButton";
import StatusActionButtons from "./StatusActionButtons";


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

  const score = analysis.score || 0;
  const riskLevel = analysis.risk_level ? String(analysis.risk_level) : "Pending";
  const archetype = context.archetype ? String(context.archetype) : "Strategic model pending";
  const detectedTier = context.starting_position ? String(context.starting_position) : "Not classified";
  const target = context.target_realistic ? String(context.target_realistic) : "Target pending";

  // Safely parse arrays that AI might hallucinate as strings
  const realityCheck = Array.isArray(letter.the_reality_check) 
    ? letter.the_reality_check 
    : (typeof letter.the_reality_check === 'string' ? [letter.the_reality_check] : []);
    
  const pathToDominance = Array.isArray(letter.the_path_to_dominance)
    ? letter.the_path_to_dominance
    : [];
  
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

        {/* Top Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Risk Level</h3>
            <p style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: riskLevel === 'Low' ? '#16a34a' : riskLevel === 'High' ? '#dc2626' : riskLevel === 'Pending' ? '#94a3b8' : '#d97706' }}>
              {riskLevel}
            </p>
            {riskLevel === 'Pending' && <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>Awaiting AI analysis</p>}
          </div>
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Archetype</h3>
            <p style={{ fontSize: '1.125rem', fontWeight: 600, color: archetype === 'Pending' ? '#94a3b8' : '#0f172a', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{archetype}</p>
            {archetype === 'Pending' && <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>Context Engine not yet run</p>}
          </div>
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Detected Tier</h3>
            <p style={{ fontSize: '1.125rem', fontWeight: 600, color: detectedTier === 'Unknown' ? '#94a3b8' : '#0f172a', margin: 0 }}>{detectedTier}</p>
            {detectedTier === 'Unknown' && <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>Insufficient data to determine</p>}
          </div>
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Target</h3>
            <p style={{ fontSize: '1.125rem', fontWeight: 600, color: target === 'Pending' ? '#94a3b8' : '#1A237E', margin: 0 }}>{target}</p>
            {target === 'Pending' && <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>Run analysis to calculate</p>}
          </div>
        </div>

        {/* The Audit Letter Paper */}
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
          {/* Header Line */}
          <div style={{ height: '4px', width: '100%', background: 'linear-gradient(to right, #fbbf24, #f59e0b)' }}></div>
          
          <div style={{ padding: '3rem' }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1A237E', marginBottom: '1.5rem' }}>Strategic Audit Letter</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', color: '#475569' }}>
                <p style={{ margin: 0 }}><strong>To:</strong> The Board of Directors at the Firm</p>
                <p style={{ margin: 0 }}><strong>From:</strong> RankPilot Consulting</p>
                <p style={{ margin: 0 }}><strong>Date:</strong> {dateStr}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', color: '#1e293b', lineHeight: 1.6 }}>
              
              {/* Executive Summary */}
              <div>
                <p style={{ fontSize: '1.125rem', color: '#475569', fontStyle: 'italic', margin: 0 }}>
                  {analysis.summary ? String(analysis.summary) : "Pending analysis generation."}
                </p>
              </div>

              {/* State of Play */}
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>The State of Play</h3>
                <p style={{ margin: 0 }}>{letter.the_state_of_play ? String(letter.the_state_of_play) : "Pending."}</p>
              </div>

              {/* Unfair Advantage */}
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>The Unfair Advantage</h3>
                <p style={{ margin: 0 }}>{letter.the_unfair_advantage ? String(letter.the_unfair_advantage) : "Pending."}</p>
              </div>

              {/* Reality Check */}
              <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '1.5rem', border: '1px solid #f1f5f9' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>The Reality Check</h3>
                <p style={{ marginBottom: '1rem', color: '#475569' }}>The submission is currently held back by avoidable defects:</p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: 0, margin: 0, listStyleType: 'none' }}>
                  {realityCheck.length > 0 ? realityCheck.map((point: any, i: number) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <span style={{ color: '#f59e0b', marginRight: '0.5rem', marginTop: '0.1rem' }}>•</span>
                      <span>{typeof point === 'object' ? JSON.stringify(point) : String(point)}</span>
                    </li>
                  )) : (
                    <li style={{ color: '#64748b', fontStyle: 'italic' }}>No defects identified.</li>
                  )}
                </ul>
              </div>

              {/* Path to Dominance */}
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1A237E', marginBottom: '1.5rem' }}>The Path to Dominance</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {pathToDominance.length > 0 ? pathToDominance.map((step: any, i: number) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', background: '#ffffff', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                      <div style={{ flex: 1, paddingRight: '1rem' }}>
                        <h4 style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem', margin: 0 }}>STEP {i + 1}: {typeof step === 'object' ? (step?.title ? String(step.title) : "Strategic Step") : "Strategic Step"}</h4>
                        <p style={{ color: '#475569', margin: 0 }}>{typeof step === 'object' ? (step?.description ? String(step.description) : JSON.stringify(step)) : String(step)}</p>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <button disabled style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', border: 'none' }}>
                          <CheckCircle2 style={{ width: '16px', height: '16px', marginRight: '0.5rem' }} />
                          Apply Fix (v3)
                        </button>
                      </div>
                    </div>
                  )) : (
                    <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>Strategic path is being formulated.</p>
                  )}
                </div>
              </div>

              {/* Execution Layer Actions */}
              <div className="print-hidden" style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.25rem' }}>Execution Engine</h3>
                    <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Automatically resolve structural defects and optimize your matters.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button disabled style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
                      <RefreshCw style={{ width: '16px', height: '16px', marginRight: '0.5rem' }} />
                      Rewrite Matters (v3)
                    </button>
                    <button disabled style={{ background: '#1A237E', opacity: 0.5, cursor: 'not-allowed', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
                      <Zap style={{ width: '16px', height: '16px', marginRight: '0.5rem' }} />
                      Generate Improved Version (v3)
                    </button>
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
