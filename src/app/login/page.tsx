'use client';

import { useState } from 'react';
import { Eye, EyeOff, Check, BarChart2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      window.location.href = '/submissions';
    }
    setLoading(false);
  };

  const handleMagicLink = async () => {
    setLoading(true);
    setMessage('');

    if (!email) {
      setMessage('Please enter your email to send a Magic Link.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/submissions`,
      },
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Check your email! We sent you a Magic Link.');
    }
    setLoading(false);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f3f4f6', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '2rem',
      fontFamily: 'var(--font-sans)',
      color: '#1f2937'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        maxWidth: '1000px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
        minHeight: '600px'
      }} className="animate-fade-in">
        
        {/* Left Panel - Branding */}
        <div style={{
          flex: '1.2',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
          padding: '3rem',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '8px' }}>
              <BarChart2 size={24} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, lineHeight: 1 }}>RankPilot</h2>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Legal Rankings. Simplified</span>
            </div>
          </div>

          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.1, marginBottom: '1rem' }}>
            Automate your submissions.<br/>Accelerate your rankings.
          </h1>
          
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1rem', marginBottom: '2rem', maxWidth: '90%' }}>
            The first AI-powered platform specialized in legal rankings for Latin America and the world.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
            {['MULTI-USER', 'MULTILINGUAL', '100% LEGALTECH'].map(badge => (
              <span key={badge} style={{
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '9999px',
                padding: '0.25rem 0.75rem',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: 'rgba(255,255,255,0.9)'
              }}>
                {badge}
              </span>
            ))}
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '1.5rem',
            marginTop: 'auto'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>✨</span> Optimize every submission with legal AI and smart workflows.
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1rem' }}>
              Save time, improve your drafts, and increase your ranking opportunities.
            </p>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                'Reduce up to 70% of the work time per submission.',
                'AI-assisted writing trained in legal language.',
                'Guided input and Word export (Chambers, Legal 500, IFLR, Leaders League).'
              ].map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
                  <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '0.1rem', marginTop: '0.1rem' }}>
                    <Check size={12} color="#ffffff" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div style={{
          flex: '1',
          padding: '4rem 3rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '0.5rem', color: '#111827' }}>Login</h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '2.5rem' }}>Enter your credentials to access RankPilot.</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Email address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#f9fafb',
                  fontSize: '0.9rem',
                  color: '#111827',
                  outline: 'none'
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Password</label>
                <Link href="#" style={{ fontSize: '0.75rem', color: '#4b5563', textDecoration: 'none' }}>Forgot your password?</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    background: '#f9fafb',
                    fontSize: '0.9rem',
                    color: '#111827',
                    outline: 'none'
                  }}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input type="checkbox" id="remember" style={{ width: '1rem', height: '1rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
              <label htmlFor="remember" style={{ fontSize: '0.875rem', color: '#4b5563' }}>Remember me</label>
            </div>

            {message && (
              <div style={{ 
                padding: '0.75rem', 
                borderRadius: '6px', 
                fontSize: '0.875rem', 
                background: message.includes('Error') ? '#fef2f2' : '#f0fdf4', 
                color: message.includes('Error') ? '#ef4444' : '#16a34a',
                border: message.includes('Error') ? '1px solid #fecaca' : '1px solid #bbf7d0'
              }}>
                {message}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '9999px',
                background: '#0a192f',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.9rem',
                marginTop: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.8 : 1,
                border: 'none'
              }}
            >
              {loading ? 'Processing...' : 'LOGIN'}
            </button>

            <button 
              type="button" 
              onClick={handleMagicLink}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '9999px',
                background: 'transparent',
                color: '#4b5563',
                fontWeight: 600,
                fontSize: '0.85rem',
                border: '1px solid #d1d5db',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Login with Magic Link
            </button>

          </form>

          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', marginTop: '2rem' }}>
            © RankPilot 2026
          </p>
        </div>
        
      </div>
    </div>
  );
}
