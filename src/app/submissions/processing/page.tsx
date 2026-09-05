'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, FileText, CheckCircle2, FileBarChart, Clock, AlertTriangle, RotateCw, Coffee } from 'lucide-react';

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
  const retryRequested = searchParams.get('retry') === '1';

  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(1); 
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [supportMsg, setSupportMsg] = useState<string | null>(null);
  const [errorReference, setErrorReference] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);
  const [runToken, setRunToken] = useState(0);
  const [matterCount, setMatterCount] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [progressLabel, setProgressLabel] = useState('Preparing the background job');
  const [estimatedTotalMinutes, setEstimatedTotalMinutes] = useState<number>(0);
  const [terminalState, setTerminalState] = useState<'processing' | 'submitted' | 'error'>('processing');
  const [isRetrying, setIsRetrying] = useState(false);
  const isFinishedRef = useRef(false);

  // v18.0: ASYNC ARCHITECTURE — Fire-and-forget + Resilient Polling
  // Step 1: Send document to Render (returns in <5s)
  // Step 2: Poll /api/check-status every 10s until 'Submitted' or 'Error'
  useEffect(() => {
    if (!submissionId) return;
    isFinishedRef.current = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const applyStatus = (statusData: any) => {
      if (statusData?.matterCount > 0) setMatterCount(statusData.matterCount);
      if (Number.isFinite(statusData?.progress)) setProgress(statusData.progress);
      if (statusData?.progressLabel) setProgressLabel(statusData.progressLabel);
      if (statusData?.estimatedTotalMinutes > 0) {
        setEstimatedTotalMinutes(statusData.estimatedTotalMinutes);
      }
      if (Number.isFinite(statusData?.elapsedSeconds)) {
        setElapsedSeconds(statusData.elapsedSeconds);
      }
      const backendProgress = Number(statusData?.progress || 0);
      if (statusData?.status === 'Submitted') setStep(4);
      else if (backendProgress >= 99) setStep(3);
      else if (backendProgress >= 74) setStep(3);
      else if (backendProgress >= 22) setStep(2);
      else setStep(1);
    };

    const handleTerminalStatus = (statusData: any) => {
      if (statusData.status === 'Submitted') {
        isFinishedRef.current = true;
        setTerminalState('submitted');
        if (pollInterval) clearInterval(pollInterval);
        setErrorMsg(null);
        setProgress(100);
        setProgressLabel('Deliverables ready');
        setStep(4);
        setTimeout(() => router.push(`/reports/${submissionId}`), 800);
        return true;
      }
      if (statusData.status === 'Error') {
        isFinishedRef.current = true;
        setTerminalState('error');
        setStep(3);
        if (pollInterval) clearInterval(pollInterval);
        setErrorCode(statusData.errorCode || 'PIPELINE_ERROR');
        setErrorTitle(statusData.errorTitle || 'The analysis could not be completed');
        setErrorMsg(statusData.errorMessage || 'The analysis could not be completed. Please try again.');
        setSupportMsg(statusData.errorNextStep || null);
        setErrorReference(statusData.errorReference || null);
        setCanRetry(statusData.canRetry !== false);
        return true;
      }
      return false;
    };
    
    const processDocument = async () => {
      try {
        setStep(1);
        setProgress(2);
        let shouldTriggerPipeline = true;
        
        // Pre-check if submission is ALREADY completed in DB
        try {
          const checkRes = await fetch(`/api/check-status?id=${submissionId}`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            applyStatus(checkData);
            // A report-level Retry carries an explicit one-shot intent. An
            // existing terminal Error must not short-circuit the new enqueue.
            if (!(retryRequested && checkData.status === 'Error')) {
              if (handleTerminalStatus(checkData)) return;
            }
            if (checkData.status === 'Processing') {
              shouldTriggerPipeline = false;
              console.log('[PROCESSING PAGE] Resuming persisted background job');
            }
          }
        } catch (checkErr) {
          console.warn('[PROCESSING PAGE] Status pre-check failed, continuing to process-document', checkErr);
        }

        if (!shouldTriggerPipeline) {
          // The Render job already owns this submission. Refreshing or returning
          // from Reports must never submit a duplicate job.
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
                ? 'The AI engine is restarting. Please wait 30 seconds and try again.'
                : `Server connection error (${res.status}). Please try again shortly.`
            );
          }
          
          if (!res.ok) {
            setErrorCode(data.errorCode || 'UNKNOWN');
            setTerminalState('error');
            setStep(3);
            setErrorTitle('Processing could not be started');
            setSupportMsg(data.supportMessage || null);
            setCanRetry(true);
            throw new Error(data.error || 'The AI extraction failed');
          }

          // Consume the one-shot retry flag. Refreshing a later terminal error
          // must display that error, never start an unbounded retry loop.
          if (retryRequested) {
            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.delete('retry');
            router.replace(`/submissions/processing?${nextParams.toString()}`, { scroll: false });
          }
        }

        // Pipeline accepted — now poll for completion
        setStep(2);

        const pollStatus = async () => {
          try {
            const statusRes = await fetch(`/api/check-status?id=${submissionId}`);
            if (!statusRes.ok) return;
            const statusData = await statusRes.json();
            applyStatus(statusData);
            handleTerminalStatus(statusData);
          } catch (pollErr) {
            console.error('[POLL ERROR]', pollErr);
          }
        };
        await pollStatus();
        if (!isFinishedRef.current) pollInterval = setInterval(pollStatus, 8_000);

      } catch (err: any) {
        console.error(err);
        setTerminalState('error');
        setStep(3);
        setErrorMsg(err.message);
      }
    };

    processDocument();
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [submissionId, documentUrl, rawText, docName, router, runToken, retryRequested, searchParams]);

  const retryProcessing = async () => {
    if (!submissionId || isRetrying) return;
    setIsRetrying(true);
    try {
      const res = await fetch('/api/process-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, originalFileName: docName }),
      });
      const responseText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('The retry request could not be confirmed. Please try again shortly.');
      }
      if (!res.ok) {
        throw new Error(data.error || 'Processing could not be restarted.');
      }

      isFinishedRef.current = false;
      setErrorMsg(null);
      setErrorTitle(null);
      setErrorCode(null);
      setSupportMsg(null);
      setErrorReference(null);
      setTerminalState('processing');
      setProgress(2);
      setProgressLabel('Preparing the background job');
      setStep(1);
      if (retryRequested) {
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete('retry');
        router.replace(`/submissions/processing?${nextParams.toString()}`, { scroll: false });
      }
      setRunToken((token) => token + 1);
    } catch (err: any) {
      setTerminalState('error');
      setErrorTitle('Processing could not be restarted');
      setErrorMsg(err.message || 'Processing could not be restarted.');
    } finally {
      setIsRetrying(false);
    }
  };

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const remainingMinutes = estimatedTotalMinutes
    ? Math.max(1, estimatedTotalMinutes - Math.ceil(elapsedSeconds / 60))
    : 0;
  const waitingMessage = matterCount > 0
    ? elapsedMinutes >= 8
      ? `We are still working through ${matterCount} matters. Feel free to grab a coffee—processing will continue if you close or refresh this page.`
      : `We detected ${matterCount} matters. Estimated total processing time is approximately ${estimatedTotalMinutes || 25} minutes.`
    : elapsedMinutes >= 5
      ? 'This is a substantial document and it is continuing safely in the background.'
      : 'We are reading the document structure and will estimate the time after detecting its matters.';

  const isSuccess = terminalState === 'submitted';
  const isError = terminalState === 'error';

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
          <div style={{ padding: '0.5rem 1rem', background: isSuccess ? '#dcfce7' : (isError ? '#ffe4e6' : '#e0e7ff'), color: isSuccess ? '#15803d' : (isError ? '#be123c' : '#4338ca'), borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 600 }}>
            {isSuccess ? 'Completed' : (isError ? 'Review required' : 'Processing')}
          </div>
        </div>

        {/* Central Animation */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '4rem' }}>
          
          <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
            {/* Outer dotted rings - pure CSS representation */}
            <div style={{ position: 'absolute', inset: 0, border: '2px dashed #cbd5e1', borderRadius: '50%', animation: 'spin 10s linear infinite' }}></div>
            <div style={{ position: 'absolute', inset: '10px', border: '1px dashed #94a3b8', borderRadius: '50%', animation: 'spin-reverse 15s linear infinite' }}></div>
            
            <div style={{ 
              width: '64px', height: '64px', background: isSuccess ? '#16a34a' : (isError ? '#e11d48' : '#2563eb'), borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff',
              boxShadow: isSuccess ? '0 10px 25px -5px rgba(22, 163, 74, 0.5)' : (isError ? '0 10px 25px -5px rgba(225, 29, 72, 0.35)' : '0 10px 25px -5px rgba(37, 99, 235, 0.5)'), zIndex: 10,
              transition: 'background 0.3s ease'
            }}>
              {isSuccess ? <CheckCircle2 size={36} /> : (isError ? <AlertTriangle size={32} /> : <Sparkles size={32} />)}
            </div>

            {/* Orbiting icons */}
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', borderRadius: '50%', padding: '4px', color: '#3b82f6' }}><FileText size={16} /></div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, transform: 'translate(50%, 50%)', background: '#fff', borderRadius: '50%', padding: '4px', color: '#3b82f6' }}><CheckCircle2 size={16} /></div>
          </div>

          <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem', textAlign: 'center' }}>
            {isSuccess
              ? 'Submission processed successfully!'
              : (isError ? 'Processing stopped at the final review' : progressLabel)}
          </h2>
          <p style={{ fontSize: '1.25rem', color: '#64748b', textAlign: 'center' }}>
            {isSuccess
              ? 'Redirecting to Reports...'
              : isError
                ? 'Your original document remains unchanged. See the guidance below.'
              : (matterCount > 0 
                  ? `RankPilot is analyzing and optimizing ${matterCount} matters individually.`
                  : 'Extracting key content and signals from the file.')}
          </p>

          {/* Reassuring badge for large submissions */}
          {!isSuccess && !isError && (matterCount > 0 || elapsedMinutes >= 5) && (
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
              {elapsedMinutes >= 8 ? <Coffee size={17} color="#0284c7" /> : <Clock size={16} color="#0284c7" />}
              <span>{waitingMessage}</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>
              {isSuccess ? 'Completed' : (isError ? 'Final review stopped' : 'Live stage progress')}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: isSuccess ? '#16a34a' : (isError ? '#e11d48' : '#2563eb') }}>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: isSuccess ? '#16a34a' : (isError ? '#e11d48' : '#2563eb'), transition: 'width 0.3s ease-out' }}></div>
          </div>
          {!isSuccess && !isError && !errorMsg && (
            <div style={{ marginTop: '1rem', padding: '1rem 1.15rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, color: '#334155', fontSize: '0.9rem', fontWeight: 700 }}>
                  Disponible en el Submission Studio
                </p>
                <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                  Puedes acceder directamente al formulario interactivo para revisar campos o micro-optimizar asuntos individuales.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => router.push(`/reports/${submissionId}`)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1rem', background: '#1A237E', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                >
                  <Sparkles size={15} />
                  Abrir Submission Studio
                </button>
                <button
                  onClick={() => router.push('/reports')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.9rem', background: '#fff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}
                >
                  <FileBarChart size={15} />
                  Ver Reportes
                </button>
              </div>
            </div>
          )}
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
                {errorTitle || 'Processing could not be completed'}
              </h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#881337', margin: '0 0 1.25rem 0', lineHeight: 1.6 }}>
              {errorMsg}
            </p>
            {supportMsg && (
              <div style={{ fontSize: '0.85rem', color: '#78350f', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', lineHeight: 1.55 }}>
                <strong>What you can do:</strong> {supportMsg}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {canRetry ? <button
                onClick={retryProcessing}
                disabled={isRetrying}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: '#2563eb', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '0.85rem', fontWeight: 600, cursor: isRetrying ? 'wait' : 'pointer', opacity: isRetrying ? 0.75 : 1, boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)' }}
              >
                <RotateCw size={15} className={isRetrying ? 'animate-spin' : ''} />
                <span>{isRetrying ? 'Restarting…' : 'Retry'}</span>
              </button> : <button
                onClick={() => router.push('/submissions')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: '#2563eb', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)' }}
              >
                <FileText size={15} />
                <span>Review and upload again</span>
              </button>}
              <button
                onClick={() => router.push('/reports')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: '#ffffff', color: '#475569', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}
              >
                <FileBarChart size={15} />
                <span>Go to Reports</span>
              </button>
            </div>
            {errorReference && (
              <p style={{ fontSize: '0.72rem', color: '#9f1239', margin: '0.9rem 0 0' }}>
                Support reference: {errorReference}
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
