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
  }) => void;
  initialData: {
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
}

export default function PostIngestionWizardModal({
  isOpen,
  onClose,
  onComplete,
  initialData,
  targetDirectory = 'Chambers & Partners'
}: PostIngestionWizardModalProps) {
  const sanitizeStr = (s?: string) => {
    if (!s) return '';
    if (s.includes('SOURCE DOCUMENT') || s.startsWith('===')) return '';
    return s.trim();
  };

  // Local state for all fields being validated
  const [firmName, setFirmName] = useState(sanitizeStr(initialData.firmName));
  const [practiceArea, setPracticeArea] = useState(sanitizeStr(initialData.practiceArea));
  const [location, setLocation] = useState(sanitizeStr(initialData.location));
  const [b10Text, setB10Text] = useState(initialData.b10Text || '');
  const [lawyers, setLawyers] = useState<any[]>(initialData.lawyers || []);
  const [matters, setMatters] = useState<any[]>(initialData.matters || []);

  const calibratedPractice = sanitizeStr(initialData.calibratedPracticeArea);
  const extractedPractice = sanitizeStr(initialData.extractedPracticeArea || initialData.practiceArea);

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hasPracticeDiscrepancy = Boolean(
    calibratedPractice && 
    extractedPractice && 
    norm(calibratedPractice) !== norm(extractedPractice) &&
    !norm(calibratedPractice).includes(norm(extractedPractice)) &&
    !norm(extractedPractice).includes(norm(calibratedPractice))
  );

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
  const [isEditingInline, setIsEditingInline] = useState(false);

  // Sync when initialData changes
  useEffect(() => {
    if (initialData) {
      setFirmName(sanitizeStr(initialData.firmName));
      setPracticeArea(sanitizeStr(initialData.practiceArea));
      setLocation(sanitizeStr(initialData.location));
      setB10Text(initialData.b10Text || '');
      setLawyers(initialData.lawyers || []);
      setMatters(initialData.matters || []);
    }
  }, [initialData]);

  if (!isOpen) return null;

  const handleNext = () => {
    setIsEditingInline(false);
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Completed all steps!
      onComplete({
        firmName,
        practiceArea,
        location,
        b10Text,
        lawyers,
        matters
      });
    }
  };

  const handleBack = () => {
    setIsEditingInline(false);
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onComplete({
      firmName,
      practiceArea,
      location,
      b10Text,
      lawyers,
      matters
    });
  };

  const updateMatterField = (matterId: string, field: string, value: any) => {
    setMatters(prev => prev.map(m => {
      if (m.id === matterId) {
        return { ...m, [field]: value };
      }
      return m;
    }));
  };

  const currentMatterChunk = currentStep >= 4 ? matterChunks[currentStep - 4] || [] : [];
  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  return (
    <div style={{
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
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Validación Guiada de Datos Extraídos
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0.15rem 0 0 0' }}>
                Verifica los datos literales antes de proceder a la optimización de {targetDirectory}
              </p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            title="Saltar validación e ir directo al Studio completo"
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
            <span>Saltar al Studio</span>
            <X size={15} />
          </button>
        </div>

        {/* Body Content - Scrollable */}
        <div style={{
          padding: '1.75rem',
          overflowY: 'auto',
          flex: 1
        }}>
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

              {/* Discrepancy Alert between Calibration and Extracted Document */}
              {hasPracticeDiscrepancy && (
                <div style={{
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={18} color="#D97706" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400E' }}>
                      Discrepancia en Área de Práctica Detectada
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#78350F', margin: 0, lineHeight: 1.45 }}>
                    En la calibración estratégica seleccionaste <strong>{calibratedPractice}</strong>, pero en el documento identificamos <strong>{extractedPractice}</strong>. Selecciona qué área deseas oficializar para este submission:
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                    <button
                      type="button"
                      onClick={() => setPracticeArea(extractedPractice)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: practiceArea === extractedPractice ? '#2563eb' : '#FFFFFF',
                        color: practiceArea === extractedPractice ? '#FFFFFF' : '#1E293B',
                        border: '1px solid ' + (practiceArea === extractedPractice ? '#2563eb' : '#CBD5E1'),
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        boxShadow: practiceArea === extractedPractice ? '0 1px 3px rgba(37,99,235,0.2)' : 'none'
                      }}
                    >
                      {practiceArea === extractedPractice && <Check size={14} />}
                      <span>Usar del Documento: {extractedPractice}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPracticeArea(calibratedPractice)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: practiceArea === calibratedPractice ? '#2563eb' : '#FFFFFF',
                        color: practiceArea === calibratedPractice ? '#FFFFFF' : '#1E293B',
                        border: '1px solid ' + (practiceArea === calibratedPractice ? '#2563eb' : '#CBD5E1'),
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        boxShadow: practiceArea === calibratedPractice ? '0 1px 3px rgba(37,99,235,0.2)' : 'none'
                      }}
                    >
                      {practiceArea === calibratedPractice && <Check size={14} />}
                      <span>Mantener de Calibración: {calibratedPractice}</span>
                    </button>
                  </div>
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
                    const ranking = l.suggestedRanking || l.ranking || 'Ranked Candidate';
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
                          {ranking}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#94A3B8', fontStyle: 'italic', gridColumn: '1 / -1', padding: '1rem', textAlign: 'center' }}>
                    No se extrajo lista explícita de abogados de cabecera. Se deducirán de los socios líderes de cada asunto.
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
                const confStatus = matter.confidentialityStatus || (matter.isConfidential ? 'confidential' : 'publishable');
                const isConf = confStatus === 'confidential';
                const isUnconfirmed = confStatus === 'confirmation_required';
                const hasValueConflict = !!matter.valueConflict;

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
                          {matter.title || matter.name || 'Asunto'}
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
                        <span><strong>Aviso de Auditoría FX:</strong> {matter.valueConflict}</span>
                      </div>
                    )}

                    {/* Matter Fields */}
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
                          <label style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>Confidencialidad</label>
                          <select
                            value={confStatus}
                            onChange={e => {
                              const val = e.target.value;
                              updateMatterField(matter.id, 'confidentialityStatus', val);
                              updateMatterField(matter.id, 'isConfidential', val === 'confidential');
                              updateMatterField(matter.id, 'confidentialityConfirmed', val !== 'confirmation_required');
                            }}
                            style={{
                              width: '100%',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.82rem',
                              background: '#FFFFFF'
                            }}
                          >
                            <option value="publishable">Publicable</option>
                            <option value="confidential">Confidencial</option>
                            <option value="confirmation_required">Requiere Confirmación</option>
                          </select>
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

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
            <div>
              {currentStep > 1 && (
                <button
                  onClick={handleBack}
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
                onClick={() => setIsEditingInline(prev => !prev)}
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
                <Edit3 size={14} /> {isEditingInline ? 'Cerrar Edición' : 'Editar y Confirmar'}
              </button>

              <button
                onClick={handleNext}
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
                <span>{currentStep === totalSteps ? 'Finalizar Validación e ir al Studio' : '✓ Confirmar y Continuar'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
