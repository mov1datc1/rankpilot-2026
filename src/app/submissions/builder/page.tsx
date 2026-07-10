'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Save, Trash2, Sparkles, Loader2, ArrowRight, FileText, Shield, Globe } from 'lucide-react';
import { createMatter } from '@/app/actions/matters';

type MatterDraft = {
  id: string;
  name: string;
  client: string;
  value: string;
  leadPartner: string;
  rawNotes: string;
  isConfidential: boolean;
  crossBorder: string;
  teamMembers: string;
  otherFirms: string;
  completionDate: string;
  otherInfo: string;
  isNewClient: boolean;
  saved: boolean;
};

export default function SubmissionBuilderPage() {
  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading builder...</div>}>
      <BuilderContent />
    </Suspense>
  );
}

function BuilderContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const submissionId = searchParams.get('id') || '';
  const [matters, setMatters] = useState<MatterDraft[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  useEffect(() => {
    if (!submissionId) {
      router.push('/submissions');
      return;
    }
    // Start with one empty matter
    addMatter();
  }, []);

  const addMatter = () => {
    setMatters(prev => [...prev, {
      id: `draft-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: '',
      client: '',
      value: '',
      leadPartner: '',
      rawNotes: '',
      isConfidential: false,
      crossBorder: '',
      teamMembers: '',
      otherFirms: '',
      completionDate: '',
      otherInfo: '',
      isNewClient: false,
      saved: false,
    }]);
  };

  const updateMatter = (id: string, field: keyof MatterDraft, value: any) => {
    setMatters(prev => prev.map(m => m.id === id ? { ...m, [field]: value, saved: false } : m));
  };

  const removeMatter = (id: string) => {
    setMatters(prev => prev.filter(m => m.id !== id));
  };

  const saveMatter = async (draft: MatterDraft) => {
    if (!draft.name.trim()) {
      alert('Please enter a matter name.');
      return;
    }
    setSavingId(draft.id);
    const result = await createMatter({
      submissionId,
      name: draft.name,
      client: draft.client,
      value: draft.value,
      leadPartner: draft.leadPartner,
      rawNotes: draft.rawNotes,
      isConfidential: draft.isConfidential,
      crossBorder: draft.crossBorder,
      teamMembers: draft.teamMembers,
      otherFirms: draft.otherFirms,
      completionDate: draft.completionDate,
      otherInfo: draft.otherInfo,
      isNewClient: draft.isNewClient,
    });
    if (result.success) {
      setMatters(prev => prev.map(m => m.id === draft.id ? { ...m, saved: true } : m));
    } else {
      alert('Error saving matter: ' + result.error);
    }
    setSavingId(null);
  };

  const saveAllAndProcess = async () => {
    const unsaved = matters.filter(m => !m.saved && m.name.trim());
    if (unsaved.length === 0 && matters.filter(m => m.saved).length === 0) {
      alert('Please add and save at least one matter before processing.');
      return;
    }
    setSavingAll(true);
    for (const draft of unsaved) {
      await saveMatter(draft);
    }
    // Redirect to processing
    router.push(`/submissions/processing?id=${submissionId}`);
  };

  // Shared input style
  const inputStyle = (disabled: boolean) => ({
    padding: '0.6rem', borderRadius: '6px', border: '1px solid #D1D5DB',
    fontSize: '0.875rem', background: disabled ? '#f0fdf4' : '#fff', width: '100%',
  });

  const labelStyle = {
    fontSize: '0.75rem', fontWeight: 600 as const, color: '#6B7280', textTransform: 'uppercase' as const,
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={28} style={{ color: '#2563eb' }} /> Build Submission
        </h1>
        <p style={{ fontSize: '1rem', color: '#64748b', marginTop: '0.25rem' }}>
          Add matters with all Chambers-required fields. Each matter will be processed and optimized by AI.
        </p>
      </div>

      {/* Matter Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        {matters.map((m, idx) => (
          <div
            key={m.id}
            style={{
              background: m.saved ? '#F0FDF4' : '#ffffff',
              border: m.saved ? '1px solid #BBF7D0' : '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.2s',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1A237E', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Matter #{idx + 1}
                {m.saved && <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 500 }}>✓ Saved</span>}
                {m.isConfidential && (
                  <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontWeight: 600 }}>
                    <Shield size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />CONFIDENTIAL
                  </span>
                )}
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {/* Confidential Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: m.isConfidential ? '#92400e' : '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={m.isConfidential}
                    onChange={e => updateMatter(m.id, 'isConfidential', e.target.checked)}
                    disabled={m.saved}
                    style={{ accentColor: '#f59e0b' }}
                  />
                  Confidential (Section E)
                </label>
                {!m.saved && (
                  <button
                    onClick={() => saveMatter(m)}
                    disabled={savingId === m.id}
                    style={{ padding: '0.375rem 0.75rem', background: '#3b82f6', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem', opacity: savingId === m.id ? 0.6 : 1 }}
                  >
                    {savingId === m.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {savingId === m.id ? 'Saving...' : 'Save'}
                  </button>
                )}
                <button
                  onClick={() => removeMatter(m.id)}
                  style={{ padding: '0.375rem', background: '#FEE2E2', color: '#DC2626', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Row 1: Core Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Matter Name *</label>
                <input type="text" value={m.name} onChange={e => updateMatter(m.id, 'name', e.target.value)} placeholder="e.g., Cross-Border Acquisition of TechCorp" disabled={m.saved} style={inputStyle(m.saved)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Client</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="text" value={m.client} onChange={e => updateMatter(m.id, 'client', e.target.value)} placeholder="e.g., JP Morgan Chase" disabled={m.saved} style={{ ...inputStyle(m.saved), flex: 1 }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={m.isNewClient} onChange={e => updateMatter(m.id, 'isNewClient', e.target.checked)} disabled={m.saved} />
                    New
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Deal Value (currency + amount)</label>
                <input type="text" value={m.value} onChange={e => updateMatter(m.id, 'value', e.target.value)} placeholder="e.g., USD 150M" disabled={m.saved} style={inputStyle(m.saved)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Lead Partner</label>
                <input type="text" value={m.leadPartner} onChange={e => updateMatter(m.id, 'leadPartner', e.target.value)} placeholder="e.g., Carlos Pérez" disabled={m.saved} style={inputStyle(m.saved)} />
              </div>
            </div>

            {/* Row 2: Extended Chambers Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>
                  <Globe size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                  Cross-border jurisdictions
                </label>
                <input type="text" value={m.crossBorder} onChange={e => updateMatter(m.id, 'crossBorder', e.target.value)} placeholder="e.g., USA, Mexico, Chile" disabled={m.saved} style={inputStyle(m.saved)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Other Team Members</label>
                <input type="text" value={m.teamMembers} onChange={e => updateMatter(m.id, 'teamMembers', e.target.value)} placeholder="e.g., Ana López, Juan Díaz" disabled={m.saved} style={inputStyle(m.saved)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Other Firms Advising</label>
                <input type="text" value={m.otherFirms} onChange={e => updateMatter(m.id, 'otherFirms', e.target.value)} placeholder="e.g., Simpson Thacher (NY counsel)" disabled={m.saved} style={inputStyle(m.saved)} />
              </div>
            </div>

            {/* Row 3: Completion + Other Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Completion Date / Status</label>
                <input type="text" value={m.completionDate} onChange={e => updateMatter(m.id, 'completionDate', e.target.value)} placeholder="e.g., Completed June 2026" disabled={m.saved} style={inputStyle(m.saved)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Other Info (press coverage, links)</label>
                <input type="text" value={m.otherInfo} onChange={e => updateMatter(m.id, 'otherInfo', e.target.value)} placeholder="e.g., Featured in Latin Lawyer: https://..." disabled={m.saved} style={inputStyle(m.saved)} />
              </div>
            </div>

            {/* Raw Notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={labelStyle}>Raw Notes / Description (AI will optimize this)</label>
              <textarea
                value={m.rawNotes}
                onChange={e => updateMatter(m.id, 'rawNotes', e.target.value)}
                placeholder="Describe the matter: complexity, cross-border elements, transaction mechanics, who did what, and why it matters competitively..."
                disabled={m.saved}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.875rem', minHeight: '100px', resize: 'vertical', lineHeight: 1.5, background: m.saved ? '#f0fdf4' : '#fff', fontFamily: 'inherit', width: '100%' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={addMatter}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', background: '#f1f5f9', color: '#475569', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem' }}
        >
          <Plus size={18} /> Add Another Matter
        </button>

        <button
          onClick={saveAllAndProcess}
          disabled={savingAll || matters.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem',
            background: savingAll ? '#94a3b8' : '#1A237E', color: '#fff',
            borderRadius: '8px', border: 'none', cursor: savingAll ? 'wait' : 'pointer',
            fontWeight: 600, fontSize: '0.95rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
          }}
        >
          {savingAll ? <><Loader2 size={18} className="animate-spin" /> Saving & Processing...</> : <><Sparkles size={18} /> Save All & Process with AI <ArrowRight size={16} /></>}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
