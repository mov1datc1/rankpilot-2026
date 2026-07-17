'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Users, Settings, Target, Mail } from 'lucide-react';

const adminNav = [
  { name: 'Dashboard', href: '/dashboard/admin', icon: BarChart3, exact: true },
  { name: 'Control de Usuarios', href: '/dashboard/admin/users', icon: Users },
  { name: 'Configuración de Sistema', href: '/dashboard/admin/settings', icon: Settings },
  { name: 'Marketing y Tracking', href: '/dashboard/admin/marketing', icon: Target },
  { name: 'Resend y Correos', href: '/dashboard/admin/smtp', icon: Mail },
];

interface AdminTabsProps {
  userRole: string;
}

export default function AdminTabs({ userRole }: AdminTabsProps) {
  const pathname = usePathname();

  const filteredNav = adminNav.filter((item) => {
    const isSuperAdminOnly = ['Configuración de Sistema', 'Marketing y Tracking', 'Resend y Correos'].includes(item.name);
    if (isSuperAdminOnly && userRole !== 'SUPERADMIN') return false;
    return true;
  });

  return (
    <div style={{
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      marginBottom: '2rem',
    }}>
      <nav style={{
        display: 'flex',
        gap: '0.25rem',
        overflowX: 'auto',
        paddingBottom: '0',
      }}>
        {filteredNav.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href 
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.85rem 1.25rem',
                fontSize: '0.9rem',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#38bdf8' : '#94a3b8',
                textDecoration: 'none',
                borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
