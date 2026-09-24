'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Plus,
  Save,
  Trash2,
  Sparkles,
  Loader2,
  ArrowRight,
  FileText,
  Shield,
  Globe,
  HelpCircle,
  X,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  BookOpen
} from 'lucide-react';
import { createMatter, getMattersBySubmission } from '@/app/actions/matters';
import ImportFromAssistantModal from '@/components/ImportFromAssistantModal';

type MatterDraft = {
  id: string;
  name: string;
  client: string;
  value: string;
  leadPartner: string;
  rawNotes: string;
  isConfidential: boolean;
  crossBorder: string;
  teamMembers: string;
  otherFirms: string;
  completionDate: string;
  otherInfo: string;
  isNewClient: boolean;
  saved: boolean;
};

interface HelpInfo {
  title: string;
  field: string;
  whyChambersNeedsIt: string;
  example: string;
  riskIfMissing: string;
}

const FIELD_HELP_DATA: Record<string, HelpInfo> = {
  name: {
    title: 'Nombre del Asunto (Matter Name)',
    field: 'name',
    whyChambersNeedsIt: 'Identificador institucional del mandato para la tabla del submission y el índice del investigador.',
    example: 'Adquisición transfronteriza de parque solar por USD 120M o Litigio fiscal contra crédito determinante del SAT',
    riskIfMissing: 'Si es genérico o vacío, el investigador de Chambers no puede referenciarlo en entrevistas ni cotejarlo con el mercado.'
  },
  client: {
    title: 'Cliente Corporativo (Client Name)',
    field: 'client',
    whyChambersNeedsIt: 'Chambers evalúa el calibre y sofisticación de la cartera. Los clientes acreditados respaldan el posicionamiento de la firma.',
    example: 'Blackstone Real Estate, Walmart de México, o "Fondo multinacional de infraestructura (Confidencial)"',
    riskIfMissing: 'Asuntos sin cliente identificado reciben un puntaje de credibilidad drásticamente menor ante el comité editorial.'
  },
  value: {
    title: 'Monto o Escala Económica (Deal Value)',
    field: 'value',
    whyChambersNeedsIt: 'Acredita la escala transaccional y el riesgo financiero asumido. Permite distinguir mandatos rutinarios de trabajo Tier 1.',
    example: 'USD 350M, MXN 1,200 millones, o métricas de impacto: 12 plantas industriales, 4,500 empleados protegidos',
    riskIfMissing: 'Omitir montos sitúa el caso en bandas inferiores (Band 3 o 4) al no poder cuantificar la relevancia del despacho.'
  },
  leadPartner: {
    title: 'Socio Líder Responsable (Lead Partner)',
    field: 'leadPartner',
    whyChambersNeedsIt: 'Chambers vincula el éxito de los asuntos con las tablas de abogados individuales (Band 1, Leading Individuals, Up and Coming).',
    example: 'Alejandro Ramos, María Morales, Roberto Bustamante',
    riskIfMissing: 'Sin socio responsable, el despacho no puede acreditar el caso para promover a sus socios en los rankings individuales.'
  },
  crossBorder: {
    title: 'Jurisdicciones Transfronterizas (Cross-Border)',
    field: 'crossBorder',
    whyChambersNeedsIt: 'Los componentes multijurisdiccionales multiplican el peso editorial tanto en Chambers Global como en guías regionales.',
    example: 'México, Estados Unidos (Delaware/NY) y España',
    riskIfMissing: 'Se evalúa únicamente como trabajo local doméstico, perdiendo puntos de sofisticación internacional.'
  },
  rawNotes: {
    title: 'Descripción Factual y Reto Jurídico (3 Párrafos Orgánicos)',
    field: 'rawNotes',
    whyChambersNeedsIt: 'La base fáctica para que RankPilot construya los 3 párrafos del estándar Chambers: (1) Hechos y Escala → (2) Reto Jurídico/Estrategia → (3) Resultado y Precedente.',
    example: 'Representamos a X en la reestructuración de pasivos por USD 80M ante un consorcio bancario. El principal reto fue homologar garantías fiduciarias ante cambios regulatorios. Concluimos el cierre sin contingencias fiscales en junio de 2026.',
    riskIfMissing: 'Descripciones de una sola frase o sin hechos impiden generar la narrativa requerida y provocan observaciones de los editores.'
  }
};

