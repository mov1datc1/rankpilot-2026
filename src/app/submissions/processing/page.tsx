'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, FileText, CheckCircle2, FileBarChart, Clock, ArrowRight, AlertTriangle, RotateCw } from 'lucide-react';

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
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [supportMsg, setSupportMsg] = useState<string | null>(null);
  const [errorReference, setErrorReference] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [matterCount, setMatterCount] = useState<number>(0);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
  const isFinishedRef = useRef(false);

  // v18.0: ASYNC ARCHITECTURE — Fire-and-forget + Resilient Polling
  // Step 1: Send document to Render (returns in <5s)
  // Step 2: Poll /api/check-status every 10s until 'Submitted' or 'Error'
  useEffect(() => {
    if (!submissionId || hasStarted) return;
    setHasStarted(true);
    
    const processDocument = async () => {
      try {
        setStep(1);
        setProgress(10);
        
        // Pre-check if submission is ALREADY completed in DB
        try {
          const checkRes = await fetch(`/api/check-status?id=${submissionId}`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.matterCount > 0) setMatterCount(checkData.matterCount);
            if (checkData.status === 'Submitted') {
              console.log('[PROCESSING PAGE] Submission already completed — redirecting to reports');
              isFinishedRef.current = true;
              setErrorMsg(null);
              setProgress(100);
              setStep(4);
              router.push(`/reports/${submissionId}`);
              return;
            }
          }
        } catch (checkErr) {
          console.warn('[PROCESSING PAGE] Status pre-check failed, continuing to process-document', checkErr);
        }

        if (!documentUrl && !rawText) {
          // No input provided and submission not yet Submitted — fallback to polling
          console.log('[PROCESSING PAGE] No documentUrl provided — entering status polling mode');
        } else {
          // Fire-and-forget: this returns in <5 seconds
          const body: any = { submissionId, originalFileName: docName };
          if (documentUrl) body.documentUrl = documentUrl;
          if (rawText) {
            body.text = rawText;
            body.is_text = true;
          }

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
            setErrorTitle('No pudimos iniciar el procesamiento');
            setSupportMsg(data.supportMessage || null);
            setCanRetry(true);
            throw new Error(data.error || 'Fallo en la extraccion de la IA');
          }
        }

        // Pipeline accepted — now poll for completion
        setStep(2);
        setProgress(20);
        const startTime = Date.now();

        const pollInterval = setInterval(async () => {
          try {
            const elapsed = Date.now() - startTime;
            const mins = Math.floor(elapsed / 60000);
            setElapsedMinutes(mins);

            // Asymptotic progress curve:
            // 0 - 10 min: smooth progress from 20% to 90%
            // 10 - 35 min: slow asymptotic crawl from 90% to 99% (never freezes at 98%)
            let estimatedProgress = 20;
            if (elapsed <= 10 * 60 * 1000) {
              estimatedProgress = Math.min(90, Math.floor(20 + (elapsed / (10 * 60 * 1000)) * 70));
            } else {
              const extraMin = (elapsed - 10 * 60 * 1000) / (60 * 1000);
              const asymptoticAdd = 9 * (1 - Math.exp(-extraMin / 7));
              estimatedProgress = Math.min(99, Math.floor(90 + asymptoticAdd));
            }
            setProgress(estimatedProgress);

            // Update step labels based on elapsed time
            if (elapsed > 6 * 60 * 1000) setStep(3); // >6min: "Classification"
            else if (elapsed > 2 * 60 * 1000) setStep(2); // >2min: "Analysis"

            const statusRes = await fetch(`/api/check-status?id=${submissionId}`);
            const statusData = await statusRes.json();

            if (statusData?.matterCount > 0) {
              setMatterCount(statusData.matterCount);
            }

            if (statusData.status === 'Submitted') {
              // Pipeline completed! Jump to 100% Ready, clear any errors and redirect
              isFinishedRef.current = true;
              clearInterval(pollInterval);
              setErrorMsg(null);
              setProgress(100);
              setStep(4);
              setTimeout(() => router.push(`/reports/${submissionId}`), 800);
            } else if (statusData.status === 'Error') {
              // Pipeline failed
              isFinishedRef.current = true;
              clearInterval(pollInterval);
              setErrorCode(statusData.errorCode || 'PIPELINE_ERROR');
              setErrorTitle(statusData.errorTitle || 'No pudimos completar el análisis');
              setErrorMsg(statusData.errorMessage || 'El pipeline encontró un error. Intenta de nuevo.');
              setSupportMsg(statusData.errorNextStep || null);
              setErrorReference(statusData.errorReference || null);
              setCanRetry(statusData.canRetry !== false);
            }
            // else: still 'Processing' — keep polling
          } catch (pollErr) {
            console.error('[POLL ERROR]', pollErr);
            // Don't stop polling on network errors — just retry
          }
        }, 10_000); // Poll every 10 seconds

        // Extended safety check: Keep polling active up to 60 minutes for ultra-long submissions
        setTimeout(() => {
          if (!isFinishedRef.current) {
            console.log('[PROCESSING PAGE] Processing extended mode active — polling remains active');
          }
        }, 30 * 60 * 1000);

      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message);
      }
    };

    processDocument();
  }, [submissionId, documentUrl, rawText, docName, router, hasStarted]);

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
          <div style={{ padding: '0.5rem 1rem', background: step === 4 ? '#dcfce7' : '#e0e7ff', color: step === 4 ? '#15803d' : '#4338ca', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 600 }}>
            {step === 4 ? 'Completed' : 'Processing'}
          </div>
        </div>

        {/* Central Animation */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '4rem' }}>
          
          <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
            {/* Outer dotted rings - pure CSS representation */}
            <div style={{ position: 'absolute', inset: 0, border: '2px dashed #cbd5e1', borderRadius: '50%', animation: 'spin 10s linear infinite' }}></div>
            <div style={{ position: 'absolute', inset: '10px', border: '1px dashed #94a3b8', borderRadius: '50%', animation: 'spin-reverse 15s linear infinite' }}></div>
            
            <div style={{ 
              width: '64px', height: '64px', background: step === 4 ? '#16a34a' : '#2563eb', borderRadius: '16px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff',
              boxShadow: step === 4 ? '0 10px 25px -5px rgba(22, 163, 74, 0.5)' : '0 10px 25px -5px rgba(37, 99, 235, 0.5)', zIndex: 10,
              transition: 'background 0.3s ease'
            }}>
              {step === 4 ? <CheckCircle2 size={36} /> : <Sparkles size={32} />}
            </div>

            {/* Orbiting icons */}
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', borderRadius: '50%', padding: '4px', color: '#3b82f6' }}><FileText size={16} /></div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, transform: 'translate(50%, 50%)', background: '#fff', borderRadius: '50%', padding: '4px', color: '#3b82f6' }}><CheckCircle2 size={16} /></div>
          </div>

          <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem', textAlign: 'center' }}>
            {step === 4 
              ? '¡Postulación procesada con éxito!' 
              : (matterCount > 0 ? `Procesando ${matterCount} asuntos (matters)...` : 'Mapping raw data to universal schema...')}
          </h2>
          <p style={{ fontSize: '1.25rem', color: '#64748b', textAlign: 'center' }}>
            {step === 4 
              ? 'Redirigiendo a la sección de Reportes...' 
              : (matterCount > 0 
                  ? `Analizando y optimizando individualmente ${matterCount} casos para cumplimiento legal.` 
                  : 'Extracting key content and signals from the document.')}
          </p>

          {/* Reassuring badge for large submissions */}
          {step !== 4 && (matterCount > 0 || elapsedMinutes >= 5) && (
            <div style={{ 
              marginTop: '1.25rem', 
              padding: '0.75rem 1.25rem', 
              background: '#f0f9ff', 
              border: '1px solid #bae6fd', 
              borderRadius: '12px', 
              color: '#0369a1', 
              fontSize: '0.9rem', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              fontWeight: 500,
              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.05)'
            }}>
              <Clock size={16} color="#0284c7" />
              <span>
                {matterCount > 0
                  ? `Documento extenso con ${matterCount} asuntos detectado. La optimización profunda de IA toma tiempo adicional para garantizar alta calidad.`
                  : 'Documento extenso detectado. El procesamiento continuo de IA optimiza cada caso.'}
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>
              {step === 4 ? 'Complete' : 'Processing'}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: step === 4 ? '#16a34a' : '#2563eb' }}>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: step === 4 ? '#16a34a' : '#2563eb', transition: 'width 0.3s ease-out' }}></div>
          </div>
        </div>

        {/* Backend Status / Error Box (Only on real error) */}
        {errorMsg && (
          <div style={{ 
            padding: '1.5rem', 
            background: '#fff1f2', 
            borderRadius: '12px', 
            border: '1px solid #fecdd3', 
            marginBottom: '3rem',
            boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ffe4e6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={18} color="#e11d48" />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#9f1239', margin: 0 }}>
                {errorTitle || 'No pudimos completar el procesamiento'}
              </h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#881337', margin: '0 0 1.25rem 0', lineHeight: 1.6 }}>
              {errorMsg}
            </p>
            {supportMsg && (
              <div style={{ fontSize: '0.85rem', color: '#78350f', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', lineHeight: 1.55 }}>
                <strong>Qué puedes hacer:</strong> {supportMsg}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {canRetry ? <button
                onClick={async () => {
                  try {
                    const checkRes = await fetch(`/api/check-status?id=${submissionId}`);
                    if (checkRes.ok) {
                      const checkData = await checkRes.json();
                      if (checkData.status === 'Submitted') {
                        setErrorMsg(null);
                        setProgress(100);
                        setStep(4);
                        router.push(`/reports/${submissionId}`);
                        return;
                      }
                    }
                  } catch {}
                  setErrorMsg(null);
                  setErrorTitle(null);
                  setErrorCode(null);
                  setSupportMsg(null);
                  setErrorReference(null);
                  setHasStarted(false);
                  setProgress(0);
                  setStep(1);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: '#2563eb', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)' }}
              >
                <RotateCw size={15} />
                <span>Reintentar</span>
              </button> : <button
                onClick={() => router.push('/submissions')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: '#2563eb', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)' }}
              >
                <FileText size={15} />
                <span>Revisar y volver a cargar</span>
              </button>}
              <button
                onClick={() => router.push('/reports')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: '#ffffff', color: '#475569', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}
              >
                <FileBarChart size={15} />
                <span>Ir a Reportes</span>
              </button>
            </div>
            {errorReference && (
              <p style={{ fontSize: '0.72rem', color: '#9f1239', margin: '0.9rem 0 0' }}>
                Referencia para soporte: {errorReference}
              </p>
            )}
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
