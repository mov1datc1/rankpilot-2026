import prisma from '@/lib/prisma';
import { Shield, AlertTriangle } from 'lucide-react';

export default async function AdminRolesPage() {
  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPERADMIN' }
  });

  return (
    <div>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.2rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Shield color="#ef4444" size={32} />
          Gestión de Admins
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Área restringida. Nivel de acceso 3 requerido.</p>
      </div>

      <div style={{ 
        background: 'rgba(239, 68, 68, 0.05)', 
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem'
      }}>
        <AlertTriangle color="#ef4444" size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 style={{ color: '#fca5a5', fontWeight: 600, marginBottom: '0.25rem' }}>Zona de Alto Riesgo</h4>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Los usuarios en esta lista tienen control absoluto sobre la plataforma, suscripciones y datos de clientes. Modificar estos accesos puede causar interrupciones graves.
          </p>
        </div>
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
              <th style={{ padding: '1.25rem 1.5rem', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Super Administrador</th>
              <th style={{ padding: '1.25rem 1.5rem', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {superAdmins.map((admin) => (
              <tr key={admin.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '1.25rem 1.5rem', fontWeight: 500, color: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
                      {admin.email.substring(0, 2).toUpperCase()}
                    </div>
                    {admin.email}
                  </div>
                </td>
                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                  <button style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                    Revocar Acceso
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
