'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, CheckCircle, Clock, ChevronRight, FileDown, Layers, CheckCircle2 } from 'lucide-react';
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
    setDownloadingId(`${subId}-${format}`);
    // Simulate generation time
    setTimeout(() => {
      setDownloadingId(null);
      // In a real scenario, here we'd trigger a blob download from the Python API
      alert(`Tu reporte final en formato .${format} está listo y descargado.`);
    }, 2500);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: '#38bdf8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Layers size={40} className="animate-pulse" />
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>Cargando tus reportes...</span>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: .5; transform: scale(0.95); }
          }
          .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        `}} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* Header Premium */}
      <div style={{ 
        marginBottom: '3rem', 
        padding: '2.5rem', 
        borderRadius: '24px',
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(2,6,23,0.95))',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative elements */}
        <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: '#38bdf8', filter: 'blur(100px)', opacity: 0.15, borderRadius: '50%' }} />
        
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <FileText size={36} color="#38bdf8" />
          Deliverables
        </h1>
        <p style={{ fontSize: '1.15rem', color: '#94a3b8', margin: 0, maxWidth: '600px' }}>
          Descarga tus reportes finales listos para enviar a {submissions.length > 0 ? submissions[0].targetDirectory : 'los directorios'}. Todos los casos optimizados compilados en un solo documento.
        </p>
      </div>

      {submissions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: '#1e293b', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <FileDown size={48} color="#475569" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', marginBottom: '0.5rem' }}>No tienes reportes aún</h3>
          <p style={{ color: '#94a3b8' }}>Ve al Builder y procesa tus casos para generar el primer reporte.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '2rem' }}>
          {submissions.map((sub) => {
            const total = sub.matters.length;
            const optimized = sub.matters.filter(m => m.status === 'AI Optimized').length;
            const progress = total > 0 ? Math.round((optimized / total) * 100) : 0;
            const isReady = total > 0 && progress === 100;

            return (
              <div key={sub.id} style={{
                background: 'rgba(30,41,59,0.5)',
                backdropFilter: 'blur(12px)',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.05)',
                padding: '2rem',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
              }}
              className="report-card"
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.border = '1px solid rgba(56,189,248,0.2)';
                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.5), 0 0 30px rgba(56,189,248,0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.3)';
              }}
              >
                {/* Ribbon if ready */}
                {isReady && (
                  <div style={{ position: 'absolute', top: '1.5rem', right: '-2rem', background: '#10b981', color: '#fff', padding: '0.25rem 3rem', transform: 'rotate(45deg)', fontSize: '0.75rem', fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                    READY
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.25rem 0' }}>{sub.targetDirectory}</h2>
                    <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0 }}>{sub.practiceArea} • {sub.guideRegion}</p>
                  </div>
                  <div style={{ 
                    background: isReady ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    color: isReady ? '#34d399' : '#fbbf24',
                    padding: '0.5rem',
                    borderRadius: '50%'
                  }}>
                    {isReady ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#cbd5e1', fontWeight: 500 }}>Progreso de Casos ({optimized}/{total})</span>
                    <span style={{ color: isReady ? '#34d399' : '#38bdf8', fontWeight: 700 }}>{progress}%</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${progress}%`,
                      background: isReady ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #2563eb, #38bdf8)',
                      borderRadius: '999px',
                      transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    disabled={!isReady || downloadingId === `${sub.id}-docx`}
                    onClick={() => handleDownload(sub.id, 'docx')}
                    style={{
                      flex: 1,
                      padding: '0.8rem',
                      borderRadius: '12px',
                      border: 'none',
                      background: isReady ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#334155',
                      color: isReady ? '#fff' : '#94a3b8',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: isReady ? 'pointer' : 'not-allowed',
                      opacity: downloadingId === `${sub.id}-docx` ? 0.7 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    {downloadingId === `${sub.id}-docx` ? (
                      <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />
                    ) : (
                      <>
                        <Download size={18} />
                        .DOCX
                      </>
                    )}
                  </button>
                  
                  <button 
                    disabled={!isReady || downloadingId === `${sub.id}-pdf`}
                    onClick={() => handleDownload(sub.id, 'pdf')}
                    style={{
                      flex: 1,
                      padding: '0.8rem',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: isReady ? 'rgba(56,189,248,0.3)' : 'transparent',
                      background: isReady ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.02)',
                      color: isReady ? '#38bdf8' : '#64748b',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: isReady ? 'pointer' : 'not-allowed',
                      opacity: downloadingId === `${sub.id}-pdf` ? 0.7 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    {downloadingId === `${sub.id}-pdf` ? (
                      <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%' }} />
                    ) : (
                      <>
                        <Download size={18} />
                        .PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
      `}} />
    </div>
  );
}
