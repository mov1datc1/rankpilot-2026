'use client';

import { useState } from 'react';
import { Search, UserPlus, Shield, CheckCircle, Clock, XCircle, CreditCard, UserCheck, ShieldAlert } from 'lucide-react';
import { toggleUserStatus } from '@/app/actions/admin';
import AddUserModal from '@/components/AddUserModal';

interface UserItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  accountType: string;
  status: string;
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  createdAt: string;
}

interface UsersClientProps {
  saasUsers: UserItem[];
  manualClients: UserItem[];
  adminUsers: UserItem[];
  currentUserRole: string;
}

type TabKey = 'saas' | 'manual' | 'admin';

export default function UsersClient({ saasUsers, manualClients, adminUsers, currentUserRole }: UsersClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('saas');
  const [searchQuery, setSearchQuery] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const tabs: { key: TabKey; label: string; icon: any; count: number; superAdminOnly?: boolean }[] = [
    { key: 'saas', label: 'Clientes SaaS (Stripe)', icon: CreditCard, count: saasUsers.length },
    { key: 'manual', label: 'Clientes Manuales', icon: UserCheck, count: manualClients.length },
    { key: 'admin', label: 'Administradores', icon: ShieldAlert, count: adminUsers.length, superAdminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.superAdminOnly || currentUserRole === 'SUPERADMIN');

  const getUsers = (): UserItem[] => {
    switch (activeTab) {
      case 'saas': return saasUsers;
      case 'manual': return manualClients;
      case 'admin': return adminUsers;
      default: return [];
    }
  };

  const filteredUsers = getUsers().filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleToggle = async (userId: string) => {
    setToggling(userId);
    await toggleUserStatus(userId);
    window.location.reload();
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        background: 'rgba(15, 23, 42, 0.4)',
        padding: '0.4rem',
        borderRadius: '12px',
        width: 'fit-content',
      }}>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearchQuery(''); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                border: isActive ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                background: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                color: isActive ? '#38bdf8' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={16} />
              {tab.label}
              <span style={{
                background: isActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                padding: '0.1rem 0.5rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + Add User */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem',
        gap: '1rem',
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Buscar por nombre o correo electrónico..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.7rem 1rem 0.7rem 2.5rem',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              color: '#f8fafc',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'rgba(56, 189, 248, 0.5)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>
        <AddUserModal currentUserRole={currentUserRole} />
      </div>

      {/* Users Table */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
              <th style={thStyle}>Usuario</th>
              <th style={thStyle}>Rol</th>
              {activeTab === 'manual' && <th style={thStyle}>Tipo Cuenta</th>}
              <th style={thStyle}>Estado</th>
              {activeTab === 'saas' && <th style={thStyle}>Stripe ID</th>}
              <th style={thStyle}>Fecha Registro</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} className="admin-table-row">
                <td style={tdStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: user.role === 'SUPERADMIN' 
                        ? 'linear-gradient(135deg, #ef4444, #b91c1c)' 
                        : user.role === 'ADMIN' 
                          ? 'linear-gradient(135deg, #38bdf8, #818cf8)' 
                          : 'linear-gradient(135deg, #64748b, #475569)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                    }}>
                      {(user.name || user.email).substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontWeight: 500, color: '#f8fafc', fontSize: '0.9rem', margin: 0 }}>{user.name || 'Sin nombre'}</p>
                      <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>{user.email}</p>
                    </div>
                  </div>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    background: user.role === 'SUPERADMIN' ? 'rgba(239,68,68,0.15)' : user.role === 'ADMIN' ? 'rgba(59,130,246,0.15)' : 'rgba(148,163,184,0.1)',
                    color: user.role === 'SUPERADMIN' ? '#fca5a5' : user.role === 'ADMIN' ? '#93c5fd' : '#cbd5e1',
                    border: `1px solid ${user.role === 'SUPERADMIN' ? 'rgba(239,68,68,0.3)' : user.role === 'ADMIN' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  }}>
                    {user.role === 'SUPERADMIN' && <Shield size={11} />}
                    {user.role}
                  </span>
                </td>
                {activeTab === 'manual' && (
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '20px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: user.accountType === 'CORPORATE' ? 'rgba(59,130,246,0.15)' : 'rgba(148,163,184,0.1)',
                      color: user.accountType === 'CORPORATE' ? '#93c5fd' : '#94a3b8',
                      border: `1px solid ${user.accountType === 'CORPORATE' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    }}>
                      {user.accountType === 'CORPORATE' ? 'Corporativo' : 'Individual'}
                    </span>
                  </td>
                )}
                <td style={tdStyle}>
                  <span style={{
                    color: user.status === 'ACTIVE' ? '#4ade80' : '#f87171',
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    fontSize: '0.85rem', fontWeight: 500,
                  }}>
                    {user.status === 'ACTIVE' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    {user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                {activeTab === 'saas' && (
                  <td style={{ ...tdStyle, color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                    {user.stripeCustomerId || 'N/A'}
                  </td>
                )}
                <td style={{ ...tdStyle, color: '#94a3b8', fontSize: '0.85rem' }}>
                  {formatDate(user.createdAt)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <button
                    onClick={() => handleToggle(user.id)}
                    disabled={toggling === user.id}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: toggling === user.id ? 'wait' : 'pointer',
                      border: `1px solid ${user.status === 'ACTIVE' ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.3)'}`,
                      color: user.status === 'ACTIVE' ? '#fca5a5' : '#6ee7b7',
                      background: 'transparent',
                      transition: 'all 0.2s',
                      opacity: toggling === user.id ? 0.5 : 1,
                    }}
                  >
                    {toggling === user.id ? '...' : user.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  {searchQuery ? 'No se encontraron usuarios con ese criterio.' : 'No hay usuarios en esta categoría.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .admin-table-row:hover {
          background: rgba(255,255,255,0.02) !important;
        }
      `}} />
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '1rem 1.5rem',
  color: '#94a3b8',
  fontWeight: 600,
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '1rem 1.5rem',
};
