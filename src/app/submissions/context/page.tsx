'use client';

import { Sparkles, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ContextPage() {
  const router = useRouter();

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem 0 4rem 0' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          RankPilot: <span style={{ color: '#2563eb' }}>Legal Directory Portal</span>
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#64748b', marginTop: '0.25rem' }}>Setup Wizard</p>
      </div>

      {/* Top Stepper Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem', background: '#ffffff', padding: '0.5rem', borderRadius: '9999px', border: '1px solid #e2e8f0', width: 'fit-content' }}>
        <div style={{ padding: '0.5rem 1.5rem', background: '#eff6ff', color: '#2563eb', borderRadius: '9999px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={16} /> 1. Context
        </div>
        <div style={{ width: '40px', height: '1px', background: '#cbd5e1' }}></div>
        <div style={{ padding: '0.5rem 1.5rem', color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>
          2. Audit Room
        </div>
        <div style={{ width: '40px', height: '1px', background: '#cbd5e1' }}></div>
        <div style={{ padding: '0.5rem 1.5rem', color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>
          3. Delivery
        </div>
      </div>

      {/* Main Content */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#1e3a8a', marginBottom: '0.5rem' }}>RankPilot: Initial context</h2>
        <p style={{ fontSize: '1.1rem', color: '#475569' }}>Before starting the Audit Room, this is what I understood from your draft.</p>
      </div>

      {/* Copilot Alert Box */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', boxShadow: '0 2px 4px -1px rgba(0,0,0,0.02)' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
          <Sparkles size={24} />
        </div>
        <div>
          <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>RankPilot · Co-pilot</h4>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569' }}>Ready — I have read your draft. This is the context I understood; confirm or adjust it before entering the Audit Room.</p>
        </div>
      </div>

      {/* Context Details Box */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2.5rem', marginBottom: '3rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
        
        {/* Pills */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
          {['Legal 500', 'Latin America', 'Banking & Finance', 'Deadline · 2026-07-30'].map(pill => (
            <span key={pill} style={{ background: '#eff6ff', color: '#2563eb', padding: '0.35rem 1rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600 }}>
              {pill}
            </span>
          ))}
        </div>

        <h3 style={{ fontSize: '1.25rem', color: '#334155', fontWeight: 400, marginBottom: '2.5rem' }}>
          You are submitting to to move from <strong style={{ color: '#0f172a' }}>Unranked → Band 5</strong> in Banking & Finance.
        </h3>

        <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', marginBottom: '1rem', textTransform: 'uppercase' }}>I Detected In Your Draft</h4>
        
        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fafaf9' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 600, color: '#0f172a', lineHeight: 1 }}>0</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem', fontWeight: 500 }}>Detected Matters</div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fafaf9' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 600, color: '#0f172a', lineHeight: 1 }}>0</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem', fontWeight: 500 }}>Cited Referees</div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fafaf9' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 600, color: '#0f172a', lineHeight: 1 }}>0</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem', fontWeight: 500 }}>Detected Lawyers</div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fafaf9' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 600, color: '#0f172a', lineHeight: 1 }}>0%</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem', fontWeight: 500 }}>Initial Confidence</div>
          </div>
        </div>

        {/* Informational Callout */}
        <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #bfdbfe' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e3a8a', margin: '0 0 0.5rem 0' }}>To target Band 5, this is what I already have</h4>
          <p style={{ fontSize: '0.9rem', color: '#1e40af', margin: 0, lineHeight: 1.5 }}>
            I can assemble a strong first draft from what you uploaded, but if you provide more context on the key points, the draft moves from "publishable" to "competitive".
          </p>
        </div>
      </div>

      {/* Next Actions */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', marginBottom: '1rem' }}>What would you like to strengthen?</h3>
        
        {/* Structural Content Button */}
        <button style={{ 
          width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem',
          display: 'flex', alignItems: 'center', gap: '1.5rem', cursor: 'pointer', transition: 'all 0.2s',
          boxShadow: '0 2px 4px -1px rgba(0,0,0,0.02)'
        }}
        onMouseOver={(e) => e.currentTarget.style.borderColor = '#2563eb'}
        onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontWeight: 600 }}>
            1
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', margin: '0 0 0.25rem 0' }}>Structural Content</h4>
            <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>Missing 41 key data points in the submission.</p>
            <p style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 600, margin: 0 }}>41 preguntas restantes</p>
          </div>
          <div style={{ color: '#94a3b8' }}>
            <ArrowRight />
          </div>
        </button>
      </div>

      {/* Bottom Actions */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <button style={{ flex: 1, padding: '1rem', background: '#2563eb', color: '#ffffff', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1rem' }}>
          Enter the Audit Room <ArrowRight size={18} />
        </button>
        <button style={{ padding: '1rem 2rem', background: '#ffffff', color: '#475569', fontWeight: 600, borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', fontSize: '1rem' }}>
          Saltar y generar ya
        </button>
      </div>

    </div>
  );
}
