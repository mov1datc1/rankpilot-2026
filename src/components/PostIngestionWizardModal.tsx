'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Edit3, 
  ArrowRight, 
  ArrowLeft, 
  AlertTriangle, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Globe, 
  Sparkles, 
  Building2, 
  Users, 
  Briefcase, 
  FileText,
  X,
  Check
} from 'lucide-react';
import { getCanonicalPracticeArea } from '@/lib/constants';
import { publicationStatus, confirmPublicationStatus, valueConflict, valueAlternatives, validValueResolution, needsInputReview, normalizeReviewValue, valueResolutionIssues, applySourceConfidentiality } from '@/lib/audit/input-review';
import { detectPracticeAreaDiscrepancy } from '@/lib/audit/practice-area-classifier';

export interface PostIngestionWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: {
    firmName: string;
    practiceArea: string;
    location: string;
    b10Text: string;
    lawyers: any[];
    matters: any[];
    expectedRevision?: number;
    b10SourceChanged?: boolean;
  }) => void | Promise<void>;
  initialData: {
    sourceReports?: { source: string; detected_format: string; matter_count?: number; warnings?: string[]; empty_sections?: string[] }[];
    draftRevision?: number;
    firmName?: string;
    practiceArea?: string;
    calibratedPracticeArea?: string;
    extractedPracticeArea?: string;
    location?: string;
    b10Text?: string;
    lawyers?: any[];
    matters?: any[];
  };
  targetDirectory?: string;
  reviewPending?: boolean;
  startAtLawyers?: boolean;
  recheckConfidentiality?: () => Promise<any[]>;
}

