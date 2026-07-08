import Wizard from '@/components/Wizard';

export default function WizardPage() {
  return (
    <div style={{ minHeight: '100vh', padding: '4rem 2rem', display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          RankPilot Wizard
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Completa la información para generar tu submission con Inteligencia Artificial.
        </p>
      </div>
      
      <Wizard />
      
    </div>
  );
}
