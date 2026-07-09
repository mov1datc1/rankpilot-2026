'use client';

import { useState, useEffect } from 'react';
import { 
  CloudUpload, Sparkles, Folder, List, 
  CheckCircle2, Clock, Download, ChevronRight,
  Upload, FileText, Bot
} from 'lucide-react';
import { getAllUserMatters } from '@/app/actions/matters';

type Matter = {
  id: string;
  name: string;
  client: string;
  value: string;
  status: string;
  createdAt: Date | string;
  submission?: {
    targetDirectory: string;
    practiceArea: string;
  };
};

export default function MattersAssistantPage() {
  const [activeTab, setActiveTab] = useState<'assistant' | 'repository'>('assistant');
  const [matters, setMatters] = useState<Matter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State for Assistant
  const [directory, setDirectory] = useState('Chambers');
  const [guideRegion, setGuideRegion] = useState('');
  const [practiceArea, setPracticeArea] = useState('Banking & Finance');
  const [jurisdiction, setJurisdiction] = useState('Mexico');
  const [looseNotes, setLooseNotes] = useState('');

  useEffect(() => {
    if (activeTab === 'repository') {
      loadMatters();
    }
  }, [activeTab]);

  async function loadMatters() {
    setIsLoading(true);
    const res = await getAllUserMatters();
    if (res.success && res.data) {
      setMatters(res.data);
    }
    setIsLoading(false);
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles style={{ color: '#1A237E', width: '2rem', height: '2rem' }} />
          Matters Assistant
        </h1>
        <p style={{ color: '#6B7280', marginTop: '0.5rem', fontSize: '1.125rem' }}>
          Turn your scattered inputs into publishable matters, or manage your portfolio.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(229, 231, 235, 0.5)', padding: '0.25rem', borderRadius: '0.5rem', width: 'fit-content', marginBottom: '2rem' }}>
        <button
          onClick={() => setActiveTab('assistant')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, transition: 'all 0.2s',
            background: activeTab === 'assistant' ? '#ffffff' : 'transparent',
            color: activeTab === 'assistant' ? '#1A237E' : '#4B5563',
            boxShadow: activeTab === 'assistant' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
            border: 'none', cursor: 'pointer'
          }}
        >
          <Bot style={{ width: '1rem', height: '1rem' }} />
          <span>AI Assistant</span>
        </button>
        <button
          onClick={() => setActiveTab('repository')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, transition: 'all 0.2s',
            background: activeTab === 'repository' ? '#ffffff' : 'transparent',
            color: activeTab === 'repository' ? '#1A237E' : '#4B5563',
            boxShadow: activeTab === 'repository' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
            border: 'none', cursor: 'pointer'
          }}
        >
          <Folder style={{ width: '1rem', height: '1rem' }} />
          <span>Matters Repository</span>
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'assistant' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease-in-out' }}>
          
          <div style={{ background: '#ffffff', borderRadius: '0.75rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', border: '1px solid #E5E7EB', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '2rem', background: '#E8EAF6', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #C5CAE9' }}>
              <div style={{ background: '#1A237E', padding: '0.5rem', borderRadius: '9999px', flexShrink: 0 }}>
                <Sparkles style={{ color: '#ffffff', width: '1.25rem', height: '1.25rem' }} />
              </div>
              <div>
                <h3 style={{ fontWeight: 'bold', color: '#1A237E', margin: 0 }}>RankPilot · Matters Assistant</h3>
                <p style={{ fontSize: '0.875rem', color: '#4B5563', marginTop: '0.25rem', margin: '0.25rem 0 0 0' }}>
                  The more sources you provide, the more complete the matter will be. Upload documents (PDF, DOCX) or simply paste loose text and attorney notes below. We will structure it perfectly.
                </p>
              </div>
            </div>

            <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', margin: '0 0 1rem 0' }}>Matter Context</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Directory</label>
                <select 
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.375rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', outline: 'none' }}
                  value={directory} onChange={e => setDirectory(e.target.value)}
                >
                  <option>Chambers</option>
                  <option>Legal 500</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Practice Area</label>
                <select 
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.375rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', outline: 'none' }}
                  value={practiceArea} onChange={e => setPracticeArea(e.target.value)}
                >
                  <option>Banking & Finance</option>
                  <option>Corporate / M&A</option>
                  <option>Dispute Resolution</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Jurisdiction</label>
                <input 
                  type="text" 
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.375rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', outline: 'none' }}
                  value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
              {/* Dropzone */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ border: '2px dashed #D1D5DB', borderRadius: '0.75rem', padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: '#F9FAFB', cursor: 'pointer' }}>
                  <CloudUpload style={{ color: '#1A237E', width: '2.5rem', height: '2.5rem', marginBottom: '0.75rem' }} />
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', margin: '0 0 0.25rem 0' }}>Drag files here or click</h4>
                  <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0 }}>Maximum 10 files · up to 25MB each</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <span style={{ background: '#ffffff', border: '1px solid #E5E7EB', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: '#1A237E' }}>PDF</span>
                    <span style={{ background: '#ffffff', border: '1px solid #E5E7EB', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: '#1A237E' }}>DOCX</span>
                    <span style={{ background: '#ffffff', border: '1px solid #E5E7EB', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: '#1A237E' }}>TXT</span>
                  </div>
                </div>
                
                <div style={{ position: 'relative', display: 'flex', padding: '0.5rem 0', alignItems: 'center' }}>
                  <div style={{ flexGrow: 1, borderTop: '1px solid #E5E7EB' }}></div>
                  <span style={{ flexShrink: 0, margin: '0 1rem', color: '#9CA3AF', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>or paste text / emails directly</span>
                  <div style={{ flexGrow: 1, borderTop: '1px solid #E5E7EB' }}></div>
                </div>

                <textarea 
                  rows={6}
                  placeholder="Paste a forwarded email, partner notes, deal description, or any loose text..."
                  style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: '0.75rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', padding: '1rem', outline: 'none', fontFamily: 'inherit' }}
                  value={looseNotes}
                  onChange={e => setLooseNotes(e.target.value)}
                ></textarea>
              </div>

              {/* Sidebar Sources */}
              <div style={{ background: '#F9FAFB', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px' }}>
                <FileText style={{ color: '#D1D5DB', width: '3rem', height: '3rem', marginBottom: '0.75rem' }} />
                <h4 style={{ fontWeight: 'bold', color: '#374151', margin: 0 }}>No sources yet</h4>
                <p style={{ fontSize: '0.875rem', color: '#6B7280', textAlign: 'center', marginTop: '0.5rem', margin: '0.5rem 0 0 0' }}>Add files or paste text to get started.</p>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem' }}>
            <button style={{ background: '#1A237E', color: '#ffffff', padding: '0.75rem 1.5rem', borderRadius: '0.375rem', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.5, cursor: 'not-allowed', border: 'none' }} disabled>
              <Sparkles style={{ width: '1rem', height: '1rem' }} />
              Generate Matter (v3)
            </button>
          </div>
        </div>
      )}

      {activeTab === 'repository' && (
        <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          <div style={{ background: '#ffffff', borderRadius: '0.75rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', margin: '0 0 0.25rem 0' }}>Portfolio & Extracted Matters</h2>
                <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0 }}>Review all matters automatically extracted from your builders or manually processed.</p>
              </div>
            </div>
            
            {isLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>Loading your repository...</div>
            ) : matters.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <List style={{ height: '3rem', width: '3rem', color: '#D1D5DB', marginBottom: '1rem' }} />
                No matters found in your repository yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matter Details</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Builder Reference</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matters.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #E5E7EB', transition: 'background 0.2s', cursor: 'default' }} onMouseOver={e => e.currentTarget.style.background = '#F9FAFB'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ fontWeight: 'bold', color: '#1A237E' }}>{m.name}</div>
                          <div style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.25rem' }}>Client: {m.client} | Value: {m.value}</div>
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          {m.submission ? (
                            <div>
                              <div style={{ fontWeight: 500, color: '#111827' }}>{m.submission.targetDirectory}</div>
                              <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{m.submission.practiceArea}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Independent</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#4B5563' }}>
                          {new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          {m.status === 'AI Optimized' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: '#F0FDF4', color: '#15803D', padding: '0.25rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #BBF7D0' }}>
                              <CheckCircle2 style={{ height: '0.875rem', width: '0.875rem' }} /> AI Optimized
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: '#FFFBEB', color: '#B45309', padding: '0.25rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #FDE68A' }}>
                              <Clock style={{ height: '0.875rem', width: '0.875rem' }} /> Draft
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
