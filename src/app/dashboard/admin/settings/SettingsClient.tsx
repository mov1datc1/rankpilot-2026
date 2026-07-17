'use client';

import { useState } from 'react';
import { Key, Mail, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { saveResendConfig } from '@/app/actions/smtp';

interface SettingsClientProps {
  initialApiKey: string;
  initialFromEmail: string;
}

export default function SettingsClient({ initialApiKey, initialFromEmail }: SettingsClientProps) {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [fromEmail, setFromEmail] = useState(initialFromEmail || 'noreply@rankpilot.io');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    const result = await saveResendConfig(apiKey, fromEmail);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Configuración de Resend guardada exitosamente.' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Error al guardar.' });
    }
    setIsSaving(false);
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.4)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '16px',
      padding: '2rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '250px' }}>
          <h3 style={{
            fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc',
            display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem',
          }}>
            <Mail size={20} color="#38bdf8" />
            Configuración de Resend
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5 }}>
            Configura la API Key y el correo remitente para los correos transaccionales automatizados.
          </p>
          
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '10px',
          }}>
            <p style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
              ¿Cómo obtener una API Key?
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5 }}>
              Regístrate en <a href="https://resend.com" target="_blank" style={{ color: '#38bdf8', textDecoration: 'underline' }}>resend.com</a>, verifica tu dominio y genera una API Key desde el dashboard.
            </p>
          </div>
        </div>

        <div style={{ flex: '1.5', minWidth: '300px' }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '1.5rem',
          }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>
                <Key size={14} style={{ marginRight: '0.25rem' }} />
                RESEND_API_KEY
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                style={fieldInputStyle}
                onFocus={(e) => e.target.style.borderColor = '#38bdf8'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Correo Remitente (From)</label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@rankpilot.io"
                style={fieldInputStyle}
                onFocus={(e) => e.target.style.borderColor = '#38bdf8'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.05)',
              marginTop: '0.5rem',
              paddingTop: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                {message && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    fontSize: '0.85rem',
                    color: message.type === 'success' ? '#4ade80' : '#f87171',
                  }}>
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {message.text}
                  </div>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving || !apiKey}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.6rem 1.25rem', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
                  color: '#fff', fontWeight: 600, fontSize: '0.85rem',
                  border: 'none', cursor: isSaving ? 'wait' : 'pointer',
                  opacity: (isSaving || !apiKey) ? 0.5 : 1,
                  boxShadow: '0 0 15px rgba(56,189,248,0.2)',
                }}
              >
                <Save size={16} />
                {isSaving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: '0.85rem',
  color: '#94a3b8',
  marginBottom: '0.5rem',
  fontWeight: 500,
};

const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.7rem 1rem',
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#f8fafc',
  fontSize: '0.9rem',
  outline: 'none',
  transition: 'border-color 0.2s',
};
