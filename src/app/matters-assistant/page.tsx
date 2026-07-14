'use client';

import { useState, useEffect } from 'react';
import { 
  CloudUpload, Sparkles, Folder, List, 
  CheckCircle2, Clock, Download, ChevronRight,
  Upload, FileText, Bot, Pencil, Trash2, Save, X, RotateCw, Loader2, FileCheck
} from 'lucide-react';
import { getAllUserMatters, deleteMatter, updateMatterInline, optimizeMatterWithAI } from '@/app/actions/matters';
import { createClient } from '@/utils/supabase/client';
import { useRef } from 'react';
import PremiumSelect from '@/components/PremiumSelect';
import { DIRECTORIES, REGIONS, PRACTICE_AREAS, JURISDICTIONS } from '@/lib/constants';

type Matter = {
  id: string;
  name: string;
  client: string;
  value: string;
  status: string;
  leadPartner: string;
  rawNotes: string | null;
  optimizedText: string | null;
  threadId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  submissionId: string | null;
  userId: string;
  firmId: string | null;
  source: string;
  practiceArea: string | null;
  jurisdiction: string | null;
  description: string | null;
  tags: string | null;
  submission?: {
    targetDirectory: string;
    practiceArea: string;
  } | null;
  firm?: {
    id: string;
    name: string;
  } | null;
  sources?: {
    id: string;
    fileName: string;
    fileType: string;
  }[];
};

