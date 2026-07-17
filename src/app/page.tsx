import './globals.css';
import Link from 'next/link';
import { BarChart2, Check, ArrowRight, Shield } from 'lucide-react';
import SubscribeButton from './SubscribeButton';

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative Background Elements */}
      <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%' }}></div>
      
      {/* Navbar */}
      <header style={{ padding: '1.5rem 3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '8px' }}>
            <BarChart2 size={24} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, lineHeight: 1 }}>RankPilot</h2>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legal Rankings. Simplified</span>
          </div>
        </div>
        <div>
          <Link href="/login" style={{ 
            color: '#fff', 
            textDecoration: 'none', 
            fontWeight: 500, 
            fontSize: '0.9rem',
            padding: '0.5rem 1rem',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '9999px',
            transition: 'background 0.2s'
          }} className="hover-bg-glass">
            Iniciar Sesión
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', zIndex: 10, textAlign: 'center' }} className="animate-fade-in">
        
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {['MULTI-USER', 'MULTILINGUAL', '100% LEGALTECH'].map(badge => (
            <span key={badge} style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '9999px',
              padding: '0.35rem 1rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: '#60a5fa'
            }}>
              {badge}
            </span>
          ))}
        </div>

        <h1 style={{ fontSize: '4.5rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem', maxWidth: '800px', letterSpacing: '-0.02em' }}>
          Automate your submissions.<br/>Accelerate your <span style={{ color: '#60a5fa' }}>rankings.</span>
        </h1>
        
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.25rem', marginBottom: '3rem', maxWidth: '600px', lineHeight: 1.6 }}>
          The first AI-powered platform specialized in legal rankings for Latin America and the world. Increase your firm&apos;s visibility effortlessly.
        </p>

        {/* CTA to Stripe Checkout */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <SubscribeButton />
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={14} /> Pago seguro vía Stripe
          </span>
        </div>

        {/* Value Proposition Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
          maxWidth: '1000px',
          width: '100%',
          marginTop: '5rem',
          textAlign: 'left'
        }}>
          {[
            {
              title: 'Reduce up to 70% of work time',
              desc: 'Automate repetitive tasks and let RankPilot handle the initial drafts and formatting.'
            },
            {
              title: 'Legal AI Specialization',
              desc: 'AI-assisted writing specifically trained in legal language and industry standards.'
            },
            {
              title: 'Native Export Formats',
              desc: 'Guided input with 1-click Word exports specifically formatted for Chambers, Legal 500, and IFLR.'
            }
          ].map((card, i) => (
            <div key={i} style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '2rem',
              transition: 'background 0.2s'
            }}>
              <div style={{ background: 'rgba(96, 165, 250, 0.2)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Check size={20} color="#60a5fa" />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.75rem' }}>{card.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', lineHeight: 1.5 }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', zIndex: 10 }}>
        © {new Date().getFullYear()} RankPilot. Todos los derechos reservados.
      </footer>
    </div>
  );
}
