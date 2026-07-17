'use client';

import { useState } from 'react';
import { UserPlus, X, Mail, Shield, Key, User, Building2 } from 'lucide-react';

interface AddUserModalProps {
  currentUserRole?: string;
}

export default function AddUserModal({ currentUserRole }: AddUserModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [accountType, setAccountType] = useState('INDIVIDUAL');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setStatusMsg({ text: 'La contraseña debe tener al menos 6 caracteres.', type: 'error' });
      return;
    }
    setIsSubmitting(true);
    setStatusMsg({ text: 'Creando usuario...', type: 'info' });

    try {
      const { createUser } = await import('@/app/actions/admin');
      const res = await createUser({ email, password, role, name, accountType });
      
      if (res.success) {
        setStatusMsg({ text: 'Usuario creado exitosamente', type: 'success' });
        setTimeout(() => {
          setIsOpen(false);
          setStatusMsg({ text: '', type: '' });
          setName('');
          setEmail('');
          setPassword('');
          setRole('USER');
          setAccountType('INDIVIDUAL');
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
          boxShadow: '0 0 20px rgba(56,189,248,0.3)',
          transition: 'all 0.3s ease',
          fontSize: '0.9rem',
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
          background: 'rgba(2, 6, 23, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'modalFadeIn 0.25s ease-out'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(56,189,248,0.1)',
            overflow: 'hidden',
            animation: 'modalScaleIn 0.25s ease-out',
          }}>
            {/* Header */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={20} color="#38bdf8" />
                Crear Nuevo Usuario
              </h3>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              
              {statusMsg.text && (
                <div style={{ 
                  padding: '0.75rem', 
                  borderRadius: '8px', 
                  marginBottom: '1.25rem', 
                  fontSize: '0.85rem',
                  background: statusMsg.type === 'error' ? 'rgba(239,68,68,0.1)' : statusMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(56,189,248,0.1)',
                  color: statusMsg.type === 'error' ? '#f87171' : statusMsg.type === 'success' ? '#4ade80' : '#38bdf8',
                  border: `1px solid ${statusMsg.type === 'error' ? 'rgba(239,68,68,0.2)' : statusMsg.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(56,189,248,0.2)'}`
                }}>
                  {statusMsg.text}
                </div>
              )}

              {/* Name */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Nombre Completo</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#38bdf8'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Correo Electrónico</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#38bdf8'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Contraseña (Mínimo 6 caracteres)</label>
                <div style={{ position: 'relative' }}>
                  <Key size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#38bdf8'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
              </div>

              {/* Role */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Rol del Sistema</label>
                <div style={{ position: 'relative' }}>
                  <Shield size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="USER">Cliente (User)</option>
                    {currentUserRole === 'SUPERADMIN' && (
                      <>
                        <option value="ADMIN">Admin</option>
                        <option value="SUPERADMIN">Super Admin</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Account Type — only show for USER role */}
              {role === 'USER' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={labelStyle}>Tipo de Cuenta Comercial</label>
                  <div style={{ position: 'relative' }}>
                    <Building2 size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <select 
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value)}
                      style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                    >
                      <option value="INDIVIDUAL">Individual</option>
                      <option value="CORPORATE">Corporativo (Hasta 5 usuarios)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ 
                    padding: '0.75rem 1.5rem', 
                    background: isSubmitting ? '#3b82f6' : 'linear-gradient(135deg, #38bdf8, #2563eb)', 
                    color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, 
                    cursor: isSubmitting ? 'wait' : 'pointer', 
                    opacity: isSubmitting ? 0.7 : 1,
                    fontSize: '0.9rem',
                    boxShadow: '0 0 15px rgba(56,189,248,0.3)',
                  }}
                >
                  {isSubmitting ? 'Guardando...' : 'Crear Usuario'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}} />
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  color: '#94a3b8',
  marginBottom: '0.5rem',
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem 0.75rem 2.5rem',
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#f8fafc',
  fontSize: '0.95rem',
  outline: 'none',
  transition: 'border 0.2s',
};
