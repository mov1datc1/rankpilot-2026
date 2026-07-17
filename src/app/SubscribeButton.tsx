'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function SubscribeButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Error al iniciar el checkout');
        setIsLoading(false);
      }
    } catch (err: any) {
      setError('Error de conexión. Intenta de nuevo.');
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <button
        onClick={handleSubscribe}
        disabled={isLoading}
        style={{
          background: '#ffffff',
          color: '#0f172a',
          padding: '1rem 2.5rem',
          borderRadius: '9999px',
          fontSize: '1.1rem',
          fontWeight: 700,
          border: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.75rem',
          boxShadow: '0 10px 25px -5px rgba(255, 255, 255, 0.2)',
          transition: 'transform 0.2s',
          cursor: isLoading ? 'wait' : 'pointer',
          opacity: isLoading ? 0.8 : 1,
        }}
        onMouseOver={(e) => { if (!isLoading) e.currentTarget.style.transform = 'scale(1.03)'; }}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        {isLoading ? (
          <>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            Procesando...
          </>
        ) : (
          <>
            Suscribirse Ahora <ArrowRight size={20} />
          </>
        )}
      </button>
      
      {error && (
        <p style={{ color: '#f87171', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          {error}
        </p>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
