'use client';

import { useState, useEffect } from 'react';
import { Mail, Key, Save, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { getEmailTemplates, saveEmailTemplate, testResendConnection } from '@/app/actions/smtp';

const DEFAULT_WELCOME = `<h1>¡Bienvenido a RankPilot!</h1>\n<p>Hola {{userName}},</p>\n<p>Tu cuenta se ha activado con éxito. Ya tienes acceso a nuestra plataforma de rankings legales impulsada por IA.</p>\n<p><a href="{{dashboardUrl}}">Ir a mi Dashboard</a></p>\n<p>Saludos,<br>Equipo RankPilot</p>`;
const DEFAULT_DUNNING = `<h1>Hubo un problema con tu pago</h1>\n<p>Hola {{userName}},</p>\n<p>No pudimos procesar el último cargo de tu suscripción a <strong>RankPilot</strong>. Para evitar interrupciones, por favor actualiza tu método de pago.</p>\n<p><a href="{{dashboardUrl}}/billing">Actualizar Método de Pago</a></p>\n<p>Saludos,<br>Equipo RankPilot</p>`;
const DEFAULT_REMINDER = `<h1>Tu suscripción de RankPilot está por vencer</h1>\n<p>Hola {{userName}},</p>\n<p>Te recordamos que tu suscripción vence pronto. Para mantener el acceso a todas las funcionalidades, asegúrate de que tu método de pago esté actualizado.</p>\n<p><a href="{{dashboardUrl}}">Ver Mi Cuenta</a></p>\n<p>Saludos,<br>Equipo RankPilot</p>`;

export default function SMTPPage() {
  const [activeTab, setActiveTab] = useState<'WELCOME' | 'DUNNING' | 'REMINDER'>('WELCOME');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Test connection
  const [testEmail, setTestEmail] = useState('');
  const [testFromEmail, setTestFromEmail] = useState('noreply@rankpilot.io');
  const [isTesting, setIsTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [templates, setTemplates] = useState<Record<string, { subject: string; htmlBody: string }>>({
    'WELCOME': { subject: '¡Bienvenido a RankPilot PRO!', htmlBody: DEFAULT_WELCOME },
    'DUNNING': { subject: 'Acción Requerida: Actualiza tu método de pago', htmlBody: DEFAULT_DUNNING },
    'REMINDER': { subject: 'Aviso: Tu suscripción está por vencer', htmlBody: DEFAULT_REMINDER },
  });

  useEffect(() => {
    async function load() {
      const data = await getEmailTemplates();
      const newTemplates = { ...templates };
      data.forEach((t: any) => {
        newTemplates[t.type] = { subject: t.subject, htmlBody: t.htmlBody };
      });
      setTemplates(newTemplates);
      setSubject(newTemplates['WELCOME'].subject);
      setHtmlBody(newTemplates['WELCOME'].htmlBody);
      setIsLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (type: 'WELCOME' | 'DUNNING' | 'REMINDER') => {
    setTemplates(prev => ({ ...prev, [activeTab]: { subject, htmlBody } }));
    setActiveTab(type);
    setSubject(templates[type].subject);
    setHtmlBody(templates[type].htmlBody);
    setMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    const result = await saveEmailTemplate(activeTab, subject, htmlBody);
    if (result.success) {
      setMessage({ type: 'success', text: 'Plantilla guardada exitosamente.' });
      setTemplates(prev => ({ ...prev, [activeTab]: { subject, htmlBody } }));
    } else {
      setMessage({ type: 'error', text: result.error || 'Error al guardar.' });
    }
    setIsSaving(false);
    setTimeout(() => setMessage(null), 4000);
  };

  const handleTestConnection = async () => {
    if (!testEmail || !testFromEmail) return;
    setIsTesting(true);
    setTestMessage(null);
    const result = await testResendConnection(testEmail, testFromEmail);
    if (result.success) {
      setTestMessage({ type: 'success', text: '¡Correo enviado! Revisa tu bandeja. La API está funcionando.' });
    } else {
      setTestMessage({ type: 'error', text: result.error || 'Error al conectar con Resend.' });
    }
    setIsTesting(false);
  };

  if (isLoading) {
    return <div style={{ padding: '2rem', color: '#94a3b8' }}>Cargando plantillas...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Test Connection */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <Key size={20} color="#38bdf8" />
          Validar Conexión con Resend
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Envía un correo de prueba para verificar que la API de Resend está conectada correctamente.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '600px' }}>
          <div>
            <label style={labelStyle}>Correo Remitente (From)</label>
            <input
              type="email" value={testFromEmail}
              onChange={(e) => setTestFromEmail(e.target.value)}
              placeholder="noreply@rankpilot.io"
              style={fieldInputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Enviar Prueba A (To)</label>
            <input
              type="email" value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="tu-correo@gmail.com"
              style={fieldInputStyle}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <div>
            {testMessage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: testMessage.type === 'success' ? '#4ade80' : '#f87171' }}>
                {testMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {testMessage.text}
              </div>
            )}
          </div>
          <button
            onClick={handleTestConnection}
            disabled={isTesting || !testEmail || !testFromEmail}
            style={{
              ...saveButtonStyle,
              background: 'transparent',
              border: '1px solid rgba(56,189,248,0.3)',
              color: '#38bdf8',
              boxShadow: 'none',
              opacity: (isTesting || !testEmail || !testFromEmail) ? 0.5 : 1,
            }}
          >
            <Send size={16} />
            {isTesting ? 'Enviando...' : 'Probar Conexión'}
          </button>
        </div>
      </div>

      {/* Email Templates */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={sectionTitleStyle}>
              <Mail size={20} color="#38bdf8" />
              Plantillas Dinámicas de Correo
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              Personaliza el asunto y HTML de los correos automáticos.
            </p>
          </div>
          <div style={{ display: 'flex', background: 'rgba(15,23,42,0.6)', padding: '0.3rem', borderRadius: '10px' }}>
            {[
              { key: 'WELCOME' as const, label: 'Bienvenida' },
              { key: 'DUNNING' as const, label: 'Fallo de Pago' },
              { key: 'REMINDER' as const, label: 'Recordatorio' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                style={{
                  padding: '0.5rem 1rem', borderRadius: '8px',
                  fontSize: '0.85rem', fontWeight: activeTab === t.key ? 600 : 500,
                  background: activeTab === t.key ? 'rgba(56,189,248,0.1)' : 'transparent',
                  color: activeTab === t.key ? '#38bdf8' : '#94a3b8',
                  border: activeTab === t.key ? '1px solid rgba(56,189,248,0.3)' : '1px solid transparent',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Variables Legend */}
        <div style={{
          padding: '1rem', marginBottom: '1.25rem',
          background: 'rgba(56, 189, 248, 0.05)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: '10px',
        }}>
          <p style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Variables Dinámicas Disponibles:</p>
          <ul style={{ color: '#94a3b8', fontSize: '0.8rem', listStyle: 'disc', paddingLeft: '1.25rem', lineHeight: 1.8 }}>
            <li><code style={{ color: '#f8fafc' }}>{'{{userName}}'}</code>: Nombre del usuario</li>
            <li><code style={{ color: '#f8fafc' }}>{'{{dashboardUrl}}'}</code>: URL del dashboard principal</li>
          </ul>
        </div>

        {/* Subject */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>Asunto del Correo (Subject)</label>
          <input
            type="text" value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ej. ¡Bienvenido a RankPilot!"
            style={fieldInputStyle}
          />
        </div>

        {/* HTML Body */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>Cuerpo del Correo (Código HTML)</label>
          <textarea
            rows={12}
            value={htmlBody}
            onChange={(e) => setHtmlBody(e.target.value)}
            placeholder="<h1>Hola {{userName}}</h1>..."
            style={{
              ...fieldInputStyle,
              fontFamily: 'monospace',
              resize: 'vertical',
              minHeight: '200px',
              lineHeight: 1.6,
            }}
          />
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            El texto se enviará interpretado como HTML. Usa etiquetas como &lt;p&gt;, &lt;h1&gt;, &lt;a&gt;, etc.
          </p>
        </div>

        {/* Save */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {message && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: message.type === 'success' ? '#4ade80' : '#f87171' }}>
                {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {message.text}
              </div>
            )}
          </div>
          <button onClick={handleSave} disabled={isSaving || !subject || !htmlBody} style={{ ...saveButtonStyle, opacity: (isSaving || !subject || !htmlBody) ? 0.5 : 1 }}>
            <Save size={16} />
            {isSaving ? 'Guardando...' : 'Guardar Plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.4)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: '16px', padding: '2rem',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc',
  display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.85rem', color: '#94a3b8',
  marginBottom: '0.5rem', fontWeight: 500,
};

const fieldInputStyle: React.CSSProperties = {
  width: '100%', padding: '0.7rem 1rem',
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', color: '#f8fafc',
  fontSize: '0.9rem', outline: 'none',
};

const saveButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
  padding: '0.6rem 1.25rem', borderRadius: '8px',
  background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
  color: '#fff', fontWeight: 600, fontSize: '0.85rem',
  border: 'none', cursor: 'pointer',
  boxShadow: '0 0 15px rgba(56,189,248,0.2)',
};
