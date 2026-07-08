import './globals.css';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', width: '100%', textAlign: 'center' }}>
        
        <h1 className="text-gradient" style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '1rem', letterSpacing: '-0.03em' }}>
          RankPilot
        </h1>
        
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
          La plataforma definitiva para gestionar, analizar y automatizar tus submissions legales con el poder de la Inteligencia Artificial.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-primary">
            <span>Iniciar Submission</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
          
          <button className="btn-secondary">
            Ver Dashboard
          </button>
        </div>

      </div>

      <div className="animate-fade-in" style={{ marginTop: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem', animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
        Next.js + Supabase + RankPilot Core AI
      </div>

    </div>
  );
}
