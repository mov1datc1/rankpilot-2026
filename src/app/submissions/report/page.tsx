'use client';

import { Download, FileText, CheckCircle2, Share2 } from 'lucide-react';

export default function ReportPage() {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle2 color="#16a34a" size={28} /> Final Submission Ready
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#64748b', margin: 0 }}>Your draft has been successfully audited and optimized for Band 5 standards.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <Share2 size={18} /> Share
          </button>
          <button style={{ background: '#2563eb', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)' }}>
            <Download size={18} /> Download .docx
          </button>
        </div>
      </div>

      {/* Document Preview */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', display: 'flex' }}>
        
        {/* Left Side: Summary Stats */}
        <div style={{ width: '280px', background: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '2rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem' }}>Report Summary</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>Directory</div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>Legal 500</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>Practice Area</div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>Banking & Finance</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>Matters Included</div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>12 Optimized Matters</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>Completeness Score</div>
              <div style={{ fontWeight: 600, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                100% <CheckCircle2 size={14} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Document Simulation */}
        <div style={{ flex: 1, padding: '3rem 4rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', color: '#94a3b8' }}>
            <FileText size={24} color="#2563eb" />
            <span style={{ fontSize: '1.1rem', fontWeight: 500, color: '#0f172a' }}>TechNova_Submission_Final.docx</span>
          </div>

          {/* Skeleton/Preview Text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ width: '40%', height: '24px', background: '#e2e8f0', borderRadius: '4px' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '4px' }}></div>
              <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '4px' }}></div>
              <div style={{ width: '85%', height: '12px', background: '#f1f5f9', borderRadius: '4px' }}></div>
            </div>
            <div style={{ width: '30%', height: '20px', background: '#e2e8f0', borderRadius: '4px', marginTop: '1rem' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '4px' }}></div>
              <div style={{ width: '90%', height: '12px', background: '#f1f5f9', borderRadius: '4px' }}></div>
              <div style={{ width: '95%', height: '12px', background: '#f1f5f9', borderRadius: '4px' }}></div>
              <div style={{ width: '60%', height: '12px', background: '#f1f5f9', borderRadius: '4px' }}></div>
            </div>
            
            <div style={{ padding: '1rem', background: '#eff6ff', borderRadius: '8px', borderLeft: '4px solid #3b82f6', marginTop: '1rem' }}>
              <p style={{ margin: 0, color: '#1e40af', fontSize: '0.9rem', lineHeight: 1.5 }}>
                "In Q3 2026, the firm successfully represented TechNova Inc. in a highly complex $450M cross-border acquisition..."
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '4px' }}></div>
              <div style={{ width: '75%', height: '12px', background: '#f1f5f9', borderRadius: '4px' }}></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
