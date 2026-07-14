'use client';

import { useState, useRef } from 'react';
import { Upload, Loader2, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function SupplementalUpload({ submissionId }: { submissionId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleSubmit = async () => {
    if (!file && !notes.trim()) return;
    setIsProcessing(true);
    try {
      let documentUrl = undefined;
      if (file) {
        const ext = file.name.split('.').pop();
        const fname = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error } = await supabase.storage.from('documents').upload(`submissions/${fname}`, file);
        if (error) throw new Error('Upload failed: ' + error.message);
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(`submissions/${fname}`);
        documentUrl = publicUrl;
      }

      const res = await fetch('/api/process-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          url: documentUrl,
          text: notes,
          is_file: !!documentUrl,
          mode: 'supplement',
        }),
      });

      if (!res.ok) throw new Error('Processing failed');

      // Reload the page to show updated analysis
      window.location.reload();
    } catch (e: any) {
      alert(e.message);
      setIsProcessing(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.65rem 1.25rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700,
          background: 'linear-gradient(135deg, #1A237E 0%, #283593 100%)', color: '#ffffff',
          cursor: 'pointer', border: 'none',
          boxShadow: '0 2px 6px rgba(26, 35, 126, 0.3)',
        }}
      >
        📎 Upload Supplemental Evidence
      </button>
    );
  }

  return (
    <div style={{ background: '#F8FAFC', borderRadius: '12px', border: '1.5px solid #C7D2FE', padding: '1.25rem', marginTop: '0.75rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1A237E' }}>Upload Evidence to Strengthen This Analysis</span>
        <button onClick={() => { setIsOpen(false); setFile(null); setNotes(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>
      
      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
        Upload additional documents (emails, PDFs, client testimonials) or paste notes. 
        The AI will re-analyze this submission with the new evidence and update your audit letter.
      </p>

      <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.eml" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
      <button
        onClick={() => fileRef.current?.click()}
        style={{
          width: '100%', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500,
          background: file ? '#EEF2FF' : '#fff', color: file ? '#1A237E' : '#64748b',
          border: `1.5px ${file ? 'solid #C7D2FE' : 'dashed #cbd5e1'}`, cursor: 'pointer', marginBottom: '0.5rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center',
        }}
      >
        <Upload size={14} /> {file ? file.name : 'Upload file (PDF, DOCX, Email, etc.)'}
      </button>

      <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8', margin: '0.25rem 0' }}>or paste additional notes below</div>

      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Paste client testimonials, deal outcomes, matter details..."
        rows={3}
        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
      />

      <button
        onClick={handleSubmit}
        disabled={isProcessing || (!file && !notes.trim())}
        style={{
          width: '100%', marginTop: '0.5rem', padding: '0.65rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700,
          background: isProcessing ? '#94a3b8' : 'linear-gradient(135deg, #1A237E 0%, #283593 100%)',
          color: '#fff', border: 'none', cursor: isProcessing ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        }}
      >
        {isProcessing ? <><Loader2 size={14} className="animate-spin" /> Re-analyzing with new evidence...</> : '⚡ Process & Update Analysis'}
      </button>
    </div>
  );
}
