'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, BarChart2, Settings, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState, useEffect, type FocusEvent, type MouseEvent } from 'react';
import './Sidebar.css';

type RecentItem = { name: string; href: string; directory: string };
type Preference = 'collapsed' | 'expanded';
const storageKey = 'rankpilot.sidebar.v1';

export default function Sidebar({ userRole }: { userRole?: string }) {
  const pathname = usePathname();
  const inStudio = /^\/reports\/[^/]+/.test(pathname);
  const scope = inStudio ? 'studio' : 'general';
  const [preferences, setPreferences] = useState<Partial<Record<'studio' | 'general', Preference>>>({});
  const collapsed = preferences[scope] ? preferences[scope] === 'collapsed' : inStudio;
  const [recentLinks, setRecentLinks] = useState<RecentItem[]>([]);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
      const valid: typeof preferences = {};
      for (const key of ['studio', 'general'] as const) {
        if (stored?.[key] === 'collapsed' || stored?.[key] === 'expanded') valid[key] = stored[key];
      }
      setPreferences(valid);
    } catch { /* Storage may be unavailable; the menu still works for this visit. */ }
    fetch('/api/recent-submissions').then(res => res.json()).then(data => {
      if (data.success && Array.isArray(data.items)) setRecentLinks(data.items);
    }).catch(() => {});
  }, []);

  useEffect(() => { setTooltip(null); }, [pathname, collapsed]);

  const toggle = () => {
    const next = { ...preferences, [scope]: collapsed ? 'expanded' as const : 'collapsed' as const };
    setPreferences(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the in-memory choice. */ }
  };
  const showLabel = (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>, text: string) => {
    if (!collapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ text, x: Math.min(rect.right + 10, window.innerWidth - 230), y: Math.min(rect.top, window.innerHeight - 70) });
  };
  const labelEvents = (text: string) => ({
    onMouseEnter: (event: MouseEvent<HTMLElement>) => showLabel(event, text),
    onFocus: (event: FocusEvent<HTMLElement>) => showLabel(event, text),
    onMouseLeave: () => setTooltip(null),
    onBlur: () => setTooltip(null),
    onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Escape') setTooltip(null); },
  });
  const platformLinks = [
    { name: 'Builder', href: '/builder', icon: Home },
    { name: 'Reports', href: '/reports', icon: FileText },
    { name: 'Dashboard', href: '/dashboard-analytics', icon: BarChart2 },
  ];
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  const toggleLabel = collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral';

  return (
    <aside className="app-sidebar" data-collapsed={collapsed} aria-label="Menú principal" onScroll={() => setTooltip(null)}>
      <div className="app-sidebar-header">
        <Link href="/builder" className="app-sidebar-brand" aria-label="RankPilot · Inicio" {...labelEvents('RankPilot · Inicio')}>
          {collapsed ? <span className="app-sidebar-mark" aria-hidden="true">R<span>↗</span></span> : <img src="/logo-rankpilot.png" alt="RankPilot" />}
        </Link>
        <button type="button" className="app-sidebar-toggle" onClick={toggle} aria-label={toggleLabel} aria-expanded={!collapsed} aria-controls="app-sidebar-navigation" title={toggleLabel}>
          {collapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
        </button>
      </div>

      <div id="app-sidebar-navigation" className="app-sidebar-navigation">
        <section className="app-sidebar-section">
          {!collapsed && <p className="app-sidebar-heading">PLATFORM</p>}
          <nav aria-label="Plataforma">
            {platformLinks.map(({ name, href, icon: Icon }) => {
              const active = pathname.startsWith(href) || (href === '/builder' && pathname.startsWith('/submissions'));
              return <Link key={href} href={href} className="app-sidebar-link" aria-label={name} aria-current={active ? 'page' : undefined} {...labelEvents(name)}>
                <Icon size={collapsed ? 17 : 19} aria-hidden="true" />
                {!collapsed && <span>{name}</span>}
              </Link>;
            })}
          </nav>
        </section>
        {recentLinks.length > 0 && <section className="app-sidebar-section app-sidebar-recent">
          {!collapsed && <p className="app-sidebar-heading">RECIENTES</p>}
          <nav aria-label="Submissions recientes">
            {recentLinks.map((link, index) => <Link key={`${link.href}-${index}`} href={link.href} className="app-sidebar-link" aria-label={link.name} title={link.name} {...labelEvents(link.name)}>
              <FileText size={16} aria-hidden="true" />
              {!collapsed && <span>{link.name}</span>}
            </Link>)}
          </nav>
        </section>}
        <section className="app-sidebar-section app-sidebar-account">
          {!collapsed && <p className="app-sidebar-heading">CUENTA</p>}
          <nav aria-label="Cuenta">
            {isAdmin && <Link href="/dashboard/admin" className="app-sidebar-link" aria-label="Admin Panel" aria-current={pathname.startsWith('/dashboard/admin') ? 'page' : undefined} {...labelEvents('Admin Panel')}>
              <Settings size={collapsed ? 17 : 19} aria-hidden="true" />{!collapsed && <span>Admin Panel</span>}
            </Link>}
            <button type="button" className="app-sidebar-link" aria-label="Cerrar sesión" {...labelEvents('Cerrar sesión')} onClick={() => {
              fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login'; });
            }}>
              <LogOut size={collapsed ? 17 : 19} aria-hidden="true" />{!collapsed && <span>Cerrar sesión</span>}
            </button>
          </nav>
        </section>
      </div>
      {collapsed && tooltip && <div role="tooltip" className="app-sidebar-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.text}</div>}
    </aside>
  );
}