export default function SubmissionBuilderPage() {
  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Cargando Builder...</div>}>
      <BuilderContent />
    </Suspense>
  );
}

function BuilderContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const submissionId = searchParams.get('id') || '';
  const [matters, setMatters] = useState<MatterDraft[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [activeHelp, setActiveHelp] = useState<HelpInfo | null>(null);

  const [showAssistantModal, setShowAssistantModal] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  const loadMattersFromDb = async () => {
    if (!submissionId) return;
    setIsLoadingExisting(true);
    const res = await getMattersBySubmission(submissionId);
    if (res.success && res.data && res.data.length > 0) {
      const loaded: MatterDraft[] = res.data.map(m => ({
        id: m.id,
        name: m.name || '',
        client: m.client || '',
        value: m.value || '',
        leadPartner: m.leadPartner || '',
        rawNotes: m.rawNotes || m.optimizedText || '',
        isConfidential: m.isConfidential || false,
        crossBorder: m.crossBorder || '',
        teamMembers: m.teamMembers || '',
        otherFirms: m.otherFirms || '',
        completionDate: m.completionDate || '',
        otherInfo: m.otherInfo || '',
        isNewClient: m.isNewClient || false,
        saved: true,
      }));
      setMatters(loaded);
    }
    setIsLoadingExisting(false);
  };

  useEffect(() => {
    if (!submissionId) {
      router.push('/builder');
      return;
    }
    loadMattersFromDb();
  }, [submissionId]);

  const addMatter = () => {
    setMatters(prev => [...prev, {
      id: `draft-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: '',
      client: '',
      value: '',
      leadPartner: '',
      rawNotes: '',
      isConfidential: false,
      crossBorder: '',
      teamMembers: '',
      otherFirms: '',
      completionDate: '',
      otherInfo: '',
      isNewClient: false,
      saved: false,
    }]);
  };

  const updateMatter = (id: string, field: keyof MatterDraft, value: any) => {
    setMatters(prev => prev.map(m => m.id === id ? { ...m, [field]: value, saved: false } : m));
  };

  const removeMatter = (id: string) => {
    setMatters(prev => prev.filter(m => m.id !== id));
  };

  const saveMatter = async (draft: MatterDraft) => {
    if (!draft.name.trim()) {
      alert('Por favor indica el nombre o descripción del asunto.');
      return;
    }
    setSavingId(draft.id);
    const result = await createMatter({
      submissionId,
      name: draft.name,
      client: draft.client,
      value: draft.value,
      leadPartner: draft.leadPartner,
      rawNotes: draft.rawNotes,
      isConfidential: draft.isConfidential,
      crossBorder: draft.crossBorder,
      teamMembers: draft.teamMembers,
      otherFirms: draft.otherFirms,
      completionDate: draft.completionDate,
      otherInfo: draft.otherInfo,
      isNewClient: draft.isNewClient,
    });
    if (result.success) {
      setMatters(prev => prev.map(m => m.id === draft.id ? { ...m, saved: true } : m));
    } else {
      alert('Error guardando asunto: ' + result.error);
    }
    setSavingId(null);
  };

  const saveAllAndProcess = async () => {
    const unsaved = matters.filter(m => !m.saved && m.name.trim());
    if (unsaved.length === 0 && matters.filter(m => m.saved).length === 0) {
      alert('Por favor agrega y guarda al menos un asunto antes de continuar.');
      return;
    }
    setSavingAll(true);
    for (const draft of unsaved) {
      await saveMatter(draft);
    }
    // Redirect directly to Submission Studio
    router.push(`/reports/${submissionId}`);
  };

  // Calculations for Evidence Readiness Progress
  const readyMattersCount = matters.filter(m => {
    const hasName = Boolean(m.name.trim());
    const hasClient = Boolean(m.client.trim() || m.isConfidential);
    const hasLead = Boolean(m.leadPartner.trim());
    const hasNotes = Boolean(m.rawNotes.trim().length >= 60);
    return hasName && hasClient && hasLead && hasNotes;
  }).length;

  const totalMatters = matters.length;
  const recommendedBenchmark = 10;
  const progressPercent = Math.min(100, Math.round((readyMattersCount / recommendedBenchmark) * 100));

  // Shared input style
  const inputStyle = (disabled: boolean) => ({
    padding: '0.6rem 0.75rem',
    borderRadius: '7px',
    border: '1px solid #CBD5E1',
    fontSize: '0.875rem',
    background: disabled ? '#F8FAFC' : '#FFFFFF',
    width: '100%',
    color: '#0F172A',
    outline: 'none',
    transition: 'border-color 0.15s ease'
  });

  return (
    <div style={{ maxWidth: '940px', paddingBottom: '5rem' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <FileText size={26} style={{ color: '#2563EB' }} /> Creador de Submission
            </h1>
            <p style={{ fontSize: '0.9rem', color: '#64748B', marginTop: '0.35rem', margin: 0 }}>
              Ingresa los asuntos de la firma con los campos oficiales requeridos por Chambers and Partners & The Legal 500.
            </p>
          </div>
          
          <button
            onClick={() => router.push(`/reports/${submissionId}`)}
            style={{
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              color: '#475569',
              padding: '0.5rem 0.9rem',
              borderRadius: '7px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Bookmark size={14} /> Ir a Submission Studio
          </button>
        </div>

        {/* Live Submission Maturity Bar */}
        <div style={{
          marginTop: '1.25rem',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                background: progressPercent >= 80 ? '#DCFCE7' : progressPercent >= 50 ? '#FEF3C7' : '#FEE2E2',
                color: progressPercent >= 80 ? '#15803D' : progressPercent >= 50 ? '#B45309' : '#DC2626',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                {readyMattersCount} de {recommendedBenchmark} Asuntos Mínimos
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                Preparación de Evidencia ({totalMatters} cargados)
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
              Meta editorial: 10 a 20 asuntos
            </span>
          </div>

          {/* Progress Track */}
          <div style={{ width: '100%', height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: progressPercent >= 80 ? '#10B981' : progressPercent >= 50 ? '#F59E0B' : '#EF4444',
              transition: 'width 0.3s ease'
            }} />
          </div>

          <p style={{ fontSize: '0.73rem', color: '#64748B', margin: '0.5rem 0 0 0', lineHeight: 1.45 }}>
            💡 <strong>Regla Chambers:</strong> Los investigadores editoriales desestiman postulaciones con menos de 10 mandatos al no poder calibrar la profundidad de la práctica. Puedes guardar como borrador y continuar cuando consigas los datos con tus socios.
          </p>
        </div>
      </div>

      {/* Empty State Banner (If 0 matters) */}
      {matters.length === 0 && !isLoadingExisting && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1.5px dashed #CBD5E1',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '12px',
            background: '#EEF2FF',
            color: '#4F46E5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto'
          }}>
            <BookOpen size={26} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.4rem 0' }}>
            Este submission no tiene asuntos registrados aún
          </h3>
          <p style={{ fontSize: '0.86rem', color: '#64748B', maxWidth: '540px', margin: '0 auto 1.5rem auto', lineHeight: 1.55 }}>
            Puedes importar casos ya redactados o extraídos en tu <strong>Matter Assistant</strong> con un solo clic, o comenzar a capturar los asuntos de la firma manualmente uno por uno.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowAssistantModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.35rem',
                background: '#4F46E5',
                color: '#FFFFFF',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.88rem',
                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)'
              }}
            >
              <BookOpen size={16} /> Importar desde Matter Assistant
            </button>
            <button
              onClick={addMatter}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.35rem',
                background: '#F1F5F9',
                color: '#334155',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem'
              }}
            >
              <Plus size={16} /> Agregar Asunto Manualmente
            </button>
          </div>
        </div>
      )}

      {/* Matter Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        {matters.map((m, idx) => {
          const hasName = Boolean(m.name.trim());
          const hasClient = Boolean(m.client.trim() || m.isConfidential);
          const hasLead = Boolean(m.leadPartner.trim());
          const hasNotes = Boolean(m.rawNotes.trim().length >= 60);
          const missingCount = (!hasName ? 1 : 0) + (!hasClient ? 1 : 0) + (!hasLead ? 1 : 0) + (!hasNotes ? 1 : 0);
          const isCardReady = missingCount === 0;

          return (
            <div
              key={m.id}
              style={{
                background: m.saved ? '#F0FDF4' : '#FFFFFF',
                border: m.saved ? '1px solid #BBF7D0' : isCardReady ? '1px solid #CBD5E1' : '1px solid #FDE68A',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.2s',
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                    Asunto #{idx + 1}
                  </h3>
                  
                  {/* Status Badge */}
                  {isCardReady ? (
                    <span style={{ fontSize: '0.72rem', background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle2 size={12} /> Listo para Optimizar
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', background: '#FEF3C7', color: '#B45309', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <AlertTriangle size={12} /> Faltan {missingCount} campos clave
                    </span>
                  )}

                  {m.saved && (
                    <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 600 }}>
                      ✓ Guardado
                    </span>
                  )}

                  {m.isConfidential && (
                    <span style={{ fontSize: '0.7rem', background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: '9999px', fontWeight: 700 }}>
                      <Shield size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />CONFIDENCIAL (SECCIÓN E)
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {/* Confidential Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: m.isConfidential ? '#92400E' : '#64748B', fontWeight: 600, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={m.isConfidential}
                      onChange={e => updateMatter(m.id, 'isConfidential', e.target.checked)}
                      disabled={m.saved}
                      style={{ accentColor: '#F59E0B' }}
                    />
                    Confidencial (Sección E)
                  </label>

                  {!m.saved && (
                    <button
                      onClick={() => saveMatter(m)}
                      disabled={savingId === m.id}
                      style={{
                        padding: '0.38rem 0.75rem',
                        background: '#2563EB',
                        color: '#FFFFFF',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        opacity: savingId === m.id ? 0.6 : 1
                      }}
                    >
                      {savingId === m.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      {savingId === m.id ? 'Guardando...' : 'Guardar'}
                    </button>
                  )}

                  <button
                    onClick={() => removeMatter(m.id)}
                    style={{ padding: '0.38rem', background: '#FEE2E2', color: '#DC2626', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                    title="Eliminar Asunto"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Row 1: Core Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                {/* Matter Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Nombre del Asunto
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#FEE2E2', color: '#DC2626', padding: '1px 5px', borderRadius: '3px' }}>
                        OBLIGATORIO
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveHelp(FIELD_HELP_DATA.name)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px' }}
                      title="Ver qué espera Chambers en este campo"
                    >
                      <HelpCircle size={13} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={m.name}
                    onChange={e => updateMatter(m.id, 'name', e.target.value)}
                    placeholder="Ej. Adquisición Transfronteriza de TechCorp por USD 150M"
                    disabled={m.saved}
                    style={inputStyle(m.saved)}
                  />
                </div>

                {/* Client */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Cliente Corporativo
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#FEE2E2', color: '#DC2626', padding: '1px 5px', borderRadius: '3px' }}>
                        OBLIGATORIO
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveHelp(FIELD_HELP_DATA.client)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px' }}
                      title="Ver qué espera Chambers en este campo"
                    >
                      <HelpCircle size={13} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={m.client}
                      onChange={e => updateMatter(m.id, 'client', e.target.value)}
                      placeholder={m.isConfidential ? "Ej. Fondo Líder de Infraestructura (Confidencial)" : "Ej. JP Morgan Chase / Walmart de México"}
                      disabled={m.saved}
                      style={{ ...inputStyle(m.saved), flex: 1 }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={m.isNewClient} onChange={e => updateMatter(m.id, 'isNewClient', e.target.checked)} disabled={m.saved} />
                      Nuevo
                    </label>
                  </div>
                </div>

                {/* Value */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Monto / Escala Económica
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, background: '#FEF3C7', color: '#B45309', padding: '1px 5px', borderRadius: '3px' }}>
                        RECOMENDADO TIER 1
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveHelp(FIELD_HELP_DATA.value)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px' }}
                      title="Ver qué espera Chambers en este campo"
                    >
                      <HelpCircle size={13} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={m.value}
                    onChange={e => updateMatter(m.id, 'value', e.target.value)}
                    placeholder="Ej. USD 150M o 4,500 empleados / 15 parques industriales"
                    disabled={m.saved}
                    style={inputStyle(m.saved)}
                  />
                </div>

                {/* Lead Partner */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Socio Líder Responsable
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#FEE2E2', color: '#DC2626', padding: '1px 5px', borderRadius: '3px' }}>
                        OBLIGATORIO
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveHelp(FIELD_HELP_DATA.leadPartner)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px' }}
                      title="Ver qué espera Chambers en este campo"
                    >
                      <HelpCircle size={13} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={m.leadPartner}
                    onChange={e => updateMatter(m.id, 'leadPartner', e.target.value)}
                    placeholder="Ej. Carlos Pérez (Socio Director)"
                    disabled={m.saved}
                    style={inputStyle(m.saved)}
                  />
                </div>
              </div>

              {/* Row 2: Extended Chambers Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                {/* Jurisdictions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Globe size={11} style={{ verticalAlign: 'middle' }} /> Jurisdicciones
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveHelp(FIELD_HELP_DATA.crossBorder)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px' }}
                    >
                      <HelpCircle size={13} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={m.crossBorder}
                    onChange={e => updateMatter(m.id, 'crossBorder', e.target.value)}
                    placeholder="Ej. México, USA, España"
                    disabled={m.saved}
                    style={inputStyle(m.saved)}
                  />
                </div>

                {/* Team Members */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Otros Abogados Clave
                  </label>
                  <input
                    type="text"
                    value={m.teamMembers}
                    onChange={e => updateMatter(m.id, 'teamMembers', e.target.value)}
                    placeholder="Ej. Ana López (Asociada Senior), Juan Díaz"
                    disabled={m.saved}
                    style={inputStyle(m.saved)}
                  />
                </div>

                {/* Other Firms */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Otras Firmas Asesorando
                  </label>
                  <input
                    type="text"
                    value={m.otherFirms}
                    onChange={e => updateMatter(m.id, 'otherFirms', e.target.value)}
                    placeholder="Ej. Simpson Thacher (NY counsel)"
                    disabled={m.saved}
                    style={inputStyle(m.saved)}
                  />
                </div>
              </div>

              {/* Row 3: Completion + Press */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Fecha de Conclusión / Estado
                  </label>
                  <input
                    type="text"
                    value={m.completionDate}
                    onChange={e => updateMatter(m.id, 'completionDate', e.target.value)}
                    placeholder="Ej. Concluido en junio 2026 / En litigio activo"
                    disabled={m.saved}
                    style={inputStyle(m.saved)}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Enlaces de Prensa o Cobertura (Opcional)
                  </label>
                  <input
                    type="text"
                    value={m.otherInfo}
                    onChange={e => updateMatter(m.id, 'otherInfo', e.target.value)}
                    placeholder="Ej. Publicado en Latin Lawyer o El Economista: https://..."
                    disabled={m.saved}
                    style={inputStyle(m.saved)}
                  />
                </div>
              </div>

              {/* Raw Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Descripción Factual del Mandato
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#FEE2E2', color: '#DC2626', padding: '1px 5px', borderRadius: '3px' }}>
                      OBLIGATORIO
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveHelp(FIELD_HELP_DATA.rawNotes)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px' }}
                    title="Ver qué espera Chambers en este campo"
                  >
                    <HelpCircle size={13} />
                  </button>
                </div>
                <textarea
                  value={m.rawNotes}
                  onChange={e => updateMatter(m.id, 'rawNotes', e.target.value)}
                  placeholder="Describe los hechos clave del caso: (1) Escala y qué se negoció, (2) Reto jurídico o contraparte difícil, (3) Resultado obtenido o valor para el cliente. La IA de RankPilot lo transformará en prosa orgánica de 3 párrafos..."
                  disabled={m.saved}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '7px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.875rem',
                    minHeight: '110px',
                    resize: 'vertical',
                    lineHeight: 1.55,
                    background: m.saved ? '#F8FAFC' : '#FFFFFF',
                    fontFamily: 'inherit',
                    width: '100%',
                    color: '#0F172A',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: m.rawNotes.trim().length >= 60 ? '#16A34A' : '#94A3B8' }}>
                  {m.rawNotes.trim().length} caracteres (mínimo sugerido: 80 caracteres con hechos concretos)
                </span>
              </div>

            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={addMatter}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.4rem',
              background: '#F1F5F9',
              color: '#334155',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.88rem'
            }}
          >
            <Plus size={16} /> Agregar Otro Asunto
          </button>

          <button
            onClick={() => setShowAssistantModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.4rem',
              background: '#EEF2FF',
              color: '#4F46E5',
              borderRadius: '8px',
              border: '1px solid #C7D2FE',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.88rem'
            }}
          >
            <BookOpen size={16} /> Importar desde Matter Assistant
          </button>
        </div>

        <button
          onClick={saveAllAndProcess}
          disabled={savingAll || matters.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.8rem',
            background: savingAll ? '#94A3B8' : 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%)',
            color: '#FFFFFF',
            borderRadius: '8px',
            border: 'none',
            cursor: savingAll ? 'wait' : 'pointer',
            fontWeight: 700,
            fontSize: '0.92rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.12)'
          }}
        >
          {savingAll ? (
            <><Loader2 size={16} className="animate-spin" /> Guardando Asuntos...</>
          ) : (
            <><Sparkles size={16} /> Guardar y Abrir en Submission Studio <ArrowRight size={15} /></>
          )}
        </button>
      </div>

      {/* ═══ INTERACTIVE CHAMBERS GUIDANCE MODAL ═══ */}
      {activeHelp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F8FAFC'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HelpCircle size={18} color="#2563EB" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  {activeHelp.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveHelp(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 0.25rem 0' }}>
                  ¿Por qué lo exige Chambers & The Legal 500?
                </h4>
                <p style={{ fontSize: '0.85rem', color: '#1E293B', margin: 0, lineHeight: 1.5 }}>
                  {activeHelp.whyChambersNeedsIt}
                </p>
              </div>

              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803D', textTransform: 'uppercase', margin: '0 0 0.25rem 0' }}>
                  Ejemplo Recomendado:
                </h4>
                <p style={{ fontSize: '0.82rem', color: '#14532D', margin: 0, fontStyle: 'italic', lineHeight: 1.45 }}>
                  "{activeHelp.example}"
                </p>
              </div>

              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B91C1C', textTransform: 'uppercase', margin: '0 0 0.25rem 0' }}>
                  Riesgo Editorial si se omite:
                </h4>
                <p style={{ fontSize: '0.82rem', color: '#991B1B', margin: 0, lineHeight: 1.45 }}>
                  {activeHelp.riskIfMissing}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', textAlign: 'right' }}>
              <button
                onClick={() => setActiveHelp(null)}
                style={{
                  background: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ IMPORT FROM MATTER ASSISTANT MODAL ═══ */}
      <ImportFromAssistantModal
        isOpen={showAssistantModal}
        onClose={() => setShowAssistantModal(false)}
        submissionId={submissionId}
        onMattersImported={async () => {
          await loadMattersFromDb();
        }}
      />

      <style dangerouslySetInnerHTML={{__html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
