'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Zap, 
  FileText, 
  BarChart2, 
  Settings 
} from 'lucide-react';
import Image from 'next/image';

import { useState, useEffect } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  
  const platformLinks = [
    { name: 'Builder', href: '/submissions', icon: Home },
    { name: 'Matters Assistant', href: '/submissions/matters', icon: Zap },
    { name: 'Report', href: '/reports', icon: FileText },
    { name: 'Dashboard', href: '#', icon: BarChart2 },
  ];

  const [recentLinks, setRecentLinks] = useState<{name: string, href: string}[]>([
    { name: 'Chambers Latin Ameri...', href: '#' },
    { name: 'Legal 500 LACCA · M&A', href: '#' },
    { name: 'IFLR 1000 · Finance', href: '#' },
    { name: 'Who\'s Who Legal · Arbi...', href: '#' },
  ]);

  useEffect(() => {
    // Optionally load dynamic recent links from localStorage if they exist
    const saved = localStorage.getItem('recent_submissions');
    if (saved) {
      try {
        setRecentLinks(JSON.parse(saved));
      } catch (e) {
        // Fallback to static
      }
    }
  }, []);

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
      <div style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* Placeholder for Logo, since we don't have the exact image asset, we use text styling similar to logo */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 300, color: '#0f172a' }}>RANK</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>PILOT</span>
        </div>
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

      {/* RECENT SECTION */}
      <div style={{ padding: '1.5rem 1rem 0.5rem 1rem' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>RECENT</p>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {recentLinks.map((link, idx) => (
            <Link key={idx} href={link.href} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.4rem 1rem',
              textDecoration: 'none',
              color: '#64748b',
              fontSize: '0.85rem',
              transition: 'color 0.2s'
            }}>
              <span style={{ marginRight: '0.5rem', color: '#94a3b8', fontSize: '1.2rem', lineHeight: 1 }}>·</span>
              {link.name}
            </Link>
          ))}
        </nav>
      </div>

      <div style={{ flex: 1 }}></div>

      {/* ACCOUNT SECTION */}
      <div style={{ padding: '1.5rem 1rem 2rem 1rem' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>ACCOUNT</p>
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
          Settings
        </Link>
      </div>

    </aside>
  );
}
