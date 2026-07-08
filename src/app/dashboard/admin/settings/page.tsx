export default function AdminSettingsPage() {
  return (
    <div>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.2rem', letterSpacing: '-0.02em' }}>Configuración</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Ajustes globales del sistema y parámetros de integración.</p>
      </div>

      <div style={{ 
        background: 'rgba(15, 23, 42, 0.6)', 
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '16px',
        padding: '3rem',
        textAlign: 'center',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
      }}>
        <div style={{ width: '64px', height: '64px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>Próximamente</h3>
        <p style={{ color: '#94a3b8', maxWidth: '400px', margin: '0 auto' }}>
          El módulo de configuración avanzada de Stripe y APIs de terceros estará disponible en la próxima actualización.
        </p>
      </div>
    </div>
  );
}
