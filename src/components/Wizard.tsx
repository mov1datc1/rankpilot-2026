'use client';

import { useState, useTransition, useEffect } from 'react';
import { submitWizardData } from '@/app/actions/submitWizard';

const STEPS = [
  { id: 1, title: 'Preliminar' },
  { id: 2, title: 'Departamento' },
  { id: 3, title: 'Fortalezas' },
  { id: 4, title: 'Feedback' },
  { id: 5, title: 'Casos' },
  { id: 6, title: 'Matters' }
];

import { getAllUserMatters } from '@/app/actions/matters';

export default function Wizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; pdf_url?: string; submissionId?: string; error?: string } | null>(null);
  const [userMatters, setUserMatters] = useState<any[]>([]);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1
    firmName: '',
    jurisdiction: '',
    practice: '',
    period: '',
    // Step 2
    departmentDesc: '',
    teamSize: '',
    specialties: '',
    // Step 3
    keyAchievements: '',
    relevantCases: '',
    differentiators: '',
    // Step 4
    feedback: '',
    strategicFocus: '',
    // Step 5
    clients: '',
    caseDescriptions: '',
    // Step 6
    associatedMatterIds: [] as string[]
  });

  useEffect(() => {
    async function load() {
      const res = await getAllUserMatters();
      if (res.success && res.data) {
        setUserMatters(res.data);
      }
    }
    load();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const nextStep = () => {
    if (currentStep === 1 && !isAdvancedMode) {
      setCurrentStep(6);
    } else if (currentStep < 6) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep === 6 && !isAdvancedMode) {
      setCurrentStep(1);
    } else if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await submitWizardData(formData);
      if (res.success) {
        setResult({ success: true, pdf_url: res.data?.data?.pdf_url, submissionId: res.submissionId });
      } else {
        setResult({ success: false, error: res.error });
      }
    });
  };

  if (result?.success) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '600px', width: '100%', margin: '0 auto', textAlign: 'center', background: '#ffffff', borderRadius: '16px', padding: '3rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', border: '1px solid #e2e8f0' }}>
        <div style={{ width: '64px', height: '64px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', color: '#15803d' }}>¡Submission Generada Exitosamente!</h2>
        <p style={{ color: '#475569', marginBottom: '2rem' }}>La Inteligencia Artificial ha procesado tu información y ha redactado el documento.</p>
        {result.submissionId ? (
          <a href={`/reports/${result.submissionId}`} style={{ display: 'inline-block', background: '#2563eb', color: '#fff', padding: '0.75rem 2rem', borderRadius: '8px', fontWeight: 500, textDecoration: 'none', transition: 'background 0.2s' }}>
            Ver Auditoría Estratégica
          </a>
        ) : (
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>El archivo PDF se está compilando en los servidores. Recibirás una notificación cuando esté listo.</p>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', width: '100%', margin: '0 auto', background: '#ffffff', borderRadius: '16px', padding: '3rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', border: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '2.5rem', color: '#0f172a' }}>Nueva Submission Legal</h2>
      
      {/* Stepper */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '2px', background: '#e2e8f0', transform: 'translateY(-50%)', zIndex: 1 }}></div>
        {STEPS.filter(step => isAdvancedMode || step.id === 1 || step.id === 6).map((step) => (
          <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, background: '#ffffff', padding: '0 0.5rem' }}>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.2s',
              background: currentStep > step.id ? '#2563eb' : currentStep === step.id ? '#eff6ff' : '#f1f5f9',
              color: currentStep > step.id ? '#ffffff' : currentStep === step.id ? '#2563eb' : '#94a3b8',
              border: currentStep === step.id ? '2px solid #2563eb' : '2px solid transparent'
            }}>
              {currentStep > step.id ? '✓' : step.id}
            </div>
            <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: currentStep >= step.id ? '#334155' : '#94a3b8', fontWeight: currentStep >= step.id ? 500 : 400 }}>{step.title}</span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1 */}
        {currentStep === 1 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1.5rem', color: '#334155', fontSize: '1.25rem', fontWeight: 600 }}>1. Información Preliminar</h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Nombre de la Firma</label>
              <input type="text" name="firmName" value={formData.firmName} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem', transition: 'border-color 0.2s' }} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Jurisdicción</label>
              <input type="text" name="jurisdiction" value={formData.jurisdiction} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem', transition: 'border-color 0.2s' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Práctica / Área</label>
                <input type="text" name="practice" value={formData.practice} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem', transition: 'border-color 0.2s' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Periodo (Ej. 2025-2026)</label>
                <input type="text" name="period" value={formData.period} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem', transition: 'border-color 0.2s' }} />
              </div>
            </div>
            
            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.95rem' }}>Modo Avanzado (Formulario Completo Chambers)</strong>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Si se desactiva, saltarás directo a la selección de matters.</span>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                <input type="checkbox" checked={isAdvancedMode} onChange={(e) => setIsAdvancedMode(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isAdvancedMode ? '#2563eb' : '#cbd5e1', transition: '.4s', borderRadius: '24px' }}>
                  <span style={{ position: 'absolute', content: '""', height: '18px', width: '18px', left: isAdvancedMode ? '22px' : '3px', bottom: '3px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%' }}></span>
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {currentStep === 2 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1.5rem', color: '#334155', fontSize: '1.25rem', fontWeight: 600 }}>2. Detalles del Departamento</h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Descripción General</label>
              <textarea name="departmentDesc" value={formData.departmentDesc} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem', minHeight: '120px', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Tamaño del Equipo</label>
                <input type="text" name="teamSize" value={formData.teamSize} onChange={handleChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Áreas de Especialidad</label>
                <input type="text" name="specialties" value={formData.specialties} onChange={handleChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem' }} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {currentStep === 3 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1.5rem', color: '#334155', fontSize: '1.25rem', fontWeight: 600 }}>3. Fortalezas Destacadas</h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Logros Clave</label>
              <textarea name="keyAchievements" value={formData.keyAchievements} onChange={handleChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem', minHeight: '100px', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Casos Relevantes del Año</label>
              <textarea name="relevantCases" value={formData.relevantCases} onChange={handleChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem', minHeight: '100px', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Diferenciadores en el Mercado</label>
              <textarea name="differentiators" value={formData.differentiators} onChange={handleChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem', minHeight: '100px', resize: 'vertical' }} />
            </div>
          </div>
        )}

        {/* Step 4 */}
        {currentStep === 4 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1.5rem', color: '#334155', fontSize: '1.25rem', fontWeight: 600 }}>4. Feedback y Contexto Estratégico</h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Retroalimentación de Clientes</label>
              <textarea name="feedback" value={formData.feedback} onChange={handleChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem', minHeight: '100px', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Enfoque Estratégico a Futuro</label>
              <textarea name="strategicFocus" value={formData.strategicFocus} onChange={handleChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem', minHeight: '100px', resize: 'vertical' }} />
            </div>
          </div>
        )}

        {/* Step 5 */}
        {currentStep === 5 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1.5rem', color: '#334155', fontSize: '1.25rem', fontWeight: 600 }}>5. Clientes y Casos Representativos</h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Listado de Clientes</label>
              <textarea name="clients" value={formData.clients} onChange={handleChange} placeholder="Ej: Empresa A, Startup B..." style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem', minHeight: '100px', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Descripción Breve de los Casos Asociados</label>
              <textarea name="caseDescriptions" value={formData.caseDescriptions} onChange={handleChange} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '1rem', minHeight: '100px', resize: 'vertical' }} />
            </div>
          </div>
        )}

        {/* Step 6 */}
        {currentStep === 6 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1.5rem', color: '#334155', fontSize: '1.25rem', fontWeight: 600 }}>6. Asociar Matters Existentes</h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Opcional: Selecciona matters que ya tengas en tu repositorio para incluirlos automáticamente en esta submission.
            </p>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', background: '#f8fafc' }}>
              {userMatters.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', margin: '2rem 0' }}>No tienes matters guardados en tu repositorio.</p>
              ) : (
                userMatters.map(m => (
                  <label key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', background: formData.associatedMatterIds.includes(m.id) ? '#eff6ff' : '#ffffff', borderRadius: '4px', marginBottom: '0.5rem', transition: 'background 0.2s' }}>
                    <input 
                      type="checkbox" 
                      checked={formData.associatedMatterIds.includes(m.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({ ...prev, associatedMatterIds: [...prev.associatedMatterIds, m.id] }));
                        } else {
                          setFormData(prev => ({ ...prev, associatedMatterIds: prev.associatedMatterIds.filter(id => id !== m.id) }));
                        }
                      }}
                      style={{ marginTop: '0.25rem', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{m.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Cliente: {m.client} | Valor: {m.value}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <button type="button" onClick={prevStep} style={{ visibility: currentStep === 1 ? 'hidden' : 'visible', padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#f1f5f9', color: '#475569', fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'background 0.2s' }} disabled={isPending}>
            Atrás
          </button>
          
          {currentStep < 6 ? (
            <button type="button" onClick={nextStep} disabled={isPending} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#2563eb', color: '#ffffff', fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}>
              Siguiente Paso
            </button>
          ) : (
            <button type="submit" style={{ padding: '0.75rem 2rem', borderRadius: '8px', background: '#2563eb', color: '#ffffff', fontWeight: 600, border: 'none', cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.7 : 1, transition: 'all 0.2s' }} disabled={isPending}>
              {isPending ? 'Procesando con IA...' : 'Completar y Generar'}
            </button>
          )}
        </div>
        
        {result?.error && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', textAlign: 'center', fontSize: '0.9rem' }}>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Error de Conexión</strong>
            {result.error}
          </div>
        )}
      </form>
    </div>
  );
}
