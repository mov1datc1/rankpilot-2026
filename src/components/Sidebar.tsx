'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  FileText, 
  BarChart2, 
  Settings,
  BookOpen,
  LogOut
} from 'lucide-react';

import { useState, useEffect } from 'react';

type RecentItem = { name: string; href: string; directory: string };

interface SidebarProps {
  userRole?: string;
}

export default function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  
  // Reordered: Matter Assistant → Builder → Reports → Dashboard
  const platformLinks = [
    { name: 'Matters Assistant', href: '/matters-assistant', icon: BookOpen },
    { name: 'Builder', href: '/submissions', icon: Home },
    { name: 'Reports', href: '/reports', icon: FileText },
    { name: 'Dashboard', href: '/dashboard-analytics', icon: BarChart2 },
  ];

  const [recentLinks, setRecentLinks] = useState<RecentItem[]>([]);

  useEffect(() => {
    // Fetch real recent submissions
    fetch('/api/recent-submissions')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.items) {
          setRecentLinks(data.items);
        }
      })
      .catch(() => {});
  }, []);

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

  return (
    <aside style={{
      width: '260px',
      background: '#ffffff',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      overflowY: 'auto'
    }}>
      {/* Logo */}
      <div style={{ padding: '1.25rem 1rem', display: 'flex', alignItems: 'center' }}>
        <img src="/logo-rankpilot.png" alt="RankPilot" style={{ height: '36px', width: 'auto' }} />
      </div>

      {/* PLATFORM SECTION */}
      <div style={{ padding: '1.5rem 1rem 0.5rem 1rem' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>PLATFORM</p>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {platformLinks.map((link) => {
            const isActive = pathname.startsWith(link.href) && link.href !== '#';
            const Icon = link.icon;
            return (
              <Link key={link.name} href={link.href} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                textDecoration: 'none',
                color: isActive ? '#2563eb' : '#475569',
                background: isActive ? '#eff6ff' : 'transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                {link.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* RECENT SECTION — real data */}
      {recentLinks.length > 0 && (
        <div style={{ padding: '1.5rem 1rem 0.5rem 1rem' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>RECENT</p>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {recentLinks.map((link, idx) => (
              <Link key={idx} href={link.href} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.4rem 1rem',
                textDecoration: 'none',
                color: '#64748b',
                fontSize: '0.8rem',
                transition: 'color 0.2s',
                borderRadius: '6px',
              }}>
                <span style={{ marginRight: '0.5rem', color: '#94a3b8', fontSize: '1.2rem', lineHeight: 1 }}>·</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {link.name}
                </span>
              </Link>
            ))}
          </nav>
        </div>
      )}

      <div style={{ flex: 1 }}></div>

      {/* ACCOUNT SECTION */}
      <div style={{ padding: '1.5rem 1rem 2rem 1rem' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>ACCOUNT</p>
        
        {isAdmin && (
          <Link href="/dashboard/admin" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.6rem 1rem',
            borderRadius: '8px',
            textDecoration: 'none',
            color: pathname.startsWith('/dashboard/admin') ? '#2563eb' : '#475569',
            background: pathname.startsWith('/dashboard/admin') ? '#eff6ff' : 'transparent',
            fontWeight: pathname.startsWith('/dashboard/admin') ? 600 : 500,
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}>
            <Settings size={18} />
            Admin Panel
          </Link>
        )}

        <button 
          onClick={() => {
            // Logout via Supabase
            fetch('/api/auth/logout', { method: 'POST' }).then(() => {
              window.location.href = '/login';
            });
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.6rem 1rem',
            borderRadius: '8px',
            textDecoration: 'none',
            color: '#94a3b8',
            background: 'transparent',
            fontWeight: 500,
            fontSize: '0.9rem',
            transition: 'all 0.2s',
            width: '100%',
            border: 'none',
            cursor: 'pointer',
            marginTop: '0.25rem',
          }}
        >
          <LogOut size={18} />
          Cerrar Sesión
        </button>
      </div>

    </aside>
  );
}

