'use client';

import { useState, useTransition } from 'react';
import { submitWizardData } from '@/app/actions/submitWizard';

const STEPS = [
  { id: 1, title: 'Preliminar' },
  { id: 2, title: 'Departamento' },
  { id: 3, title: 'Fortalezas' },
  { id: 4, title: 'Feedback' },
  { id: 5, title: 'Casos' }
];

export default function Wizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; pdf_url?: string; error?: string } | null>(null);
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
    caseDescriptions: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await submitWizardData(formData);
      if (res.success) {
        setResult({ success: true, pdf_url: res.data?.data?.pdf_url });
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
        {result.pdf_url ? (
          <a href={result.pdf_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#2563eb', color: '#fff', padding: '0.75rem 2rem', borderRadius: '8px', fontWeight: 500, textDecoration: 'none', transition: 'background 0.2s' }}>
            Descargar Reporte (PDF)
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
        {STEPS.map((step) => (
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

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <button type="button" onClick={prevStep} style={{ visibility: currentStep === 1 ? 'hidden' : 'visible', padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#f1f5f9', color: '#475569', fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'background 0.2s' }} disabled={isPending}>
            Atrás
          </button>
          
          {currentStep < 5 ? (
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
