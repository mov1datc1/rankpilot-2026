import { getSystemConfig } from '@/app/actions/settings';
import { saveGTMConfig, saveGAConfig } from '@/app/actions/settings';
import { Tags, LineChart, Save } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MarketingSettingsPage() {
  const config = await getSystemConfig();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Google Tag Manager */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '250px' }}>
            <h3 style={sectionTitleStyle}>
              <Tags size={20} color="#38bdf8" />
              Google Tag Manager
            </h3>
            <p style={sectionDescStyle}>
              Administra todas las etiquetas (Google Ads, Meta, Analytics) desde un solo lugar.
            </p>
            <div style={infoBoxStyle}>
              <p style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Recomendado
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5 }}>
                Configura tu GTM ID aquí para manejar todas tus etiquetas externamente sin necesidad de tocar el código.
              </p>
            </div>
          </div>

          <div style={{ flex: '1.5', minWidth: '300px' }}>
            <form action={saveGTMConfig}>
              <div style={cardStyle}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={labelStyle}>Container ID (Ej. GTM-XXXXXXX)</label>
                  <input
                    type="text"
                    name="gtm-id"
                    defaultValue={config.gtmContainerId || ''}
                    placeholder="GTM-"
                    style={fieldInputStyle}
                  />
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" style={saveButtonStyle}>
                    <Save size={16} />
                    Guardar Configuración
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Google Analytics 4 */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '250px' }}>
            <h3 style={sectionTitleStyle}>
              <LineChart size={20} color="#38bdf8" />
              Google Analytics 4
            </h3>
            <p style={sectionDescStyle}>
              Medición de tráfico y eventos en la plataforma.
            </p>
            <div style={infoBoxStyle}>
              <p style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Integración con Base de Datos
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5 }}>
                Guarda el Measurement ID aquí para inyectar automáticamente el script de GA4 en toda la plataforma.
              </p>
            </div>
          </div>

          <div style={{ flex: '1.5', minWidth: '300px' }}>
            <form action={saveGAConfig}>
              <div style={cardStyle}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={labelStyle}>Measurement ID (Ej. G-XXXXXXXXXX)</label>
                  <input
                    type="text"
                    name="ga-id"
                    defaultValue={config.gaMeasurementId || ''}
                    placeholder="G-"
                    style={fieldInputStyle}
                  />
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" style={saveButtonStyle}>
                    <Save size={16} />
                    Guardar Configuración
                  </button>
                </div>
              </div>
            </form>
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
  fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc',
  display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem',
};

const sectionDescStyle: React.CSSProperties = {
  color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5,
};

const infoBoxStyle: React.CSSProperties = {
  marginTop: '1rem', padding: '1rem',
  background: 'rgba(56, 189, 248, 0.05)',
  border: '1px solid rgba(56, 189, 248, 0.2)',
  borderRadius: '10px',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.6)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  padding: '1.5rem',
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
