'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, Edit3, FileCheck, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createSubmission } from '@/app/actions/submissions';

export default function SubmissionsPage() {
  const router = useRouter();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [targetDirectory, setTargetDirectory] = useState('Legal 500');
  const [guideRegion, setGuideRegion] = useState('Latin America');
  const [practiceArea, setPracticeArea] = useState('Banking & Finance');

  const startUploadAudit = async () => {
    setIsSubmitting(true);
    try {
      const result = await createSubmission({
        targetDirectory,
        guideRegion,
        practiceArea
      });

      if (result.success && result.data) {
        // Save the submission context globally or pass via URL
        localStorage.setItem('activeSubmissionId', result.data.id);
        router.push(\`/submissions/processing?id=\${result.data.id}\`);
      } else {
        alert('Error creating submission: ' + result.error);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error(error);
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          RankPilot: <span style={{ color: '#2563eb' }}>Legal Directory Portal</span>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Target Directory</label>
            <select value={targetDirectory} onChange={e => setTargetDirectory(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#fff', fontSize: '0.9rem', outline: 'none' }}>
              <option>Legal 500</option>
              <option>Chambers</option>
              <option>IFLR 1000</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Guide / Region</label>
            <select value={guideRegion} onChange={e => setGuideRegion(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#fff', fontSize: '0.9rem', outline: 'none' }}>
              <option>Latin America</option>
              <option>Global</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Practice Area</label>
            <select value={practiceArea} onChange={e => setPracticeArea(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#fff', fontSize: '0.9rem', outline: 'none' }}>
              <option>Banking & Finance</option>
              <option>Corporate and M&A</option>
              <option>Dispute Resolution</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Current Band</label>
            <select style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#fff', fontSize: '0.9rem', outline: 'none' }}>
              <option>Unranked</option>
              <option>Band 1</option>
              <option>Band 2</option>
              <option>Band 3</option>
              <option>Band 4</option>
              <option>Band 5</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Submission Deadline</label>
            <input type="date" defaultValue="2026-07-30" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#fff', fontSize: '0.9rem', outline: 'none' }} />
          </div>

        </div>
      </div>

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
          style={{ 
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '3rem 2rem', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem',
            cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = '#2563eb'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
        >
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            <Edit3 size={24} />
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>Start from Scratch</span>
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
