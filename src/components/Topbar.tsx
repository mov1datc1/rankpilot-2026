'use client';

import { Search, Bell, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function Topbar() {
  const [userEmail, setUserEmail] = useState<string>('Loading...');
  const [userInitials, setUserInitials] = useState<string>('...');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const router = useRouter();

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
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };
  return (
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
      {/* Left side can hold page title or breadcrumbs if needed, currently empty to match design */}
      <div style={{ flex: 1 }}></div>

      {/* Right side actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
          <Search size={20} />
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
          <Bell size={20} />
        </button>

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
  );
}
