import Wizard from '@/components/Wizard';

export default function WizardPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '4rem 2rem', display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
          RankPilot Wizard
        </h1>
        <p style={{ color: '#64748b', fontSize: '1.1rem' }}>
          Completa la información para generar tu submission con Inteligencia Artificial.
        </p>
      </div>
      
      <Wizard />
      
    </div>
  );
}
