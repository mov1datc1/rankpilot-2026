import { getSystemConfig } from '@/app/actions/settings';
import SettingsClient from './SettingsClient';
import { CreditCard, ShieldAlert, Key, Mail } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const config = await getSystemConfig();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Stripe Configuration */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '250px' }}>
            <h3 style={sectionTitleStyle}>
              <CreditCard size={20} color="#38bdf8" />
              Pasarela de Pagos (Stripe)
            </h3>
            <p style={sectionDescStyle}>
              Administra las credenciales de facturación y suscripciones automáticas.
            </p>
            
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(250, 204, 21, 0.05)',
              border: '1px solid rgba(250, 204, 21, 0.2)',
              borderRadius: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <ShieldAlert size={18} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Aviso de Seguridad</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5 }}>
                    Para pasar a la cuenta de Stripe de Producción, debes ir a Vercel y actualizar: <code style={{ color: '#38bdf8' }}>STRIPE_SECRET_KEY</code> y <code style={{ color: '#38bdf8' }}>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: '1.5', minWidth: '300px' }}>
            <div style={cardStyle}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Stripe Price ID (Suscripción Base)</label>
                <input
                  type="text"
                  disabled
                  value={process.env.STRIPE_PRICE_ID || ''}
                  placeholder="price_xxxxx (configurar en Vercel)"
                  style={{ ...fieldInputStyle, opacity: 0.7 }}
                />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Stripe Secret Key</label>
                <input
                  type="password"
                  disabled
                  value="••••••••••••••••••••••••••••"
                  style={{ ...fieldInputStyle, opacity: 0.7 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={config.stripeTestMode}
                  disabled
                  style={{ accentColor: '#38bdf8' }}
                />
                <label style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>Forzar Modo de Pruebas (Test Mode)</label>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '1.25rem', paddingTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                <a 
                  href="https://vercel.com" 
                  target="_blank"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.6rem 1.25rem', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
                    color: '#fff', fontWeight: 600, fontSize: '0.85rem',
                    textDecoration: 'none',
                    boxShadow: '0 0 15px rgba(56,189,248,0.2)',
                  }}
                >
                  Ir a Vercel
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resend API Configuration */}
      <SettingsClient 
        initialApiKey={config.resendApiKey || ''} 
        initialFromEmail={config.resendFromEmail || ''} 
      />

      {/* Security Controls */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '250px' }}>
            <h3 style={sectionTitleStyle}>
              <ShieldAlert size={20} color="#38bdf8" />
              Control de Seguridad
            </h3>
            <p style={sectionDescStyle}>
              Ajusta las políticas de seguridad y mantenimiento del SaaS.
            </p>
          </div>
          <div style={{ flex: '1.5', minWidth: '300px' }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input type="checkbox" checked={config.maintenanceModeEnabled} disabled style={{ accentColor: '#38bdf8' }} />
                  <div>
                    <label style={{ color: '#f8fafc', fontSize: '0.9rem', fontWeight: 500 }}>Modo de Mantenimiento</label>
                    <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Muestra una página de mantenimiento a todos los usuarios.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.4)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: '16px',
  padding: '2rem',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 600,
  color: '#f8fafc',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '0.5rem',
};

const sectionDescStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '0.85rem',
  lineHeight: 1.5,
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.6)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  padding: '1.5rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
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
};
