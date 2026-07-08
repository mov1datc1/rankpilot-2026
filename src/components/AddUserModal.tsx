'use client';

import { useState } from 'react';
import { UserPlus, X, Mail, Shield, Key } from 'lucide-react';
// import { createUser } from '@/app/actions/admin'; // will be created next

export default function AddUserModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ text: 'Creando usuario...', type: 'info' });

    try {
      // Import dynamically to avoid top-level server action issues if any
      const { createUser } = await import('@/app/actions/admin');
      const res = await createUser({ email, password, role });
      
      if (res.success) {
        setStatusMsg({ text: 'Usuario creado exitosamente', type: 'success' });
        setTimeout(() => {
          setIsOpen(false);
          setStatusMsg({ text: '', type: '' });
          setEmail('');
          setPassword('');
          // Refresh page to show new user
          window.location.reload();
        }, 1500);
      } else {
        setStatusMsg({ text: res.error || 'Error al crear usuario', type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: 'error' });
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        style={{ 
          padding: '0.6rem 1.2rem', 
          background: 'linear-gradient(135deg, #38bdf8, #2563eb)', 
          color: '#fff', 
          border: 'none', 
          borderRadius: '8px', 
          fontWeight: 600, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          cursor: 'pointer',
          boxShadow: '0 0 20px rgba(56,189,248,0.4)',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
      >
        <UserPlus size={18} />
        Nuevo Usuario
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2, 6, 23, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '450px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(56,189,248,0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={20} color="#38bdf8" />
                Agregar Usuario
              </h3>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              
              {statusMsg.text && (
                <div style={{ 
                  padding: '0.75rem', 
                  borderRadius: '8px', 
                  marginBottom: '1.5rem', 
                  fontSize: '0.85rem',
                  background: statusMsg.type === 'error' ? 'rgba(239,68,68,0.1)' : statusMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(56,189,248,0.1)',
                  color: statusMsg.type === 'error' ? '#f87171' : statusMsg.type === 'success' ? '#4ade80' : '#38bdf8',
                  border: \`1px solid \${statusMsg.type === 'error' ? 'rgba(239,68,68,0.2)' : statusMsg.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(56,189,248,0.2)'}\`
                }}>
                  {statusMsg.text}
                </div>
              )}

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 500 }}>Correo Electrónico</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.95rem', outline: 'none', transition: 'border 0.2s' }} 
                    onFocus={(e) => e.target.style.borderColor = '#38bdf8'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 500 }}>Contraseña Temporal</label>
                <div style={{ position: 'relative' }}>
                  <Key size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.95rem', outline: 'none', transition: 'border 0.2s' }} 
                    onFocus={(e) => e.target.style.borderColor = '#38bdf8'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 500 }}>Rol del Sistema</label>
                <div style={{ position: 'relative' }}>
                  <Shield size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.95rem', outline: 'none', appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="USER">User (SaaS)</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ padding: '0.75rem 1.5rem', background: isSubmitting ? '#3b82f6' : 'linear-gradient(135deg, #38bdf8, #2563eb)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isSubmitting ? 'wait' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
                >
                  {isSubmitting ? 'Guardando...' : 'Crear Usuario'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: \`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      \`}} />
    </>
  );
}
