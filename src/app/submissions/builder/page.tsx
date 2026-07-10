'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Save, Trash2, Sparkles, Loader2, ArrowRight, FileText } from 'lucide-react';
import { createMatter } from '@/app/actions/matters';

type MatterDraft = {
  id: string;
  name: string;
  client: string;
  value: string;
  leadPartner: string;
  rawNotes: string;
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
      saved: false,
    }]);
  };

  const updateMatter = (id: string, field: keyof MatterDraft, value: string) => {
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

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={28} style={{ color: '#2563eb' }} /> Build Submission
        </h1>
        <p style={{ fontSize: '1rem', color: '#64748b', marginTop: '0.25rem' }}>
          Manually add matters to your submission. Each matter will be processed and optimized by AI.
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1A237E', margin: 0 }}>
                Matter #{idx + 1}
                {m.saved && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#16a34a', fontWeight: 500 }}>✓ Saved</span>}
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const }}>Matter Name *</label>
                <input
                  type="text"
                  value={m.name}
                  onChange={e => updateMatter(m.id, 'name', e.target.value)}
                  placeholder="e.g., Cross-Border Acquisition of TechCorp"
                  disabled={m.saved}
                  style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.875rem', background: m.saved ? '#f0fdf4' : '#fff' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const }}>Client</label>
                <input
                  type="text"
                  value={m.client}
                  onChange={e => updateMatter(m.id, 'client', e.target.value)}
                  placeholder="e.g., JP Morgan Chase"
                  disabled={m.saved}
                  style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.875rem', background: m.saved ? '#f0fdf4' : '#fff' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const }}>Deal Value</label>
                <input
                  type="text"
                  value={m.value}
                  onChange={e => updateMatter(m.id, 'value', e.target.value)}
                  placeholder="e.g., USD 150M"
                  disabled={m.saved}
                  style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.875rem', background: m.saved ? '#f0fdf4' : '#fff' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const }}>Lead Partner</label>
                <input
                  type="text"
                  value={m.leadPartner}
                  onChange={e => updateMatter(m.id, 'leadPartner', e.target.value)}
                  placeholder="e.g., Carlos Pérez"
                  disabled={m.saved}
                  style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.875rem', background: m.saved ? '#f0fdf4' : '#fff' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const }}>Raw Notes / Description</label>
              <textarea
                value={m.rawNotes}
                onChange={e => updateMatter(m.id, 'rawNotes', e.target.value)}
                placeholder="Describe the matter: complexity, cross-border elements, transaction mechanics, who did what, and why it matters competitively..."
                disabled={m.saved}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.875rem', minHeight: '100px', resize: 'vertical', lineHeight: 1.5, background: m.saved ? '#f0fdf4' : '#fff', fontFamily: 'inherit' }}
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
