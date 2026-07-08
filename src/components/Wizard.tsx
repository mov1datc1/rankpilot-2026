'use client';

import { useState } from 'react';

const STEPS = [
  { id: 1, title: 'Preliminar' },
  { id: 2, title: 'Departamento' },
  { id: 3, title: 'Fortalezas' },
  { id: 4, title: 'Feedback' },
  { id: 5, title: 'Casos' }
];

export default function Wizard() {
  const [currentStep, setCurrentStep] = useState(1);
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
    console.log('Formulario enviado:', formData);
    // Here we will call the Python API later
    alert('Submission preparada para IA (Mock)');
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '800px', width: '100%', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '2rem' }}>Nueva Submission Legal</h2>
      
      {/* Stepper */}
      <div className="stepper">
        {STEPS.map((step) => (
          <div 
            key={step.id} 
            className={`step-indicator ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
            title={step.title}
          >
            {currentStep > step.id ? '✓' : step.id}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1 */}
        {currentStep === 1 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>1. Información Preliminar</h3>
            <div className="form-group">
              <label className="form-label">Nombre de la Firma</label>
              <input type="text" name="firmName" className="form-input" value={formData.firmName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Jurisdicción</label>
              <input type="text" name="jurisdiction" className="form-input" value={formData.jurisdiction} onChange={handleChange} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Práctica / Área</label>
                <input type="text" name="practice" className="form-input" value={formData.practice} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Periodo (Ej. 2025-2026)</label>
                <input type="text" name="period" className="form-input" value={formData.period} onChange={handleChange} required />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {currentStep === 2 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>2. Detalles del Departamento</h3>
            <div className="form-group">
              <label className="form-label">Descripción General</label>
              <textarea name="departmentDesc" className="form-textarea" value={formData.departmentDesc} onChange={handleChange} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Tamaño del Equipo</label>
                <input type="text" name="teamSize" className="form-input" value={formData.teamSize} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Áreas de Especialidad</label>
                <input type="text" name="specialties" className="form-input" value={formData.specialties} onChange={handleChange} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {currentStep === 3 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>3. Fortalezas Destacadas</h3>
            <div className="form-group">
              <label className="form-label">Logros Clave</label>
              <textarea name="keyAchievements" className="form-textarea" value={formData.keyAchievements} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Casos Relevantes del Año</label>
              <textarea name="relevantCases" className="form-textarea" value={formData.relevantCases} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Diferenciadores en el Mercado</label>
              <textarea name="differentiators" className="form-textarea" value={formData.differentiators} onChange={handleChange} />
            </div>
          </div>
        )}

        {/* Step 4 */}
        {currentStep === 4 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>4. Feedback y Contexto Estratégico</h3>
            <div className="form-group">
              <label className="form-label">Retroalimentación de Clientes</label>
              <textarea name="feedback" className="form-textarea" value={formData.feedback} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Enfoque Estratégico a Futuro</label>
              <textarea name="strategicFocus" className="form-textarea" value={formData.strategicFocus} onChange={handleChange} />
            </div>
          </div>
        )}

        {/* Step 5 */}
        {currentStep === 5 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>5. Clientes y Casos Representativos</h3>
            <div className="form-group">
              <label className="form-label">Listado de Clientes</label>
              <textarea name="clients" className="form-textarea" value={formData.clients} onChange={handleChange} placeholder="Ej: Empresa A, Startup B..." />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción Breve de los Casos Asociados</label>
              <textarea name="caseDescriptions" className="form-textarea" value={formData.caseDescriptions} onChange={handleChange} />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" className="btn-secondary" onClick={prevStep} style={{ visibility: currentStep === 1 ? 'hidden' : 'visible' }}>
            Atrás
          </button>
          
          {currentStep < 5 ? (
            <button type="button" className="btn-primary" onClick={nextStep}>
              Siguiente Paso
            </button>
          ) : (
            <button type="submit" className="btn-primary" style={{ background: 'var(--accent-primary)', color: '#fff' }}>
              Completar y Generar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
