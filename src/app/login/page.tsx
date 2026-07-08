'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

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
      window.location.href = '/wizard';
    }
    setLoading(false);
  };

  const handleMagicLink = async () => {
    setLoading(true);
    setMessage('');

    if (!email) {
      setMessage('Por favor ingresa tu correo electrónico para enviar el Magic Link.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/wizard`,
      },
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('¡Revisa tu correo! Te hemos enviado un Magic Link para iniciar sesión.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '400px', width: '100%', padding: '2.5rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center' }}>
          RankPilot
        </h1>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '2rem' }}>
          Ingresa a tu cuenta
        </p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Correo Electrónico</label>
            <input 
              type="email" 
              className="form-input" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">Contraseña</label>
            <input 
              type={showPassword ? 'text' : 'password'} 
              className="form-input" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '1rem', top: '2.3rem', color: 'var(--text-secondary)' }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {message && (
            <div style={{ margin: '1rem 0', padding: '0.75rem', borderRadius: '6px', fontSize: '0.875rem', background: message.includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(74, 222, 128, 0.1)', color: message.includes('Error') ? '#ef4444' : '#4ade80' }}>
              {message}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Cargando...' : 'Iniciar Sesión'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
              <span style={{ padding: '0 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>o</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
            </div>

            <button type="button" className="btn-secondary" onClick={handleMagicLink} disabled={loading} style={{ width: '100%' }}>
              Enviar Magic Link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
