'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Settings, ShieldAlert, ArrowLeft } from 'lucide-react';

interface AdminSidebarProps {
  userEmail: string;
  userRole: string;
}

export default function AdminSidebar({ userEmail, userRole }: AdminSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Usuarios (SaaS)', href: '/dashboard/admin', icon: Users, exact: true },
    { name: 'Configuración', href: '/dashboard/admin/settings', icon: Settings },
  ];

  if (userRole === 'SUPERADMIN') {
    navItems.push({ name: 'Gestión de Admins', href: '/dashboard/admin/roles', icon: ShieldAlert });
  }

  return (
    <aside style={{ 
      width: '260px', 
      background: '#0f172a', 
      borderRight: '1px solid rgba(255,255,255,0.05)', 
      padding: '2rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      <h2 style={{ 
        fontSize: '1.5rem', 
        fontWeight: 700, 
        marginBottom: '2.5rem',
        background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        RankPilot
        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', WebkitTextFillColor: '#fff', letterSpacing: '0.05em' }}>
          PRO
        </span>
      </h2>
      
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.name} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.8rem 1rem', borderRadius: '8px',
              textDecoration: 'none',
              color: isActive ? '#fff' : '#94a3b8',
              background: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
              border: isActive ? '1px solid rgba(56, 189, 248, 0.2)' : '1px solid transparent',
              fontWeight: isActive ? 600 : 500,
              fontSize: '0.95rem',
              transition: 'all 0.3s ease',
              boxShadow: isActive ? '0 4px 12px rgba(56, 189, 248, 0.05)' : 'none'
            }}>
              <Icon size={18} color={isActive ? '#38bdf8' : '#64748b'} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Volver a la App */}
      <Link href="/submissions" style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.8rem 1rem',
        textDecoration: 'none',
        color: '#64748b',
        fontSize: '0.9rem',
        marginBottom: '1rem',
        transition: 'color 0.2s',
      }} onMouseOver={(e) => e.currentTarget.style.color = '#fff'} onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}>
        <ArrowLeft size={16} /> Volver a Submissions
      </Link>

      <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ fontSize: '0.75rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</p>
        <p style={{ fontSize: '0.65rem', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: userRole === 'SUPERADMIN' ? '#f87171' : '#38bdf8' }}>
          {userRole}
        </p>
      </div>
    </aside>
  );
}
