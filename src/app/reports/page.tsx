'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, CheckCircle2, Clock, FileDown, Layers, ArrowUpRight } from 'lucide-react';
import { getUserSubmissionsWithMatters } from '@/app/actions/reports';

type Matter = {
  id: string;
  status: string;
  name: string;
};

type Submission = {
  id: string;
  targetDirectory: string;
  practiceArea: string;
  guideRegion: string;
  createdAt: Date | string;
  matters: Matter[];
};

export default function ReportsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const res = await getUserSubmissionsWithMatters();
      if (res.success && res.data) {
        setSubmissions(res.data);
      }
      setIsLoading(false);
    }
    loadData();
  }, []);

  const handleDownload = (subId: string, format: 'docx' | 'pdf') => {
    if (format === 'pdf') {
      window.open(`/api/generate-pdf?id=${subId}`, '_blank');
      return;
    }
    if (format === 'docx') {
      window.open(`/api/generate-docx?id=${subId}`, '_blank');
      return;
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Layers size={40} color="#2563eb" className="animate-pulse" />
          <span style={{ color: '#64748b', fontWeight: 600 }}>Loading deliverables...</span>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(0.95); } }
          .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        `}} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Header — same style as Builder */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          RankPilot: <span style={{ color: '#2563eb' }}>Deliverables</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#64748b', marginTop: '0.25rem' }}>
          Download your final reports ready for submission to the directories.
        </p>
      </div>

      {submissions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <FileDown size={48} color="#94a3b8" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ color: '#0f172a', fontSize: '1.25rem', marginBottom: '0.5rem' }}>No reports yet</h3>
          <p style={{ color: '#64748b' }}>Go to the Builder and process your matters to generate the first report.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {submissions.map((sub) => {
            const total = sub.matters.length;
            const optimized = sub.matters.filter(m => m.status === 'AI Optimized').length;
            const progress = total > 0 ? Math.round((optimized / total) * 100) : 0;
            const isReady = total > 0 && progress === 100;

            return (
              <div key={sub.id} style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '2rem',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 2px 4px -1px rgba(0,0,0,0.03)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
                e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(37,99,235,0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 2px 4px -1px rgba(0,0,0,0.03)';
              }}
              >
                {/* Ready ribbon */}
                {isReady && (
                  <div style={{ position: 'absolute', top: '1rem', right: '-2rem', background: '#16a34a', color: '#fff', padding: '0.2rem 3rem', transform: 'rotate(45deg)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                    READY
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#0f172a', margin: '0 0 0.25rem 0' }}>{sub.targetDirectory}</h2>
                    <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>{sub.practiceArea} · {sub.guideRegion}</p>
                  </div>
                  <div style={{
                    background: isReady ? '#dcfce7' : '#fef3c7',
                    color: isReady ? '#15803d' : '#92400e',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}>
                    {isReady ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                    {isReady ? 'Complete' : 'In Progress'}
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#475569', fontWeight: 500 }}>Matters Progress ({optimized}/{total})</span>
                    <span style={{ color: '#2563eb', fontWeight: 700 }}>{progress}%</span>
                  </div>
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${progress}%`,
                      background: isReady ? '#16a34a' : '#2563eb',
                      borderRadius: '999px',
                      transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} />
                  </div>
                </div>

                {/* Download Actions */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    disabled={!isReady || downloadingId === `${sub.id}-docx`}
                    onClick={() => handleDownload(sub.id, 'docx')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: isReady ? '#2563eb' : '#f1f5f9',
                      color: isReady ? '#fff' : '#94a3b8',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: isReady ? 'pointer' : 'not-allowed',
                      opacity: downloadingId === `${sub.id}-docx` ? 0.7 : 1,
                      transition: 'all 0.2s',
                      fontSize: '0.9rem'
                    }}
                  >
                    {downloadingId === `${sub.id}-docx` ? (
                      <div className="spinner" style={{ width: '18px', height: '18px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />
                    ) : (
                      <><Download size={16} /> Download .DOCX</>
                    )}
                  </button>

                  <button
                    disabled={!isReady || downloadingId === `${sub.id}-pdf`}
                    onClick={() => handleDownload(sub.id, 'pdf')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: isReady ? '#2563eb' : '#e2e8f0',
                      background: isReady ? '#eff6ff' : '#fafafa',
                      color: isReady ? '#2563eb' : '#94a3b8',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: isReady ? 'pointer' : 'not-allowed',
                      opacity: downloadingId === `${sub.id}-pdf` ? 0.7 : 1,
                      transition: 'all 0.2s',
                      fontSize: '0.9rem'
                    }}
                  >
                    {downloadingId === `${sub.id}-pdf` ? (
                      <div className="spinner" style={{ width: '18px', height: '18px', border: '2px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%' }} />
                    ) : (
                      <><Download size={16} /> Download .PDF</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { animation: spin 1s linear infinite; }
      `}} />
    </div>
  );
}
