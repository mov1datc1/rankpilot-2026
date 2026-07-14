'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Edit3, FileCheck, Loader2, BookOpen, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createSubmission } from '@/app/actions/submissions';
import { getLibraryMatters, attachMattersToSubmission } from '@/app/actions/library';
import { createClient } from '@/utils/supabase/client';
import PremiumSelect from '@/components/PremiumSelect';
import { DIRECTORIES, REGIONS, PRACTICE_AREAS, BANDS, JURISDICTIONS } from '@/lib/constants';

export default function SubmissionsPage() {
  const router = useRouter();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Form State
  const [targetDirectory, setTargetDirectory] = useState('Chambers & Partners');
  const [guideRegion, setGuideRegion] = useState('Latin America');
  const [practiceArea, setPracticeArea] = useState('Banking & Finance');
  const [currentBand, setCurrentBand] = useState('Unranked');
  const [deadline, setDeadline] = useState('');

  // Library Enrichment
  type LibMatter = { id: string; name: string; client: string; value: string; status: string; firm?: { name: string } | null; practiceArea?: string | null };
  const [libraryMatters, setLibraryMatters] = useState<LibMatter[]>([]);
  const [selectedMatterIds, setSelectedMatterIds] = useState<Set<string>>(new Set());
  const [libraryExpanded, setLibraryExpanded] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickFile, setQuickFile] = useState<File | null>(null);
  const [quickNotes, setQuickNotes] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const quickFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getLibraryMatters({ practiceArea }).then(res => {
      if (res.success && res.data) {
        setLibraryMatters(res.data as LibMatter[]);
      }
    });
  }, [practiceArea]);

  const handleQuickAddMatter = async () => {
    if (!quickFile && !quickNotes.trim()) return;
    setIsQuickAdding(true);
    try {
      let documentUrl = undefined;
      if (quickFile) {
        const ext = quickFile.name.split('.').pop();
        const fname = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error } = await supabase.storage.from('documents').upload(`matters/${fname}`, quickFile);
        if (error) throw new Error('Upload failed: ' + error.message);
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(`matters/${fname}`);
        documentUrl = publicUrl;
      }
      await fetch('/api/process-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: documentUrl, text: quickNotes, is_file: !!documentUrl,
          context: { directory: targetDirectory, practiceArea, jurisdiction: guideRegion, guideRegion },
          mode: 'matter_only',
        }),
      });
      // Refresh library list
      const res = await getLibraryMatters({ practiceArea });
      if (res.success && res.data) setLibraryMatters(res.data as LibMatter[]);
      setQuickFile(null); setQuickNotes(''); setShowQuickAdd(false);
    } catch (e: any) {
      alert(e.message);
    }
    setIsQuickAdding(false);
  };

  const startUploadAudit = async () => {
    setIsSubmitting(true);
    try {
      let documentUrl = undefined;
      
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(`submissions/${fileName}`, selectedFile);
          
        if (uploadError) {
          throw new Error('Failed to upload file to Supabase Storage: ' + uploadError.message);
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(`submissions/${fileName}`);
          
        documentUrl = publicUrl;
      }

      const result = await createSubmission({
        targetDirectory,
        guideRegion,
        practiceArea,
        currentBand,
        deadline,
      });

      if (result.success && result.data) {
        if (documentUrl) {
          await fetch('/api/update-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: result.data.id, url: documentUrl })
          }).catch(e => console.error("Error saving doc url:", e));
        }

        localStorage.setItem('activeSubmissionId', result.data.id);
        if (selectedMatterIds.size > 0) {
          await attachMattersToSubmission(result.data.id, Array.from(selectedMatterIds));
        }
        router.push(`/submissions/processing?id=${result.data.id}&url=${encodeURIComponent(documentUrl || '')}`);
      } else {
        alert('Error creating submission: ' + result.error);
        setIsSubmitting(false);
      }
    } catch (error: any) {
      alert(error.message);
      setIsSubmitting(false);
    }
  };

  const startPasteTextAudit = async () => {
    if (!pasteText.trim()) {
      alert('Please paste some text before proceeding.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createSubmission({
        targetDirectory,
        guideRegion,
        practiceArea,
        currentBand,
        deadline,
      });

      if (result.success && result.data) {
        localStorage.setItem('activeSubmissionId', result.data.id);
        if (selectedMatterIds.size > 0) {
          await attachMattersToSubmission(result.data.id, Array.from(selectedMatterIds));
        }
        router.push(`/submissions/processing?id=${result.data.id}&text=${encodeURIComponent(pasteText)}`);
      } else {
        alert('Error creating submission: ' + result.error);
        setIsSubmitting(false);
      }
    } catch (error: any) {
      alert(error.message);
      setIsSubmitting(false);
    }
  };

  const startFromScratch = async () => {
    setIsSubmitting(true);
    try {
      const result = await createSubmission({
        targetDirectory,
        guideRegion,
        practiceArea,
        currentBand,
        deadline,
      });

      if (result.success && result.data) {
        localStorage.setItem('activeSubmissionId', result.data.id);
        if (selectedMatterIds.size > 0) {
          await attachMattersToSubmission(result.data.id, Array.from(selectedMatterIds));
        }
        router.push(`/submissions/department?id=${result.data.id}`);
      } else {
        alert('Error creating submission: ' + result.error);
        setIsSubmitting(false);
      }
    } catch (error: any) {
      alert(error.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          RankPilot: <span style={{ color: '#1A237E' }}>Legal Directory Portal</span>
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#64748b', marginTop: '0.25rem' }}>Setup Wizard</p>
      </div>

      {/* Form Section */}
      <div style={{ 
        background: '#ffffff', 
        borderRadius: '16px', 
        padding: '2rem', 
        border: '1px solid #e2e8f0',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <PremiumSelect
            label="Target Directory"
            value={targetDirectory}
            options={DIRECTORIES}
            onChange={setTargetDirectory}
            id="builder-directory"
          />
          <PremiumSelect
            label="Guide / Region"
            value={guideRegion}
            options={REGIONS}
            onChange={setGuideRegion}
            id="builder-region"
          />
          <PremiumSelect
            label="Practice Area"
            value={practiceArea}
            options={PRACTICE_AREAS}
            onChange={setPracticeArea}
            id="builder-practice"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <PremiumSelect
            label="Current Band"
            value={currentBand}
            options={BANDS}
            onChange={setCurrentBand}
            searchable={false}
            id="builder-band"
          />
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Deadline <span style={{ fontWeight: 400, textTransform: 'none', color: '#94a3b8', letterSpacing: 0 }}>· optional</span>
            </label>
            <input 
              type="date" 
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              style={{ 
                width: '100%', padding: '0.7rem 1rem', borderRadius: '10px', 
                border: '1.5px solid #cbd5e1', color: deadline ? '#0f172a' : '#94a3b8', background: '#fff', 
                fontSize: '0.9rem', fontWeight: 500, outline: 'none',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              }} 
            />
            <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0.35rem 0 0', fontStyle: 'italic' }}>For your own tracking — does not affect AI analysis.</p>
          </div>
        </div>
      </div>

      {/* Library Enrichment Section */}
      {libraryMatters.length > 0 && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: '2rem' }}>
          <div
            style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: selectedMatterIds.size > 0 ? '#EEF2FF' : '#F8FAFC' }}
            onClick={() => setLibraryExpanded(prev => !prev)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <BookOpen size={18} style={{ color: '#1A237E' }} />
              <div>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>Enrich with Library Matters</span>
                <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.5rem' }}>
                  {libraryMatters.length} available · {selectedMatterIds.size} selected
                </span>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#1A237E', fontWeight: 600 }}>{libraryExpanded ? '▲ Collapse' : '▼ Expand'}</span>
          </div>

          {libraryExpanded && (
            <div style={{ padding: '0 1.5rem 1.25rem', maxHeight: '300px', overflowY: 'auto' }}>
              <div style={{ background: '#F0F9FF', borderRadius: '8px', padding: '0.75rem 1rem', margin: '0 0 0.75rem', border: '1px solid #BAE6FD' }}>
                <p style={{ fontSize: '0.8rem', color: '#0369A1', margin: 0, lineHeight: 1.5 }}>
                  <strong>💡 How it works:</strong> Select matters from your library to include as supporting evidence for this submission. 
                  The AI engine will use them to build a stronger, more defensible audit letter. You can also add new matters below.
                </p>
              </div>
              {libraryMatters.map(m => {
                const isSelected = selectedMatterIds.has(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedMatterIds(prev => {
                        const next = new Set(prev);
                        if (next.has(m.id)) next.delete(m.id); else next.add(m.id);
                        return next;
                      });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                      background: isSelected ? '#EEF2FF' : 'transparent', border: isSelected ? '1px solid #C7D2FE' : '1px solid transparent',
                      marginBottom: '0.375rem', transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0,
                      border: isSelected ? 'none' : '2px solid #cbd5e1',
                      background: isSelected ? '#1A237E' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && <CheckCircle2 size={14} style={{ color: '#fff' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {m.client} {m.firm?.name ? `· ${m.firm.name}` : ''} · {m.value}
                      </div>
                    </div>
                    <span style={{
                      padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.6rem', fontWeight: 700,
                      background: m.status === 'AI Optimized' ? '#ECFDF5' : '#FEF9C3',
                      color: m.status === 'AI Optimized' ? '#065F46' : '#854D0E',
                    }}>
                      {m.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Add Panel */}
          <div style={{ padding: '0 1.5rem 1.25rem' }}>
            {!showQuickAdd ? (
              <button
                onClick={() => setShowQuickAdd(true)}
                style={{
                  width: '100%', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                  background: 'transparent', color: '#1A237E', border: '1.5px dashed #C7D2FE', cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                + Add a new matter to the library
              </button>
            ) : (
              <div style={{ background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>Quick Add Matter</span>
                  <button onClick={() => { setShowQuickAdd(false); setQuickFile(null); setQuickNotes(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </div>

                {/* File upload */}
                <input ref={quickFileRef} type="file" accept=".pdf,.docx,.doc,.txt,.eml" style={{ display: 'none' }} onChange={e => setQuickFile(e.target.files?.[0] || null)} />
                <button
                  onClick={() => quickFileRef.current?.click()}
                  style={{
                    width: '100%', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500,
                    background: quickFile ? '#EEF2FF' : '#fff', color: quickFile ? '#1A237E' : '#64748b',
                    border: `1.5px ${quickFile ? 'solid #C7D2FE' : 'dashed #cbd5e1'}`, cursor: 'pointer', marginBottom: '0.5rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center',
                  }}
                >
                  <Upload size={14} /> {quickFile ? quickFile.name : 'Upload file (PDF, DOCX, Email, etc.)'}
                </button>

                <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8', margin: '0.25rem 0' }}>or paste notes below</div>

                <textarea
                  value={quickNotes}
                  onChange={e => setQuickNotes(e.target.value)}
                  placeholder="Paste matter details, emails, or notes here..."
                  rows={3}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />

                <button
                  onClick={handleQuickAddMatter}
                  disabled={isQuickAdding || (!quickFile && !quickNotes.trim())}
                  style={{
                    width: '100%', marginTop: '0.5rem', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700,
                    background: isQuickAdding ? '#94a3b8' : 'linear-gradient(135deg, #1A237E 0%, #283593 100%)',
                    color: '#fff', border: 'none', cursor: isQuickAdding ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  }}
                >
                  {isQuickAdding ? <><Loader2 size={14} className="animate-spin" /> Processing with AI...</> : '⚡ Process & Add to Library'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
        
        {/* Upload Card */}
        <button 
          onClick={() => setShowUploadModal(true)}
          style={{ 
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '3rem 2rem', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem',
            cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = '#2563eb'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
        >
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            <Upload size={24} />
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>Upload draft (.docx)</span>
        </button>

        {/* Paste Raw Text Card */}
        <button 
          onClick={() => setShowPasteModal(true)}
          style={{ 
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '3rem 2rem', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem',
            cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = '#2563eb'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
        >
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            <FileText size={24} />
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>Paste Raw Text</span>
        </button>

        {/* Start from Scratch Card */}
        <button 
          onClick={startFromScratch}
          disabled={isSubmitting}
          style={{ 
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '3rem 2rem', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem',
            cursor: isSubmitting ? 'wait' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            opacity: isSubmitting ? 0.6 : 1
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = '#2563eb'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
        >
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <Edit3 size={24} />}
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>{isSubmitting ? 'Creating...' : 'Start from Scratch'}</span>
        </button>

      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 
        }}>
          <div style={{ 
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '600px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', animation: 'scale-in 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>Upload Console</h3>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#94a3b8', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <div style={{ padding: '2rem' }}>
              <div 
                onClick={() => fileInputRef.current?.click()}
                style={{ 
                  border: selectedFileName ? '2px solid #2563eb' : '2px dashed #cbd5e1', 
                  borderRadius: '12px', padding: '3rem 2rem', 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                  background: selectedFileName ? '#eff6ff' : '#f8fafc', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { if (!selectedFileName) e.currentTarget.style.borderColor = '#94a3b8'; }}
                onMouseOut={(e) => { if (!selectedFileName) e.currentTarget.style.borderColor = '#cbd5e1'; }}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept=".docx,.pdf,.doc"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                      setSelectedFileName(e.target.files[0].name);
                    }
                  }}
                />
                
                {selectedFileName ? (
                  <>
                    <div style={{ color: '#2563eb', marginBottom: '1rem' }}>
                      <FileCheck size={48} strokeWidth={1.5} />
                    </div>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e3a8a', marginBottom: '0.5rem', margin: 0 }}>Ready to Process</h4>
                    <p style={{ color: '#2563eb', fontSize: '0.95rem', fontWeight: 500 }}>{selectedFileName}</p>
                    <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '1rem' }}>Click to select a different file</p>
                  </>
                ) : (
                  <>
                    <div style={{ color: '#1e3a8a', marginBottom: '1rem' }}>
                      <FileText size={48} strokeWidth={1.5} />
                    </div>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e3a8a', marginBottom: '0.5rem', margin: 0 }}>Upload Draft</h4>
                    <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem' }}>Select a file to begin strategic processing.</p>
                    <p style={{ color: '#475569', fontSize: '0.85rem' }}>Drag & Drop or <span style={{ color: '#2563eb', fontWeight: 500 }}>Click to Browse (.docx)</span></p>
                  </>
                )}
              </div>
            </div>

            <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={startUploadAudit}
                disabled={!selectedFileName || isSubmitting}
                style={{ 
                  background: selectedFileName && !isSubmitting ? '#3b82f6' : '#94a3b8', 
                  color: '#ffffff', padding: '0.75rem 2rem', 
                  borderRadius: '8px', fontWeight: 500, border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  cursor: selectedFileName && !isSubmitting ? 'pointer' : 'not-allowed', transition: 'background 0.2s'
                }}
                onMouseOver={(e) => { if (selectedFileName && !isSubmitting) e.currentTarget.style.background = '#2563eb'; }}
                onMouseOut={(e) => { if (selectedFileName && !isSubmitting) e.currentTarget.style.background = '#3b82f6'; }}
              >
                {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Creando Proyecto...</> : 'Start Upload Audit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste Raw Text Modal */}
      {showPasteModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 
        }}>
          <div style={{ 
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '700px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', animation: 'scale-in 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>Paste Raw Submission Text</h3>
              <button onClick={() => { setShowPasteModal(false); setPasteText(''); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#94a3b8', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <div style={{ padding: '2rem' }}>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>Paste your raw submission text, matter notes, or any unstructured content below. The AI engine will extract, structure, and analyze it.</p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your submission text here...&#10;&#10;Example: The firm advised JP Morgan Chase on a complex cross-border restructuring involving Venezuelan regulatory constraints...&#10;&#10;You can paste entire submission drafts, matter descriptions, firm narratives, or raw notes."
                style={{ 
                  width: '100%', minHeight: '250px', padding: '1rem', borderRadius: '8px', 
                  border: '1px solid #cbd5e1', fontSize: '0.9rem', lineHeight: 1.6, 
                  resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                  color: '#1e293b', background: '#f8fafc'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{pasteText.length} characters</span>
              </div>
            </div>

            <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                onClick={() => { setShowPasteModal(false); setPasteText(''); }}
                style={{ background: '#f1f5f9', color: '#475569', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 500, border: '1px solid #e2e8f0', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={startPasteTextAudit}
                disabled={!pasteText.trim() || isSubmitting}
                style={{ 
                  background: pasteText.trim() && !isSubmitting ? '#3b82f6' : '#94a3b8', 
                  color: '#ffffff', padding: '0.75rem 2rem', 
                  borderRadius: '8px', fontWeight: 500, border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  cursor: pasteText.trim() && !isSubmitting ? 'pointer' : 'not-allowed'
                }}
              >
                {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : 'Process with AI'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scale-in {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}} />
    </div>
  );
}
