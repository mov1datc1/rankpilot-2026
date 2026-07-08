'use client';

import { useState } from 'react';
import { Plus, Search, MoreHorizontal, Sparkles, X, CheckCircle2 } from 'lucide-react';

type Matter = {
  id: string;
  name: string;
  client: string;
  value: string;
  partner: string;
  status: 'Draft' | 'AI Optimized';
};

const MOCK_MATTERS: Matter[] = [
  { id: '1', name: 'Acquisition of TechNova', client: 'TechNova Inc.', value: '$450M', partner: 'John Doe', status: 'AI Optimized' },
  { id: '2', name: 'Series B Funding', client: 'HealthStart', value: '$50M', partner: 'Jane Smith', status: 'Draft' },
];

export default function MattersAssistantPage() {
  const [matters, setMatters] = useState<Matter[]>(MOCK_MATTERS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedText, setOptimizedText] = useState('');
  
  // Form State
  const [matterName, setMatterName] = useState('');
  const [rawNotes, setRawNotes] = useState('');

  const handleOptimize = () => {
    setIsOptimizing(true);
    // Simulate AI delay
    setTimeout(() => {
      setOptimizedText("In Q3 2026, the firm successfully represented TechNova Inc. in a highly complex $450M cross-border acquisition. This transaction involved navigating unprecedented regulatory hurdles in three jurisdictions, showcasing the department's unparalleled expertise in multinational M&A and regulatory compliance.");
      setIsOptimizing(false);
    }, 2000);
  };

  const handleSave = () => {
    const newMatter: Matter = {
      id: Date.now().toString(),
      name: matterName || 'New Matter',
      client: 'Pending',
      value: 'Pending',
      partner: 'Pending',
      status: optimizedText ? 'AI Optimized' : 'Draft'
    };
    setMatters([newMatter, ...matters]);
    setIsModalOpen(false);
    setMatterName('');
    setRawNotes('');
    setOptimizedText('');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '4rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>Matters Assistant</h1>
          <p style={{ fontSize: '1.1rem', color: '#64748b', margin: 0 }}>Manage and AI-optimize your key cases for the submission.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ background: '#2563eb', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
        >
          <Plus size={18} /> New Matter
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input type="text" placeholder="Search matters..." style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }} />
        </div>
        <button style={{ padding: '0.75rem 1.5rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#475569', fontWeight: 500, cursor: 'pointer' }}>Filter</button>
      </div>

      {/* Data Table */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Matter Name</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Client</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Value</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Lead Partner</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '1rem 1.5rem', width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {matters.map((matter, idx) => (
              <tr key={matter.id} style={{ borderBottom: idx === matters.length - 1 ? 'none' : '1px solid #e2e8f0', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '1rem 1.5rem', fontWeight: 500, color: '#0f172a' }}>{matter.name}</td>
                <td style={{ padding: '1rem 1.5rem', color: '#475569' }}>{matter.client}</td>
                <td style={{ padding: '1rem 1.5rem', color: '#475569' }}>{matter.value}</td>
                <td style={{ padding: '1rem 1.5rem', color: '#475569' }}>{matter.partner}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <span style={{ 
                    padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                    background: matter.status === 'AI Optimized' ? '#dcfce7' : '#f1f5f9',
                    color: matter.status === 'AI Optimized' ? '#15803d' : '#64748b'
                  }}>
                    {matter.status}
                  </span>
                </td>
                <td style={{ padding: '1rem 1.5rem', color: '#94a3b8', cursor: 'pointer' }}><MoreHorizontal size={18} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {matters.length === 0 && (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
            No matters added yet. Click "New Matter" to start.
          </div>
        )}
      </div>

      {/* PRO Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: '800px', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: '#2563eb', color: '#fff', padding: '0.4rem', borderRadius: '8px' }}><Zap size={20} /></div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>New Matter</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Matter Name (Internal)</label>
                <input value={matterName} onChange={e => setMatterName(e.target.value)} type="text" placeholder="e.g. Project Apollo" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Lawyer's Raw Notes</label>
                <textarea value={rawNotes} onChange={e => setRawNotes(e.target.value)} placeholder="Paste rough notes, bullet points, or emails here..." style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', minHeight: '120px', resize: 'vertical' }} />
              </div>

              {/* AI Optimization Section */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sparkles size={18} /> RankPilot AI Optimizer
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#2563eb' }}>Transform raw notes into a directory-standard submission narrative.</p>
                  </div>
                  {!optimizedText && (
                    <button 
                      onClick={handleOptimize}
                      disabled={isOptimizing || !rawNotes}
                      style={{ background: '#2563eb', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: (isOptimizing || !rawNotes) ? 'not-allowed' : 'pointer', opacity: (isOptimizing || !rawNotes) ? 0.7 : 1 }}
                    >
                      {isOptimizing ? 'Optimizing...' : 'Optimize'}
                    </button>
                  )}
                </div>

                {optimizedText && (
                  <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #93c5fd', fontSize: '0.95rem', color: '#334155', lineHeight: 1.6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#16a34a', fontWeight: 600, fontSize: '0.85rem' }}>
                      <CheckCircle2 size={16} /> Optimized successfully
                    </div>
                    {optimizedText}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ padding: '0.75rem 1.5rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} style={{ padding: '0.75rem 2rem', background: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Save Matter</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
