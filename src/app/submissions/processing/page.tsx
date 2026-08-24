'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, FileText, CheckCircle2 } from 'lucide-react';

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submissionId = searchParams.get('id');
  const documentUrl = searchParams.get('url');
  const rawText = searchParams.get('text');
  const docName = searchParams.get('name') || 'Document';
  const directory = searchParams.get('directory') || '';
  const region = searchParams.get('region') || '';
  const practice = searchParams.get('practice') || '';

  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(1); 
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [supportMsg, setSupportMsg] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const isFinishedRef = useRef(false);

  // v18.0: ASYNC ARCHITECTURE — Fire-and-forget + Polling
  // Step 1: Send document to Render (returns in <5s)
  // Step 2: Poll /api/check-status every 10s until 'Submitted' or 'Error'
  useEffect(() => {
    if (!submissionId || hasStarted) return;
    if (!documentUrl && !rawText) return;
    setHasStarted(true);
    
    const processDocument = async () => {
      try {
        setStep(1);
        setProgress(10);
        
        const body: any = { submissionId };
        if (documentUrl) {
          body.documentUrl = documentUrl;
        }
        if (rawText) {
          body.text = rawText;
          body.is_text = true;
        }

        // Fire-and-forget: this returns in <5 seconds
        const res = await fetch('/api/process-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        
        const responseText = await res.text();
        let data: any;
        try {
          data = JSON.parse(responseText);
        } catch (jsonErr) {
          throw new Error(
            responseText?.includes('An error occurred')
              ? 'El motor de IA esta reiniciandose. Por favor espera 30 segundos e intenta de nuevo.'
              : `Error de conexion con el servidor (${res.status}). Intenta de nuevo en unos momentos.`
          );
        }
        
        if (!res.ok) {
          setErrorCode(data.errorCode || 'UNKNOWN');
          setSupportMsg(data.supportMessage || null);
          throw new Error(data.error || 'Fallo en la extraccion de la IA');
        }

        // Pipeline accepted — now poll for completion
        setStep(2);
        setProgress(20);
        const startTime = Date.now();
        const estimatedDurationMs = 10 * 60 * 1000; // ~10 min estimate

        const pollInterval = setInterval(async () => {
          try {
            // Update progress based on elapsed time (estimated)
            const elapsed = Date.now() - startTime;
            const estimatedProgress = Math.min(20 + (elapsed / estimatedDurationMs) * 70, 90);
            setProgress(Math.round(estimatedProgress));

            // Update step labels based on elapsed time
            if (elapsed > 7 * 60 * 1000) setStep(3); // >7min: "Classification"
            else if (elapsed > 3 * 60 * 1000) setStep(2); // >3min: "Analysis"

            const statusRes = await fetch(`/api/check-status?id=${submissionId}`);
            const statusData = await statusRes.json();

            if (statusData.status === 'Submitted') {
              // Pipeline completed!
              isFinishedRef.current = true;
              clearInterval(pollInterval);
              setProgress(100);
              setStep(4);
              setTimeout(() => router.push(`/reports/${submissionId}`), 1500);
            } else if (statusData.status === 'Error') {
              // Pipeline failed
              isFinishedRef.current = true;
              clearInterval(pollInterval);
              setErrorCode(statusData.errorCode || 'PIPELINE_ERROR');
              setErrorMsg(statusData.errorMessage || 'El pipeline encontró un error. Intenta de nuevo.');
            }
            // else: still 'Processing' — keep polling
          } catch (pollErr) {
            console.error('[POLL ERROR]', pollErr);
            // Don't stop polling on network errors — just retry
          }
        }, 10_000); // Poll every 10 seconds

        // Safety: stop polling after 20 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (!isFinishedRef.current) {
            setErrorMsg('El procesamiento tardó demasiado. Revisa la página de reportes — tu resultado podría estar listo.');
          }
        }, 20 * 60 * 1000);

      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message);
      }
    };

    processDocument();
  }, [submissionId, documentUrl, rawText, router, hasStarted]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 0' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          RankPilot: <span style={{ color: '#2563eb' }}>Legal Directory Portal</span>
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#64748b', marginTop: '0.25rem' }}>Setup Wizard — processing your document</p>
      </div>

      {/* Main Processing Container */}
      <div style={{ 
        background: '#ffffff', 
        borderRadius: '16px', 
        border: '1px solid #e2e8f0',
        padding: '3rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
      }}>
        
        {/* Document Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', marginBottom: '4rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
            <FileText size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem', margin: 0 }}>{decodeURIComponent(docName)}</p>
            <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>{[directory, region, practice].filter(Boolean).join(' \u00B7 ') || 'Processing submission...'}</p>
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0 }}>submission_id: {submissionId}</p>
          </div>
          <div style={{ padding: '0.5rem 1rem', background: '#dcfce7', color: '#15803d', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 600 }}>
            Uploaded
          </div>
        </div>

        {/* Central Animation */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '4rem' }}>
          
          <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
            {/* Outer dotted rings - pure CSS representation */}
            <div style={{ position: 'absolute', inset: 0, border: '2px dashed #cbd5e1', borderRadius: '50%', animation: 'spin 10s linear infinite' }}></div>
            <div style={{ position: 'absolute', inset: '10px', border: '1px dashed #94a3b8', borderRadius: '50%', animation: 'spin-reverse 15s linear infinite' }}></div>
            
            <div style={{ 
              width: '64px', height: '64px', background: '#2563eb', borderRadius: '16px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff',
              boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.5)', zIndex: 10
            }}>
              <Sparkles size={32} />
            </div>

            {/* Orbiting icons */}
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', borderRadius: '50%', padding: '4px', color: '#3b82f6' }}><FileText size={16} /></div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, transform: 'translate(50%, 50%)', background: '#fff', borderRadius: '50%', padding: '4px', color: '#3b82f6' }}><CheckCircle2 size={16} /></div>
          </div>

          <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Mapping raw data to universal schema...</h2>
          <p style={{ fontSize: '1.25rem', color: '#64748b' }}>Extracting key content and signals from the document.</p>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Extraction</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#2563eb' }}>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#2563eb', transition: 'width 0.2s ease-out' }}></div>
          </div>
        </div>

        {/* Backend Status / Error Box */}
        {errorMsg ? (
          <div style={{ 
            padding: '1.5rem', 
            background: errorMsg.includes('tardó demasiado') || errorMsg.includes('segundo plano') ? '#eff6ff' : '#fef2f2', 
            borderRadius: '12px', 
            border: `1px solid ${errorMsg.includes('tardó demasiado') || errorMsg.includes('segundo plano') ? '#bfdbfe' : '#fecaca'}`, 
            marginBottom: '3rem' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{errorMsg.includes('tardó demasiado') || errorMsg.includes('segundo plano') ? 'ℹ️' : '⚠️'}</span>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: errorMsg.includes('tardó demasiado') || errorMsg.includes('segundo plano') ? '#1e40af' : '#991b1b', margin: 0 }}>
                {errorMsg.includes('tardó demasiado') || errorMsg.includes('segundo plano') ? 'Procesamiento profundo en segundo plano' : 'Error en el procesamiento'}
              </h3>
              {errorCode && (
                <span style={{ padding: '0.25rem 0.75rem', background: '#fee2e2', color: '#dc2626', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600 }}>
                  {errorCode}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.9rem', color: errorMsg.includes('tardó demasiado') || errorMsg.includes('segundo plano') ? '#1e3a8a' : '#b91c1c', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
              {errorMsg.includes('tardó demasiado') || errorMsg.includes('segundo plano')
                ? 'Tu postulación contiene un volumen amplio de evidencia (30+ asuntos). El motor de IA continúa analizando de forma segura en Render (~8-15 min). Puedes cerrar esta pantalla o consultar tus Deliverables en Reportes.'
                : errorMsg}
            </p>
            {supportMsg && (
              <p style={{ fontSize: '0.8rem', color: '#92400e', margin: '0 0 1rem 0', padding: '0.5rem 0.75rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                💡 {supportMsg}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => router.push('/reports')}
                style={{ padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
              >
                📊 Ir a la sección de Reportes
              </button>
              <button
                onClick={() => { setErrorMsg(null); setErrorCode(null); setSupportMsg(null); }}
                style={{ padding: '0.5rem 1.25rem', background: '#f1f5f9', color: '#475569', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}
              >
                Seguir en esta pantalla
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9', marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 0.25rem 0' }}>
              <span style={{ fontWeight: 600, color: '#334155' }}>Backend status:</span> processing · <span style={{ fontWeight: 600, color: '#334155' }}>message:</span> {step === 4 ? 'Complete! Matters extracted.' : 'Mapping raw data to universal schema...'}
            </p>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Metadata and matters detection in progress</p>
          </div>
        )}

        {/* Stepper Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '2rem' }}>
          {['Upload', 'Extraction', 'Analysis', 'Classification', 'Ready'].map((label, idx) => {
            const isCompleted = idx < step;
            const isCurrent = idx === step;
            return (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
                {idx > 0 && (
                  <div style={{ position: 'absolute', top: '16px', left: '-50%', right: '50%', height: '2px', background: isCompleted || isCurrent ? '#3b82f6' : '#e2e8f0', zIndex: 0 }}></div>
                )}
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isCompleted ? '#2563eb' : (isCurrent ? '#eff6ff' : '#ffffff'),
                  color: isCompleted ? '#ffffff' : (isCurrent ? '#2563eb' : '#94a3b8'),
                  border: isCompleted ? '2px solid #2563eb' : (isCurrent ? '2px solid #2563eb' : '2px solid #e2e8f0'),
                  zIndex: 1,
                  marginBottom: '0.75rem'
                }}>
                  {isCompleted ? <CheckCircle2 size={16} /> : (isCurrent ? <FileText size={14} /> : <FileText size={14} />)}
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: isCurrent ? 600 : 500, color: isCurrent ? '#2563eb' : (isCompleted ? '#0f172a' : '#94a3b8') }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
      `}} />
    </div>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={<div style={{padding: '3rem', textAlign: 'center'}}>Loading...</div>}>
      <ProcessingContent />
    </Suspense>
  )
}