export default function PostIngestionWizardModal({
  isOpen,
  onClose,
  onComplete,
  initialData,
  targetDirectory = 'Chambers & Partners',
  reviewPending = false,
  startAtLawyers = false,
  recheckConfidentiality
}: PostIngestionWizardModalProps) {
  const sanitizeStr = (s?: string) => {
    if (!s) return '';
    if (s.includes('SOURCE DOCUMENT') || s.startsWith('===')) return '';
    return s.trim();
  };

  const calibratedPractice = sanitizeStr(initialData.calibratedPracticeArea);
  const extractedPractice = sanitizeStr(initialData.extractedPracticeArea || initialData.practiceArea);

  // Canonical normalization eliminates false discrepancies (e.g. Labour vs Labor, Tax vs Taxation)
  const canonCalibrated = getCanonicalPracticeArea(calibratedPractice);
  const canonExtracted = getCanonicalPracticeArea(extractedPractice);

  const hasHeaderDiscrepancy = Boolean(
    calibratedPractice && 
    extractedPractice && 
    canonCalibrated !== canonExtracted
  );

  const [matters, setMatters] = useState<any[]>(initialData.matters || []);

  // Substantive matter-level topic classifier
  const substantiveDiscrepancy = React.useMemo(() => {
    return detectPracticeAreaDiscrepancy(calibratedPractice, matters);
  }, [calibratedPractice, matters]);

  const hasMaterialDiscrepancy = hasHeaderDiscrepancy || substantiveDiscrepancy.hasDiscrepancy;
  const suggestedPractice = substantiveDiscrepancy.hasDiscrepancy
    ? substantiveDiscrepancy.suggestedPractice
    : (extractedPractice || calibratedPractice);

  // Local state for all fields being validated
  const initialPractice = calibratedPractice || sanitizeStr(initialData.practiceArea);

  const [firmName, setFirmName] = useState(sanitizeStr(initialData.firmName));
  const [practiceArea, setPracticeArea] = useState(initialPractice);
  const [location, setLocation] = useState(sanitizeStr(initialData.location));
  const [b10Text, setB10Text] = useState(initialData.b10Text || '');
  const [lawyers, setLawyers] = useState<any[]>(initialData.lawyers || []);

  // Wizard Navigation:
  // Step 1: Firm & Practice Data
  // Step 2: Department & B10 Narrative
  // Step 3: Lawyer Roster (B9)
  // Step 4..N: Extracted Matters (Chunked 2 matters per step)
  const mattersChunkSize = 2;
  const matterChunks: any[][] = [];
  for (let i = 0; i < matters.length; i += mattersChunkSize) {
    matterChunks.push(matters.slice(i, i + mattersChunkSize));
  }
  const totalMatterSteps = Math.max(1, matterChunks.length);
  const totalSteps = 3 + totalMatterSteps;

  const [currentStep, setCurrentStep] = useState(1);
  const [validationError, setValidationError] = useState('');
  const contentRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => { contentRef.current?.scrollTo({top: 0}); setValidationError(''); }, [currentStep]);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [isSaving,setIsSaving] = useState(false);
  const [saveError,setSaveError] = useState('');
  const [rechecking, setRechecking] = useState(false);
  const [recheckMessage, setRecheckMessage] = useState('');
  const recheck = async () => {
    if (!recheckConfidentiality) return;
    setRechecking(true); setIsSaving(true); setRecheckMessage('');
    try {
      const extracted = await recheckConfidentiality();
      setMatters(current => applySourceConfidentiality(current, extracted));
      setRecheckMessage('Cruce completado. Se conservaron tus decisiones y montos. Los pendientes con fuente coincidente se marcaron confidenciales; guarda la revisión para conservar los cambios.');
    } catch { setRecheckMessage('No se pudo revisar la fuente. Tus datos se conservan; puedes reintentar.'); }
    finally { setRechecking(false); setIsSaving(false); }
  };
  const [expectedRevision,setExpectedRevision] = useState(initialData.draftRevision || 0);
  const [initialB10Source,setInitialB10Source] = useState(initialData.b10Text || '');

  // Sync when initialData changes
  useEffect(() => {
    if (isOpen) {
      const pendingIndex = (initialData.matters || []).findIndex(needsInputReview);
      setCurrentStep(startAtLawyers ? 3 : reviewPending && pendingIndex >= 0 ? 4 + Math.floor(pendingIndex / mattersChunkSize) : 1);
      contentRef.current?.scrollTo({top: 0});
      setIsEditingInline(false);
      setValidationError('');
      setExpectedRevision(initialData.draftRevision || 0);
      setInitialB10Source(initialData.b10Text || '');
      setSaveError('');
      setFirmName(sanitizeStr(initialData.firmName));
      setPracticeArea(calibratedPractice || sanitizeStr(initialData.practiceArea));
      setLocation(sanitizeStr(initialData.location));
      setB10Text(initialData.b10Text || '');
      setLawyers(initialData.lawyers || []);
      setMatters(initialData.matters || []);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const saveReview = async () => {
    if(isSaving)return;
    setIsSaving(true);setSaveError('');
    try {await onComplete({firmName,practiceArea,location,b10Text,lawyers,matters,expectedRevision,b10SourceChanged:b10Text!==initialB10Source});}
    catch(error) {setSaveError(error instanceof Error?error.message:'No se pudo guardar. Tus cambios siguen en esta ventana; vuelve a intentar.');}
    finally {setIsSaving(false);}
  };
  const handleNext = () => {
    if (currentMatterChunk.some(needsInputReview)) {
      setValidationError('Resuelve los permisos y montos señalados antes de continuar. Puedes guardar una revisión parcial si necesitas consultar la fuente.');
      return;
    }
    if (reviewPending) {
      const pendingIndex = matters.findIndex(needsInputReview);
      if (pendingIndex >= 0) setCurrentStep(4 + Math.floor(pendingIndex / mattersChunkSize));
      else void saveReview();
      return;
    }
    if (currentStep === totalSteps) {
      const pendingIndex = matters.findIndex(needsInputReview);
      if (pendingIndex >= 0) { setCurrentStep(4 + Math.floor(pendingIndex / mattersChunkSize)); return; }
    }
    setIsEditingInline(false);
    if(currentStep<totalSteps)setCurrentStep(prev=>prev+1);
    else void saveReview();
  };
  const handleBack = () => {setIsEditingInline(false);if(currentStep>1)setCurrentStep(prev=>prev-1);};
  const handleSkip = () => {void saveReview();};

  const updateMatterField = (matterId: string, field: string, value: any) => {
    setMatters(prev => prev.map(m => {
      if (m.id === matterId) {
        return { ...m, [field]: value };
      }
      return m;
    }));
  };

  const currentMatterChunk = currentStep >= 4 ? matterChunks[currentStep - 4] || [] : [];
  const progressPercent = Math.round(((currentStep - 1) / totalSteps) * 100);
  const pendingCount = matters.filter(needsInputReview).length;

  return (
    <div className="input-review" role="dialog" aria-modal="true" aria-labelledby="input-review-title" style={{
      color: '#0F172A',
      colorScheme: 'light',
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(8px)',
      padding: '1.25rem'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #E2E8F0',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #F8FAFC, #FFFFFF)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h2 id="input-review-title" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Revisa los datos de tu submission
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0.15rem 0 0 0' }}>
                Revisa los hechos extraídos y resuelve las discrepancias antes de optimizar para {targetDirectory}.
              </p>
            </div>
          </div>
          <button
            disabled={isSaving} onClick={handleSkip}
            title="Guardar los datos revisados y continuar después"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              transition: 'background 0.15s ease'
            }}
          >
            <span>Guardar revisión parcial</span>
            <X size={15} />
          </button>
        </div>

        {/* Body Content - Scrollable */}
        <div ref={contentRef} inert={isSaving} style={{
          padding: '1.75rem',
          overflowY: 'auto',
          flex: 1
        }}>
          {recheckConfidentiality && <section style={{marginBottom: '1rem', padding: '1rem', border: '1px solid #C7D2FE', borderRadius: 10, background: '#EEF2FF'}}>
            <button type="button" disabled={isSaving} onClick={() => void recheck()}>{rechecking ? 'Revisando documento…' : 'Revisar confidencialidad desde el documento'}</button>
            <p style={{fontSize: '.8rem', marginTop: 8}}>Cruza los permisos pendientes con la tabla de clientes. Conserva tus decisiones, textos y montos.</p>
            {recheckMessage && <p role="status">{recheckMessage}</p>}
          </section>}
          {/* STEP 1: FIRM & PRACTICE METADATA */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: '#EEF2FF',
                border: '1px solid #C7D2FE',
                borderRadius: '10px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <Building2 size={20} color="#4F46E5" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#3730A3' }}>
                    Identidad Institucional Detectada
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#4338CA' }}>
                    RankPilot identificó estos metadatos en la cabecera del documento. Confirma o edita si es necesario.
                  </p>
                </div>
              </div>

              {!!initialData.sourceReports?.length && <div className="review-decision">
                <strong>Fuentes leídas: {initialData.sourceReports.length}</strong>
                {initialData.sourceReports.map((source, index) => <div key={index} style={{marginTop: '.5rem', fontSize: '.8rem'}}>
                  <span>{source.source} · {source.detected_format.toUpperCase()} · {source.matter_count ?? 0} asuntos</span>
                  {source.warnings?.map((warning, i) => <p key={i}>{warning}</p>)}
                  {!!source.empty_sections?.length && <p>{source.empty_sections.length} espacios de asuntos vacíos en la plantilla no se importaron.</p>}
                </div>)}
                <p>La lectura técnica se completó. Ahora confirma los hechos y resuelve las discrepancias; esto no aprueba el documento final.</p>
              </div>}
              <div role="status" style={{padding:'1rem',background:'#EFF6FF',borderRadius:8}}>Se identificaron {matters.length} asuntos. Confirma que corresponden a tus fuentes. Guardar esta revisión conserva el borrador; no equivale a aprobar el documento final.</div>

              {/* Material Practice Discrepancy Interactive Decision Gate */}
              {hasMaterialDiscrepancy && (
                <div style={{
                  background: '#FFFBEB',
                  border: '1.5px solid #FDE68A',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={18} color="#D97706" />
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#92400E' }}>
                        Posible diferencia entre la práctica elegida y el contenido
                      </span>
                    </div>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: '#FEF3C7',
                      color: '#B45309',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      border: '1px solid #FDE68A'
                    }}>
                      Confirma la práctica
                    </span>
                  </div>

                  <p style={{fontSize:'0.82rem',color:'#78350F',margin:0}}>Seleccionaste <strong>{calibratedPractice}</strong>. La lectura inicial sugiere revisar si algunos asuntos corresponden a <strong>{suggestedPractice}</strong>. Es una señal para comprobar el trabajo jurídico, no un cambio automático ni una predicción del directorio.</p>

                  {/* 3-Button Action Suite requested by partner Angela Castillo */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.25rem' }}>
                    {/* Action 1: Switch Practice (Recommended) */}
                    <button
                      type="button"
                      onClick={() => setPracticeArea(suggestedPractice)}
                      style={{
                        padding: '0.65rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        background: practiceArea === suggestedPractice ? '#2563EB' : '#FFFFFF',
                        color: practiceArea === suggestedPractice ? '#FFFFFF' : '#1E293B',
                        border: '1.5px solid ' + (practiceArea === suggestedPractice ? '#2563EB' : '#CBD5E1'),
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                        boxShadow: practiceArea === suggestedPractice ? '0 2px 4px rgba(37,99,235,0.2)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Sparkles size={16} color={practiceArea === suggestedPractice ? '#FFFFFF' : '#2563EB'} />
                        <span>Cambiar práctica a <strong>{suggestedPractice}</strong></span>
                      </div>
                      {practiceArea === suggestedPractice ? (
                        <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: '4px' }}>✓ Confirmado</span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Alinear submission</span>
                      )}
                    </button>

                    {/* Action 2: Continue with Calibrated (With dilution caveat) */}
                    <button
                      type="button"
                      onClick={() => setPracticeArea(calibratedPractice)}
                      style={{
                        padding: '0.65rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        background: practiceArea === calibratedPractice ? '#475569' : '#FFFFFF',
                        color: practiceArea === calibratedPractice ? '#FFFFFF' : '#475569',
                        border: '1.5px solid ' + (practiceArea === calibratedPractice ? '#475569' : '#CBD5E1'),
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                        boxShadow: practiceArea === calibratedPractice ? '0 2px 4px rgba(71,85,105,0.2)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={15} color={practiceArea === calibratedPractice ? '#FFFFFF' : '#D97706'} />
                        <span>Continuar con <strong>{calibratedPractice}</strong> (Mantener selección)</span>
                      </div>
                      {practiceArea === calibratedPractice ? (
                        <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: '4px' }}>✓ Mantener</span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Revisar pertinencia</span>
                      )}
                    </button>

                    {/* Action 3: Review Extracted Evidence */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingInline(false);
                        setCurrentStep(4);
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        background: '#F8FAFC',
                        color: '#334155',
                        border: '1px dashed #94A3B8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <span>Revisar y editar mandatos extraídos antes de confirmar</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {practiceArea === calibratedPractice && substantiveDiscrepancy.warningIfContinued && (
                    <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '6px', padding: '0.6rem 0.85rem', marginTop: '0.2rem' }}>
                      <p style={{ fontSize: '0.75rem', color: '#9F1239', margin: 0, lineHeight: 1.45 }}>
                        La práctica elegida se conserva. La revisión final comprobará la pertinencia de cada asunto con sus fuentes.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!isEditingInline ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  background: '#F8FAFC',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0'
                }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                      Nombre del Despacho / Firma
                    </label>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
                      {firmName || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No detectado</span>}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                      Área de Práctica
                    </label>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
                      {practiceArea || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No detectada</span>}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                      Jurisdicción / Ubicación
                    </label>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
                      {location || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No detectada</span>}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: '1rem',
                  background: '#F8FAFC',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0'
                }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Nombre del Despacho</label>
                    <input
                      type="text"
                      value={firmName}
                      onChange={e => setFirmName(e.target.value)}
                      placeholder="Ej. Araquereyna / DeForest"
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.9rem',
                        marginTop: '0.35rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Área de Práctica</label>
                    <input
                      type="text"
                      value={practiceArea}
                      onChange={e => setPracticeArea(e.target.value)}
                      placeholder="Ej. Tax / Labour / Banking & Finance"
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.9rem',
                        marginTop: '0.35rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Jurisdicción / Ubicación</label>
                    <input
                      type="text"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="Ej. México / Venezuela / Colombia"
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.9rem',
                        marginTop: '0.35rem'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: DEPARTMENT & B10 OVERVIEW */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '10px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <FileText size={20} color="#16A34A" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#15803D' }}>
                    Narrativa Institucional B10 (Borrador Literal)
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#166534' }}>
                    Este es el texto base de &quot;What is this department best known for&quot; extraído directamente. Durante la optimización maestra se calibrará en los 4 Pilares (&lt;500 palabras).
                  </p>
                </div>
              </div>

              {!isEditingInline ? (
                <div style={{
                  background: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  padding: '1.25rem',
                  maxHeight: '280px',
                  overflowY: 'auto'
                }}>
                  <p style={{
                    fontSize: '0.88rem',
                    lineHeight: '1.6',
                    color: '#334155',
                    whiteSpace: 'pre-wrap',
                    margin: 0
                  }}>
                    {b10Text || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No se extrajo texto B10 del documento fuente. RankPilot generará la estructura institucional en la optimización.</span>}
                  </p>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                    Editar Borrador B10
                  </label>
                  <textarea
                    rows={8}
                    value={b10Text}
                    onChange={e => setB10Text(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.85rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.88rem',
                      lineHeight: '1.6',
                      marginTop: '0.35rem'
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 3: LAWYER ROSTER (B9) */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: '#FAF5FF',
                border: '1px solid #E9D5FF',
                borderRadius: '10px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <Users size={20} color="#9333EA" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#7E22CE' }}>
                    Abogados Clave Extraídos (Sección B9)
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#6B21A8' }}>
                    Se detectaron {lawyers.length} abogados asociados a esta práctica.
                  </p>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '0.75rem',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {lawyers.length > 0 ? (
                  lawyers.map((l: any, idx: number) => {
                    const name = l.name || l.fullName || `Abogado ${idx + 1}`;
                    const role = l.role || (l.isPartner ? 'Partner' : 'Associate');
                    const ranking = l.suggestedRank || l.suggestedRanking || l.suggested_rank || l.suggested_ranking || '';
                    return (
                      <div key={idx} style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '10px',
                        padding: '0.85rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0F172A' }}>{name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.15rem' }}>{role}</div>
                        <label style={{display:'block',marginTop:8,fontSize:13,color:'#334155'}}>Cargo en este submission
                          <select aria-label={`Cargo de ${name}`} value={l.role || (l.isPartner === true ? 'Partner' : l.isPartner === false ? 'Associate' : '')}
                            onChange={e=>{const value=e.target.value;setLawyers(previous=>previous.map((item,index)=>index===idx?{...item,role:value,isPartner:value==='Partner',is_partner:value==='Partner',roleResolution:{role:value,reason:'',confirmed:false}}:item));}}
                            style={{display:'block',width:'100%',padding:8,marginTop:4,background:'#fff',color:'#0f172a',border:'1px solid #cbd5e1',borderRadius:6}}>
                            <option value="">Sin confirmar</option><option value="Partner">Socio / Partner</option><option value="Associate">Asociado / Associate</option><option value="Of Counsel">Of Counsel</option><option value="Other">Otro</option>
                            {l.role && !['Partner','Associate','Of Counsel','Other'].includes(l.role) && <option value={l.role}>{l.role}</option>}
                          </select>
                        </label>
                        <details style={{marginTop:8,fontSize:13}}><summary style={{cursor:'pointer'}}>Revisar el texto del perfil público</summary>
                          <label>Conserva solo datos sustentados y coherentes con el cargo confirmado.
                            <textarea aria-label={`Perfil de ${name}`} value={l.comments || l.bio || ''} onChange={e=>{const value=e.target.value;setLawyers(previous=>previous.map((item,index)=>index===idx?{...item,comments:value,bio:value}:item));}} rows={5} style={{display:'block',width:'100%',boxSizing:'border-box',background:'#fff',color:'#0f172a',padding:8,border:'1px solid #CBD5E1',borderRadius:6}} />
                          </label>
                        </details>
                        {l.roleResolution && <div style={{fontSize:12,color:'#475569',marginTop:8}}>
                          <label>Fuente, fecha y motivo de la corrección
                            <textarea aria-label={`Fuente del cargo de ${name}`} value={l.roleResolution.reason || ''} onChange={e=>{const reason=e.target.value;setLawyers(previous=>previous.map((item,index)=>index===idx?{...item,roleResolution:{...item.roleResolution,reason,confirmed:false}}:item));}} style={{width:'100%',background:'#fff',color:'#0f172a',padding:8,border:'1px solid #cbd5e1',borderRadius:6}}/>
                          </label>
                          <label style={{display:'flex',gap:6,alignItems:'start'}}><input type="checkbox" checked={l.roleResolution.confirmed===true} disabled={!l.role || !l.roleResolution.reason?.trim()} onChange={e=>{const confirmed=e.target.checked;setLawyers(previous=>previous.map((item,index)=>index===idx?{...item,roleResolution:{...item.roleResolution,confirmed}}:item));}}/>Confirmo el cargo para el periodo de este submission.</label>
                          {!l.roleResolution.confirmed && <p>Decisión pendiente antes de aprobar la entrega. Puedes guardar y seguir trabajando.</p>}
                        </div>}
                        <div style={{
                          display: 'inline-block',
                          marginTop: '0.4rem',
                          padding: '0.15rem 0.5rem',
                          background: '#F1F5F9',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          color: '#475569'
                        }}>
                          <label>Candidatura propuesta (opcional)
                            <input aria-label={`Candidatura de ${name}`} value={ranking} placeholder="Sin candidatura propuesta" onChange={e=>{const value=e.target.value;setLawyers(previous=>previous.map((item,index)=>index===idx?{...item,suggestedRank:value,suggestedRanking:value,suggested_rank:value,suggested_ranking:value}:item));}} style={{display:'block',width:'100%',boxSizing:'border-box',padding:8,marginTop:4,background:'#fff',color:'#0f172a',border:'1px solid #cbd5e1',borderRadius:6}} />
                          </label>
                          {l.isPartner === true && /associate/i.test(ranking) && <p>Esta candidatura es de asociado y el cargo declarado es socio. Corrige la propuesta o déjala vacía; se conserva la fuente original.</p>}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#94A3B8', fontStyle: 'italic', gridColumn: '1 / -1', padding: '1rem', textAlign: 'center' }}>
                    No se extrajo lista explícita de abogados de cabecera. Añade y confirma sus perfiles en el expediente; no se deducen cargos ni perfiles públicos desde los asuntos.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEPS 4 TO N: EXTRACTED MATTERS */}
          {currentStep >= 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '0.85rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Briefcase size={18} color="#4F46E5" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0F172A' }}>
                    Asuntos Extraídos (Grupo {currentStep - 3} de {totalMatterSteps})
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
                  Total en documento: {matters.length} asuntos
                </span>
              </div>

              {currentMatterChunk.map((matter: any) => {
                const confStatus = publicationStatus(matter);
                const isConf = confStatus === 'confidential';
                const isUnconfirmed = confStatus === 'confirmation_required';
                const originalMatter = initialData.matters?.find((original: any) => original.id === matter.id) || matter;
                const sourceConfirmed = confStatus === 'confidential' && matter.confidentialityEvidence?.basis === 'client_register' && !matter.confidentialityEvidence?.requires_review;
                const needsPublicationChoice = publicationStatus(originalMatter) === 'confirmation_required' && !sourceConfirmed;
                const hasValueConflict = !!valueConflict(matter) || (!!matter.valueResolution && !validValueResolution(matter));
                const resolutionIssues = valueResolutionIssues(matter.valueResolution);

                return (
                  <div key={matter.id} style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: hasValueConflict ? '2px solid #F59E0B' : '1px solid #E2E8F0',
                    padding: '1.25rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                  }}>
                    {/* Matter Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                          {isUnconfirmed ? String(matter.title || matter.name || 'Asunto').replace(/^(?:publishable|confidential|non[- ]publishable)\s+/i, '') : matter.title || matter.name || 'Asunto'}
                          {matter.source_document && <span style={{display: 'block', textTransform: 'none', fontWeight: 400}}>Fuente: {matter.source_document}</span>}
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', marginTop: '0.15rem' }}>
                          {matter.client || <span style={{ color: '#EF4444' }}>Cliente No Identificado</span>}
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isConf ? (
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            background: '#FEF3C7',
                            color: '#92400E',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            <Lock size={12} /> Confidencial
                          </span>
                        ) : isUnconfirmed ? (
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            background: '#FEE2E2',
                            color: '#991B1B',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            <AlertTriangle size={12} /> Requiere Confirmación
                          </span>
                        ) : (
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            background: '#D1FAE5',
                            color: '#065F46',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            <Globe size={12} /> Publicable
                          </span>
                        )}
                      </div>
                    </div>

                    {/* FX Conflict Warning Banner if detected */}
                    {hasValueConflict && (
                      <div style={{
                        background: '#FFFBEB',
                        border: '1px solid #FCD34D',
                        borderRadius: '8px',
                        padding: '0.6rem 0.85rem',
                        marginBottom: '0.85rem',
                        fontSize: '0.78rem',
                        color: '#92400E',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <AlertTriangle size={15} color="#D97706" style={{ flexShrink: 0 }} />
                        <span><strong>Revisa el monto y la moneda.</strong> {valueConflict(matter) || 'El monto cambió después de confirmarlo. Revisa de nuevo su fuente.'}</span>
                      </div>
                    )}

                    {needsPublicationChoice ? <fieldset className="review-decision">
                      <legend>Permiso de publicación {isUnconfirmed ? '· Requiere tu decisión' : '· Confirmado'}</legend>
                      <p>Indica cómo puede presentarse este asunto al directorio.</p>
                      <div className="review-options">
                        {[['publishable', 'Autorizado para publicar'], ['confidential', 'Confidencial']].map(([status, label]) => (
                          <label key={status} className={confStatus === status ? 'selected' : ''}>
                            <input type="radio" name={`publication-${matter.id}`} checked={confStatus === status} disabled={isSaving}
                              onChange={() => setMatters(prev => prev.map(m => m.id === matter.id ? confirmPublicationStatus(m, status) : m))} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </fieldset> : <p style={{fontSize: '.8rem', color: '#475569', margin: '.75rem 0'}}>
                      {isConf ? 'Se conserva la clasificación confidencial del borrador. Este asunto permanecerá en la sección confidencial.' : 'Se conserva la clasificación publicable del borrador.'}
                    </p>}
                    {hasValueConflict && <fieldset className="review-decision">
                      <legend>Monto definitivo · Obligatorio</legend>
                      <p>No elegiremos ni convertiremos una cifra por ti. Escribe el importe y la moneda que deben usarse; si son conceptos distintos, explícalos en la justificación.</p>
                      {valueAlternatives(matter).length > 0 && <div className="review-options">
                        {valueAlternatives(matter).map(option => <label key={option.label} className={matter.valueResolution?.value === option.value ? 'selected' : ''}>
                          <input type="radio" name={`value-${matter.id}`} checked={matter.valueResolution?.value === option.value} disabled={isSaving}
                            onChange={() => updateMatterField(matter.id, 'valueResolution', {...matter.valueResolution, value: option.value, confirmed: false})} />
                          <span>{option.label}<br /><strong>{option.value}</strong></span>
                        </label>)}
                      </div>}
                      <label>Monto y moneda confirmados (código de tres letras, por ejemplo MXN o USD)
                        <input aria-label={`Monto confirmado de ${matter.client || matter.name}`} placeholder="Ej. MXN 5500000"
                          value={matter.valueResolution?.value || ''} disabled={isSaving}
                          onChange={e => updateMatterField(matter.id, 'valueResolution', {...matter.valueResolution, value: e.target.value, confirmed: false})} />
                      </label>
                      <label>Fuente, concepto del importe y motivo de la decisión
                        <textarea aria-label={`Fuente del monto de ${matter.client || matter.name}`} placeholder="Documento y sección. Explica qué mide: valor del asunto, exposición, reclamación o resultado, y por qué corresponde este importe."
                          value={matter.valueResolution?.reason || ''} disabled={isSaving}
                          onChange={e => updateMatterField(matter.id, 'valueResolution', {...matter.valueResolution, reason: e.target.value, confirmed: false})} />
                      </label>
                      {resolutionIssues.length > 0 && <div id={`value-issues-${matter.id}`} role="status">
                        <strong>Para habilitar la confirmación:</strong>
                        <ul>{resolutionIssues.map(issue => <li key={issue}>{issue}</li>)}</ul>
                      </div>}
                      <label className="review-check">
                        <input type="checkbox" checked={validValueResolution(matter)} disabled={isSaving || resolutionIssues.length > 0}
                          aria-describedby={resolutionIssues.length > 0 ? `value-issues-${matter.id}` : undefined}
                          onChange={e => setMatters(prev => prev.map(m => m.id === matter.id ? {...m, value: normalizeReviewValue(m.valueResolution.value), valueResolution: {...m.valueResolution, value: normalizeReviewValue(m.valueResolution.value), confirmed: e.target.checked}} : m))} />
                        Confirmo que revisé la fuente y este es el monto que debe utilizar RankPilot.
                      </label>
                      {validValueResolution(matter) && <p role="status">Se usará {matter.value}. La discrepancia original quedará en el historial de esta decisión.</p>}
                    </fieldset>}

                    {!hasValueConflict && validValueResolution(matter) && <details className="review-decision">
                      <summary>Monto confirmado: {matter.value}</summary>
                      <p style={{marginTop: '.75rem'}}><strong>Fuente y motivo:</strong> {matter.valueResolution.reason}</p>
                      <p><strong>Discrepancia original:</strong> {matter.valueResolution.originalConflict}</p>
                    </details>}

                    {/* Matter Fields */}
                    {matter.confidentialityEvidence?.basis === 'client_register' && <p style={{fontSize: '.8rem', color: '#475569'}}>Confidencial según la tabla de clientes del documento original.</p>}
                    {!isEditingInline ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <div style={{ background: '#F8FAFC', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block' }}>Monto / Valor</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A' }}>
                            {matter.value || <span style={{ color: '#94A3B8', fontWeight: 400 }}>No especificado</span>}
                          </span>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block' }}>Socio Líder</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A' }}>
                            {matter.leadPartner || matter.lead_partner || <span style={{ color: '#94A3B8', fontWeight: 400 }}>No especificado</span>}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>Cliente</label>
                          <input
                            type="text"
                            value={matter.client || ''}
                            onChange={e => updateMatterField(matter.id, 'client', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.82rem'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>Monto / Valor</label>
                          <input
                            type="text"
                            value={matter.value || ''}
                            onChange={e => updateMatterField(matter.id, 'value', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.82rem'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>Socio Líder</label>
                          <input
                            type="text"
                            value={matter.leadPartner || matter.lead_partner || ''}
                            onChange={e => {
                              updateMatterField(matter.id, 'leadPartner', e.target.value);
                              updateMatterField(matter.id, 'lead_partner', e.target.value);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.82rem'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{fontSize:12,color:'#475569'}}>Otros integrantes del equipo
                            <input aria-label={`Equipo de ${matter.client || matter.name}`} value={matter.teamMembers || matter.team_members || ''} onChange={e=>{updateMatterField(matter.id,'teamMembers',e.target.value);updateMatterField(matter.id,'team_members',e.target.value);}} style={{display:'block',width:'100%',boxSizing:'border-box',padding:8,border:'1px solid #CBD5E1',borderRadius:6}} />
                          </label>
                        </div>
                        <div>
                          <label style={{fontSize:12,color:'#475569'}}>Fechas de actividad y estado para este periodo
                            <input aria-label={`Fechas y estado de ${matter.client || matter.name}`} value={matter.completionDate || ''} onChange={e=>updateMatterField(matter.id,'completionDate',e.target.value)} placeholder="Indica fechas y actividad confirmadas por la fuente" style={{display:'block',width:'100%',boxSizing:'border-box',padding:8,border:'1px solid #CBD5E1',borderRadius:6}} />
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Summary facts preview */}
                    <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#475569', lineHeight: '1.5' }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>Hechos fácticos extraídos: </span>
                      {matter.rawNotes || matter.summary || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Sin hechos descriptivos</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions & Progress Indicator */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderTop: '1px solid #F1F5F9',
          background: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}>
          {/* Progress Bar & Step Text */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
              Paso {currentStep} de {totalSteps}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
              {progressPercent}% completado
            </span>
          </div>

          <div style={{
            width: '100%',
            height: '6px',
            background: '#E2E8F0',
            borderRadius: '999px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #4F46E5 0%, #3730A3 100%)',
              transition: 'width 0.25s ease'
            }} />
          </div>

          <p style={{fontSize: '0.8rem', color: '#475569'}}>{pendingCount ? `${pendingCount} asuntos requieren una decisión. Puedes guardar y continuar después.` : 'Sin decisiones de permisos o montos pendientes.'}</p>
          {validationError && currentMatterChunk.some(needsInputReview) && <p role="alert" style={{color: '#B91C1C'}}>{validationError}</p>}
          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
            <div>
              {currentStep > 1 && (
                <button
                  disabled={isSaving} onClick={handleBack}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#334155',
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ArrowLeft size={14} /> Anterior
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                disabled={isSaving} onClick={() => setIsEditingInline(prev => !prev)}
                style={{
                  background: isEditingInline ? '#EEF2FF' : '#FFFFFF',
                  border: isEditingInline ? '1px solid #6366F1' : '1px solid #CBD5E1',
                  color: isEditingInline ? '#4F46E5' : '#475569',
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <Edit3 size={14} /> {isEditingInline ? 'Cerrar edición' : 'Editar datos'}
              </button>

              {saveError && <div role="alert" style={{color:'#B91C1C',maxWidth:360}}>{saveError} Tus cambios siguen en esta ventana; reintenta antes de salir.</div>}
              {isSaving && <span role="status">Guardando tu revisión…</span>}
              <button
                disabled={isSaving} onClick={handleNext}
                style={{
                  background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{reviewPending ? (pendingCount ? 'Continuar con los pendientes' : 'Guardar decisiones e ir al Studio') : currentStep === totalSteps ? 'Finalizar Validación e ir al Studio' : '✓ Confirmar y Continuar'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
