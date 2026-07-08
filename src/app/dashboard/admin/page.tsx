import prisma from '@/lib/prisma';
import AddUserModal from '@/components/AddUserModal';
import { Shield, CheckCircle, Clock } from 'lucide-react';

export default async function AdminDashboardPage() {
  const users = await prisma.user.findMany({
    orderBy: { email: 'asc' }
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.2rem', letterSpacing: '-0.02em' }}>Panel Administrativo</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Gestión centralizada de usuarios SaaS y acceso al sistema.</p>
        </div>
        <AddUserModal />
      </div>

      <div style={{ 
        background: 'rgba(15, 23, 42, 0.6)', 
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '1.25rem 1.5rem', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email / Usuario</th>
              <th style={{ padding: '1.25rem 1.5rem', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rol</th>
              <th style={{ padding: '1.25rem 1.5rem', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado</th>
              <th style={{ padding: '1.25rem 1.5rem', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID Suscripción (Stripe)</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} className="admin-table-row">
                <td style={{ padding: '1.25rem 1.5rem', fontWeight: 500, color: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #38bdf8, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
                      {user.email.substring(0, 2).toUpperCase()}
                    </div>
                    {user.email}
                  </div>
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <span style={{ 
                    padding: '0.35rem 0.75rem', 
                    borderRadius: '20px', 
                    fontSize: '0.75rem', 
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    background: user.role === 'SUPERADMIN' ? 'rgba(239, 68, 68, 0.15)' : (user.role === 'ADMIN' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.1)'),
                    color: user.role === 'SUPERADMIN' ? '#fca5a5' : (user.role === 'ADMIN' ? '#93c5fd' : '#cbd5e1'),
                    border: `1px solid ${user.role === 'SUPERADMIN' ? 'rgba(239,68,68,0.3)' : (user.role === 'ADMIN' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)')}`
                  }}>
                    {user.role === 'SUPERADMIN' && <Shield size={12} />}
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <span style={{ 
                    color: user.status === 'ACTIVE' ? '#4ade80' : '#94a3b8',
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    fontSize: '0.85rem', fontWeight: 500
                  }}>
                    {user.status === 'ACTIVE' ? <CheckCircle size={14} /> : <Clock size={14} />}
                    {user.status}
                  </span>
                </td>
                <td style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                  {user.subscriptionId || 'N/A'}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  No hay usuarios registrados aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .admin-table-row:hover {
          background: rgba(255,255,255,0.02);
        }
      `}} />
    </div>
  );
}
