'use client';

import { Search, Bell } from 'lucide-react';

export default function Topbar() {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.5rem' }}>
          <div style={{ 
            width: '36px', height: '36px', 
            borderRadius: '50%', 
            background: '#2563eb', 
            color: '#ffffff', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600, fontSize: '0.9rem'
          }}>
            MM
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>Mauro Molina</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Pro Plan</span>
          </div>
        </div>
      </div>
    </header>
  );
}
