'use client';

import { Search, Bell, LogOut, X } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function Topbar() {
  const [userEmail, setUserEmail] = useState<string>('Loading...');
  const [userInitials, setUserInitials] = useState<string>('..');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const router = useRouter();

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; href: string; type: string }[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // Notifications state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; text: string; time: string; read: boolean }[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const email = session.user.email || '';
        setUserEmail(email);
        setUserInitials(email.substring(0, 2).toUpperCase());
      } else {
        setUserEmail('Guest');
        setUserInitials('GU');
      }
    };
    getUser();

    // Load notifications from recent submissions
    fetch('/api/recent-submissions')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.items) {
          setNotifications(data.items.slice(0, 4).map((item: any, i: number) => ({
            id: String(i),
            text: `Analysis completed: ${item.name}`,
            time: 'Recently',
            read: i > 0,
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Search handler
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      fetch(`/api/recent-submissions`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.items) {
            const q = searchQuery.toLowerCase();
            const filtered = data.items
              .filter((item: any) => item.name.toLowerCase().includes(q))
              .map((item: any) => ({ name: item.name, href: item.href, type: 'Report' }));
            
            // Add module links
            const modules = [
              { name: 'Matter Assistant', href: '/matters-assistant', type: 'Module' },
              { name: 'Builder', href: '/submissions', type: 'Module' },
              { name: 'Reports', href: '/reports', type: 'Module' },
              { name: 'Dashboard', href: '/dashboard-analytics', type: 'Module' },
              { name: 'Settings', href: '/dashboard/admin', type: 'Module' },
            ].filter(m => m.name.toLowerCase().includes(q));

            setSearchResults([...modules, ...filtered].slice(0, 6));
          }
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Focus input when search opens
  useEffect(() => {
    if (showSearch) searchRef.current?.focus();
  }, [showSearch]);

  // Keyboard shortcut ⌘K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      if (e.key === 'Escape') { setShowSearch(false); setShowNotifications(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      <header style={{
        height: '64px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}>
        <div style={{ flex: 1 }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* Search Button */}
          <button 
            onClick={() => setShowSearch(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            title="Search (⌘K)"
          >
            <Search size={20} />
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>⌘K</span>
          </button>

          {/* Notifications Button */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowNotifications(prev => !prev)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', position: 'relative' }}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px',
                  borderRadius: '50%', background: '#EF4444', color: '#fff', fontSize: '0.6rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                }}>{unreadCount}</span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem',
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
                boxShadow: '0 10px 25px -3px rgba(0,0,0,0.12)', width: '320px', zIndex: 50,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No notifications yet</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} style={{
                      padding: '0.75rem 1.25rem', borderBottom: '1px solid #f1f5f9',
                      background: n.read ? 'transparent' : '#F0F9FF', cursor: 'pointer',
                    }} onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}>
                      <p style={{ fontSize: '0.8rem', color: '#0f172a', margin: '0 0 0.25rem', fontWeight: n.read ? 400 : 600 }}>{n.text}</p>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{n.time}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* User Profile */}
          <div style={{ position: 'relative' }}>
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.5rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', transition: 'background 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ 
                width: '36px', height: '36px', 
                borderRadius: '50%', 
                background: '#2563eb', 
                color: '#ffffff', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 600, fontSize: '0.9rem'
              }}>
                {userInitials}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.2, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Pro Plan</span>
              </div>
            </div>
            
            {isDropdownOpen && (
              <div style={{ 
                position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', 
                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', width: '200px', zIndex: 50 
              }}>
                <div style={{ padding: '0.5rem' }}>
                  <button 
                    onClick={handleLogout}
                    style={{ 
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', 
                      padding: '0.75rem', background: 'transparent', border: 'none', 
                      borderRadius: '6px', color: '#ef4444', fontWeight: 500, cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Command Palette / Search Overlay */}
      {showSearch && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', justifyContent: 'center', paddingTop: '15vh' }}
          onClick={() => setShowSearch(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '16px', width: '520px', maxHeight: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', overflow: 'hidden', animation: 'scaleIn 0.15s ease-out' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
              <Search size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search reports, modules, or firms..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1rem', color: '#0f172a' }}
              />
              <button onClick={() => setShowSearch(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.7rem', color: '#64748b', cursor: 'pointer', fontWeight: 600 }}>ESC</button>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {searchResults.length === 0 && searchQuery && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No results found</div>
              )}
              {searchResults.map((r, i) => (
                <div
                  key={i}
                  onClick={() => { router.push(r.href); setShowSearch(false); setSearchQuery(''); }}
                  style={{ padding: '0.75rem 1.25rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f8fafc' }}
                  onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 500 }}>{r.name}</span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>{r.type}</span>
                </div>
              ))}
            </div>
          </div>
          <style dangerouslySetInnerHTML={{__html: `@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}} />
        </div>
      )}
    </>
  );
}