export default function MattersAssistantPage() {
  const [activeTab, setActiveTab] = useState<'assistant' | 'repository'>('assistant');
  const [matters, setMatters] = useState<Matter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');

  // Editing State
  const [editingMatterId, setEditingMatterId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', client: '', value: '' });
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<string | null>(null);
  const [expandedMatterId, setExpandedMatterId] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'builder' | 'assistant' | 'manual'>('all');

  // Form State for Assistant
  const [directory, setDirectory] = useState('Chambers & Partners');
  const [guideRegion, setGuideRegion] = useState('Latin America');
  const [practiceArea, setPracticeArea] = useState('Banking & Finance');
  const [jurisdiction, setJurisdiction] = useState('Mexico');
  const [looseNotes, setLooseNotes] = useState('');

  // Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this matter?')) return;
    setIsDeleting(id);
    await deleteMatter(id);
    await loadMatters();
    setIsDeleting(null);
  };

  const startEditing = (m: Matter) => {
    setEditingMatterId(m.id);
    setEditForm({ name: m.name, client: m.client, value: m.value });
  };

  const saveEdit = async (id: string) => {
    await updateMatterInline(id, editForm);
    setEditingMatterId(null);
    await loadMatters();
  };

  const handleReOptimize = async (id: string) => {
    setIsOptimizing(id);
    await optimizeMatterWithAI(id);
    await loadMatters();
    setIsOptimizing(null);
  };

  const handleProcessMatter = async () => {
    if (!selectedFile && !looseNotes.trim()) {
      alert('Please upload a file or paste some text notes.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      let documentUrl = undefined;
      
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(`matters/${fileName}`, selectedFile);
          
        if (uploadError) throw new Error('Failed to upload file: ' + uploadError.message);
        
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(`matters/${fileName}`);
          
        documentUrl = publicUrl;
      }

      // We call the process-document route which will hit the Python Engine
      const res = await fetch('/api/process-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: documentUrl,
          text: looseNotes,
          is_file: !!documentUrl,
          context: { directory, practiceArea, jurisdiction, guideRegion }
        })
      });

      if (!res.ok) throw new Error('Failed to process matter with AI.');

      // Clear the form
      setSelectedFile(null);
      setLooseNotes('');
      
      // Reload Repository
      await loadMatters();
      setActiveTab('repository');
      alert('Matter processed and added to your repository successfully!');
    } catch (error: any) {
      alert(error.message);
    }
    setIsSubmitting(false);
  };

  const filteredMatters = matters.filter(m => {
    let pass = true;
    const mDate = new Date(m.createdAt).getTime();
    if (dateFilterStart && mDate < new Date(dateFilterStart).getTime()) pass = false;
    if (dateFilterEnd && mDate > new Date(dateFilterEnd).getTime() + 86400000) pass = false;
    if (sourceFilter !== 'all' && m.source !== sourceFilter) pass = false;
    if (repoSearch) {
      const q = repoSearch.toLowerCase();
      const searchable = `${m.name} ${m.client} ${m.firm?.name || ''} ${m.submission?.practiceArea || ''}`.toLowerCase();
      if (!searchable.includes(q)) pass = false;
    }
    return pass;
  });

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

            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', margin: '0 0 1rem 0' }}>Matter Context</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              <PremiumSelect
                label="Directory"
                value={directory}
                options={DIRECTORIES}
                onChange={setDirectory}
                id="assistant-directory"
              />
              <PremiumSelect
                label="Practice Area"
                value={practiceArea}
                options={PRACTICE_AREAS}
                onChange={setPracticeArea}
                id="assistant-practice"
              />
              <PremiumSelect
                label="Guide / Region"
                value={guideRegion}
                options={REGIONS}
                onChange={setGuideRegion}
                id="assistant-region"
              />
              <PremiumSelect
                label="Jurisdiction"
                value={jurisdiction}
                options={JURISDICTIONS}
                onChange={setJurisdiction}
                id="assistant-jurisdiction"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
              {/* Dropzone */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: selectedFile ? '2px solid #1A237E' : '2px dashed #D1D5DB', borderRadius: '0.75rem', padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: selectedFile ? '#E8EAF6' : '#F9FAFB', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept=".docx,.pdf,.doc,.txt"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                  />
                  
                  {selectedFile ? (
                    <>
                      <FileCheck style={{ color: '#1A237E', width: '2.5rem', height: '2.5rem', marginBottom: '0.75rem' }} />
                      <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1A237E', margin: '0 0 0.25rem 0' }}>Ready to Process</h4>
                      <p style={{ fontSize: '0.875rem', color: '#1A237E', margin: 0, fontWeight: 500 }}>{selectedFile.name}</p>
                      <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.5rem' }}>Click to select a different file</p>
                    </>
                  ) : (
                    <>
                      <CloudUpload style={{ color: '#1A237E', width: '2.5rem', height: '2.5rem', marginBottom: '0.75rem' }} />
                      <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', margin: '0 0 0.25rem 0' }}>Drag files here or click</h4>
                      <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0 }}>Maximum 1 file per matter · up to 25MB</p>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <span style={{ background: '#ffffff', border: '1px solid #E5E7EB', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: '#1A237E' }}>PDF</span>
                        <span style={{ background: '#ffffff', border: '1px solid #E5E7EB', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: '#1A237E' }}>DOCX</span>
                        <span style={{ background: '#ffffff', border: '1px solid #E5E7EB', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: '#1A237E' }}>TXT</span>
                      </div>
                    </>
                  )}
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
            <button 
              onClick={handleProcessMatter}
              disabled={isSubmitting || (!selectedFile && !looseNotes.trim())}
              style={{ 
                background: (!selectedFile && !looseNotes.trim()) ? '#9CA3AF' : '#1A237E', 
                color: '#ffffff', padding: '0.75rem 1.5rem', borderRadius: '0.375rem', fontWeight: 'bold', 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', 
                display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none',
                cursor: (!selectedFile && !looseNotes.trim()) || isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s'
              }} 
            >
              {isSubmitting ? (
                <><Loader2 style={{ width: '1rem', height: '1rem' }} className="animate-spin" /> Processing AI...</>
              ) : (
                <><Sparkles style={{ width: '1rem', height: '1rem' }} /> Generate Matter (v3)</>
              )}
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}} />

      {activeTab === 'repository' && (
        <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          <div style={{ background: '#ffffff', borderRadius: '0.75rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.25rem 0' }}>Matter Library</h2>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                    {matters.length} matter{matters.length !== 1 ? 's' : ''} · {filteredMatters.length} shown
                  </p>
                </div>
              </div>

              {/* Search + Source Filters */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search by matter, client, or firm..."
                    value={repoSearch}
                    onChange={e => setRepoSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.25rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', background: '#fff' }}
                  />
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.85rem' }}>🔍</span>
                </div>

                {/* Source filter pills */}
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  {(['all', 'builder', 'assistant', 'manual'] as const).map(src => (
                    <button
                      key={src}
                      onClick={() => setSourceFilter(src)}
                      style={{
                        padding: '0.4rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                        background: sourceFilter === src ? '#1A237E' : '#f1f5f9',
                        color: sourceFilter === src ? '#fff' : '#64748b',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {src === 'all' ? 'All' : src.charAt(0).toUpperCase() + src.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Date range */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="date" value={dateFilterStart} onChange={e => setDateFilterStart(e.target.value)} style={{ padding: '0.4rem 0.5rem', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', color: dateFilterStart ? '#0f172a' : '#94a3b8' }} />
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>to</span>
                  <input type="date" value={dateFilterEnd} onChange={e => setDateFilterEnd(e.target.value)} style={{ padding: '0.4rem 0.5rem', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', color: dateFilterEnd ? '#0f172a' : '#94a3b8' }} />
                  {(dateFilterStart || dateFilterEnd || repoSearch) && (
                    <button onClick={() => { setDateFilterStart(''); setDateFilterEnd(''); setRepoSearch(''); setSourceFilter('all'); }} style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {isLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>Loading your repository...</div>
            ) : filteredMatters.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <List style={{ height: '3rem', width: '3rem', color: '#D1D5DB', marginBottom: '1rem' }} />
                No matters found in your repository.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matter Details</th>
                      <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Firm · Source</th>
                      <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                      <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                      <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatters.map((m) => (
                      <>
                      <tr key={m.id} style={{ borderBottom: expandedMatterId === m.id ? 'none' : '1px solid #E5E7EB', transition: 'background 0.2s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.background = '#F9FAFB'} onMouseOut={e => e.currentTarget.style.background = expandedMatterId === m.id ? '#F8FAFF' : 'transparent'} onClick={() => setExpandedMatterId(expandedMatterId === m.id ? null : m.id)}>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          {editingMatterId === m.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                              <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #D1D5DB', borderRadius: '0.25rem', fontSize: '0.875rem', fontWeight: 'bold' }} />
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input type="text" value={editForm.client} onChange={e => setEditForm({...editForm, client: e.target.value})} placeholder="Client" style={{ width: '50%', padding: '0.25rem 0.5rem', border: '1px solid #D1D5DB', borderRadius: '0.25rem', fontSize: '0.75rem' }} />
                                <input type="text" value={editForm.value} onChange={e => setEditForm({...editForm, value: e.target.value})} placeholder="Value" style={{ width: '50%', padding: '0.25rem 0.5rem', border: '1px solid #D1D5DB', borderRadius: '0.25rem', fontSize: '0.75rem' }} />
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <ChevronRight size={14} style={{ color: '#9CA3AF', transition: 'transform 0.2s', transform: expandedMatterId === m.id ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }} />
                              <div>
                                <div style={{ fontWeight: 'bold', color: '#1A237E' }}>{m.name}</div>
                                <div style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.25rem' }}>Client: {m.client} | Value: {m.value}</div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1.5rem' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                              {m.firm?.name || m.submission?.targetDirectory || '—'}
                            </div>
                            <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.25rem', alignItems: 'center' }}>
                              <span style={{
                                display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.03em',
                                background: m.source === 'builder' ? '#EEF2FF' : m.source === 'assistant' ? '#ECFDF5' : '#FFFBEB',
                                color: m.source === 'builder' ? '#3730A3' : m.source === 'assistant' ? '#065F46' : '#92400E',
                                border: `1px solid ${m.source === 'builder' ? '#C7D2FE' : m.source === 'assistant' ? '#A7F3D0' : '#FDE68A'}`,
                              }}>
                                {m.source || 'builder'}
                              </span>
                              {m.submission?.practiceArea && (
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{m.submission.practiceArea}</span>
                              )}
                            </div>
                          </div>
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
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            {editingMatterId === m.id ? (
                              <>
                                <button onClick={() => saveEdit(m.id)} style={{ padding: '0.375rem', background: '#10B981', color: '#fff', borderRadius: '0.375rem', border: 'none', cursor: 'pointer' }} title="Save">
                                  <Save size={14} />
                                </button>
                                <button onClick={() => setEditingMatterId(null)} style={{ padding: '0.375rem', background: '#9CA3AF', color: '#fff', borderRadius: '0.375rem', border: 'none', cursor: 'pointer' }} title="Cancel">
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => handleReOptimize(m.id)} disabled={isOptimizing === m.id} style={{ padding: '0.375rem', background: '#DBEAFE', color: '#2563EB', borderRadius: '0.375rem', border: 'none', cursor: isOptimizing === m.id ? 'wait' : 'pointer', opacity: isOptimizing === m.id ? 0.5 : 1 }} title="Optimize again">
                                  <RotateCw size={14} className={isOptimizing === m.id ? "animate-spin" : ""} />
                                </button>
                                <button onClick={() => startEditing(m)} style={{ padding: '0.375rem', background: '#F3F4F6', color: '#4B5563', borderRadius: '0.375rem', border: 'none', cursor: 'pointer' }} title="Edit">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => handleDelete(m.id)} disabled={isDeleting === m.id} style={{ padding: '0.375rem', background: '#FEE2E2', color: '#DC2626', borderRadius: '0.375rem', border: 'none', cursor: isDeleting === m.id ? 'wait' : 'pointer', opacity: isDeleting === m.id ? 0.5 : 1 }} title="Delete">
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Expanded Detail Panel */}
                      {expandedMatterId === m.id && (
                        <tr key={`${m.id}-detail`}>
                          <td colSpan={5} style={{ padding: 0, borderBottom: '1px solid #E5E7EB' }}>
                            <div style={{ background: '#F8FAFF', padding: '1.5rem 2rem', borderTop: '2px solid #1A237E', animation: 'fadeIn 0.2s ease-in' }}>
                              {/* Header row */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1A237E', margin: '0 0 0.25rem' }}>{m.name}</h3>
                                  <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: 0 }}>
                                    {m.submission?.targetDirectory} · {m.submission?.practiceArea}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Client</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>{m.client || 'N/A'}</div>
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Value</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>{m.value || 'N/A'}</div>
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Lead Partner</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>{m.leadPartner || 'N/A'}</div>
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Status</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: m.status === 'AI Optimized' ? '#16a34a' : '#d97706' }}>{m.status}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Content Grid: Raw Notes vs Optimized Text */}
                              <div style={{ display: 'grid', gridTemplateColumns: m.optimizedText ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                                {/* Raw Notes */}
                                <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '1.25rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <FileText size={14} style={{ color: '#6B7280' }} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Raw Notes / Input</span>
                                  </div>
                                  <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                                    {m.rawNotes || 'No raw notes available for this matter.'}
                                  </p>
                                </div>

                                {/* Optimized Text */}
                                {m.optimizedText && (
                                  <div style={{ background: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0', padding: '1.25rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                      <Sparkles size={14} style={{ color: '#16a34a' }} />
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>AI Optimized Version</span>
                                    </div>
                                    <p style={{ fontSize: '0.875rem', color: '#1e293b', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                                      {m.optimizedText}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Footer metadata */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #E5E7EB' }}>
                                <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                                  Created: {new Date(m.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  {m.updatedAt && ` · Updated: ${new Date(m.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>ID: {m.id.slice(0, 8)}...</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </>
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
