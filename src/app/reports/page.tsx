'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Download, CheckCircle2, Clock, FileDown, Layers, 
  Trash2, Search, Calendar, ChevronDown, Filter, AlertTriangle 
} from 'lucide-react';
import { getUserSubmissionsWithMatters, deleteSubmission } from '@/app/actions/reports';

type Matter = {
  id: string;
  status: string;
  name: string;
};

type Submission = {
  id: string;
  targetDirectory: string;
  practiceArea: string;
  guideRegion: string;
  status: string;
  createdAt: Date | string;
  matters: Matter[];
  chambersData?: any;
};

export default function ReportsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Delete state
  const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    const res = await getUserSubmissionsWithMatters();
    if (res.success && res.data) {
      setSubmissions(res.data);
    }
    setIsLoading(false);
  }

  const handleDownload = (subId: string, format: 'docx' | 'pdf') => {
    if (format === 'pdf') {
      window.location.href = `/reports/${subId}`;
      return;
    }
    if (format === 'docx') {
      window.open(`/api/generate-docx?id=${subId}`, '_blank');
      return;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!submissionToDelete) return;
    setIsDeleting(true);
    const res = await deleteSubmission(submissionToDelete);
    if (res.success) {
      setSubmissions(prev => prev.filter(s => s.id !== submissionToDelete));
      setSubmissionToDelete(null);
    } else {
      alert('Error deleting submission: ' + res.error);
    }
    setIsDeleting(false);
  };

  // Filter Logic
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      // 1. Search Filter (by targetDirectory, practiceArea, guideRegion, firm name)
      const cd = sub.chambersData as any;
      const firmName = cd?.firm_name || cd?.firmName || cd?.strategicContext?.firm_name || cd?.metadata?.firm_name || '';
      const searchStr = `${sub.targetDirectory} ${sub.practiceArea} ${sub.guideRegion} ${firmName}`.toLowerCase();
      if (searchTerm && !searchStr.includes(searchTerm.toLowerCase())) return false;

      // 2. Date Filter
      const createdDate = new Date(sub.createdAt);
      const now = new Date();
      
      if (dateFilter === 'Last 7 Days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        if (createdDate < sevenDaysAgo) return false;
      } 
      else if (dateFilter === 'This Month') {
        if (createdDate.getMonth() !== now.getMonth() || createdDate.getFullYear() !== now.getFullYear()) return false;
      }
      else if (dateFilter === 'Last 3 Months') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        if (createdDate < threeMonthsAgo) return false;
      }
      else if (dateFilter === 'Last 6 Months') {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        if (createdDate < sixMonthsAgo) return false;
      }
      else if (dateFilter === 'Custom' && customStart && customEnd) {
        const start = new Date(customStart);
        const end = new Date(customEnd);
        end.setHours(23, 59, 59); // include the end day fully
        if (createdDate < start || createdDate > end) return false;
      }

      return true;
    });
  }, [submissions, searchTerm, dateFilter, customStart, customEnd]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Layers size={40} color="#2563eb" className="animate-pulse" />
          <span style={{ color: '#64748b', fontWeight: 600 }}>Loading deliverables...</span>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(0.95); } }
          .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        `}} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            RankPilot: <span style={{ color: '#2563eb' }}>Deliverables</span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#64748b', marginTop: '0.25rem' }}>
            Manage and download your final directory submissions.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '1.5rem', 
        background: '#fff', 
        padding: '1rem', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Search by directory or practice area..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.6rem 1rem 0.6rem 2.5rem', 
              borderRadius: '8px', 
              border: '1px solid #cbd5e1',
              outline: 'none',
              fontSize: '0.95rem'
            }} 
          />
        </div>

        {/* Date Presets */}
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => setShowDatePicker(!showDatePicker)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              padding: '0.6rem 1rem', background: '#f8fafc', 
              border: '1px solid #cbd5e1', borderRadius: '8px',
              cursor: 'pointer', fontSize: '0.95rem', color: '#334155',
              userSelect: 'none'
            }}
          >
            <Calendar size={16} color="#64748b" />
            <span>{dateFilter}</span>
            <ChevronDown size={16} color="#64748b" />
          </div>

          {/* Dropdown */}
          {showDatePicker && (
            <div style={{ 
              position: 'absolute', top: 'calc(100% + 5px)', right: 0, 
              background: '#fff', border: '1px solid #e2e8f0', 
              borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              zIndex: 50, minWidth: '200px', overflow: 'hidden'
            }}>
              {['All Time', 'Last 7 Days', 'This Month', 'Last 3 Months', 'Last 6 Months', 'Custom'].map(opt => (
                <div 
                  key={opt}
                  onClick={() => { setDateFilter(opt); if (opt !== 'Custom') setShowDatePicker(false); }}
                  style={{ 
                    padding: '0.75rem 1rem', cursor: 'pointer', 
                    background: dateFilter === opt ? '#eff6ff' : '#fff',
                    color: dateFilter === opt ? '#2563eb' : '#334155',
                    fontSize: '0.9rem', fontWeight: dateFilter === opt ? 600 : 400
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = dateFilter === opt ? '#eff6ff' : '#f8fafc'}
                  onMouseOut={(e) => e.currentTarget.style.background = dateFilter === opt ? '#eff6ff' : '#fff'}
                >
                  {opt}
                </div>
              ))}
              
              {/* Custom Date Inputs */}
              {dateFilter === 'Custom' && (
                <div style={{ padding: '1rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>From Date</label>
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginTop: '0.25rem' }}>To Date</label>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button 
                      onClick={() => setShowDatePicker(false)}
                      style={{ marginTop: '0.5rem', background: '#0f172a', color: '#fff', padding: '0.5rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Apply Custom Range
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Data Table */}
      {filteredSubmissions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <Filter size={48} color="#94a3b8" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ color: '#0f172a', fontSize: '1.25rem', marginBottom: '0.5rem' }}>No reports found</h3>
          <p style={{ color: '#64748b' }}>Try adjusting your search or date filters.</p>
        </div>
      ) : (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Target & Region</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Created</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((sub) => {
                const total = sub.matters.length;
                const optimized = sub.matters.filter(m => m.status === 'AI Optimized').length;
                const isReady = total > 0 && optimized === total;
                const cd = sub.chambersData as any;
                const firmName = cd?.firm_name || cd?.firmName || cd?.strategicContext?.firm_name || cd?.metadata?.firm_name || '';
                const editorialConf = cd?.editorial_confidence?.overall_confidence || '';
                const needsEvidence = editorialConf === 'insufficient' || editorialConf === 'low';

                // Derive display status
                let displayStatus = sub.status;
                let statusBg = '#eff6ff';
                let statusColor = '#1d4ed8';
                let StatusIcon = FileText;
                if (sub.status === 'Accepted') {
                  statusBg = '#dcfce7'; statusColor = '#15803d'; StatusIcon = CheckCircle2; displayStatus = 'Accepted';
                } else if (sub.status === 'Rejected') {
                  statusBg = '#fee2e2'; statusColor = '#b91c1c'; StatusIcon = AlertTriangle; displayStatus = 'Rejected';
                } else if (needsEvidence) {
                  statusBg = '#FEF3C7'; statusColor = '#92400E'; StatusIcon = AlertTriangle; displayStatus = 'Needs Evidence';
                } else if (sub.status === 'Submitted' && !needsEvidence) {
                  statusBg = '#ECFDF5'; statusColor = '#065F46'; StatusIcon = CheckCircle2; displayStatus = 'Analyzed';
                } else if (sub.status === 'Draft') {
                  statusBg = '#F1F5F9'; statusColor = '#475569'; StatusIcon = Clock; displayStatus = 'Draft';
                } else if (sub.status === 'Error') {
                  statusBg = '#fee2e2'; statusColor = '#dc2626'; StatusIcon = AlertTriangle; displayStatus = 'Error';
                }

                return (
                  <tr key={sub.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '1.25rem 1.5rem' }} onClick={() => window.location.href = `/reports/${sub.id}`}>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem', marginBottom: '0.2rem' }}>
                        {firmName ? `${firmName}` : sub.targetDirectory}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{sub.targetDirectory} · {sub.practiceArea} · {sub.guideRegion}</div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', color: '#475569', fontSize: '0.95rem' }} onClick={() => window.location.href = `/reports/${sub.id}`}>
                      {new Date(sub.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span style={{ 
                        background: statusBg, color: statusColor,
                        padding: '0.35rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, 
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem' 
                      }}>
                        <StatusIcon size={14} />
                        {displayStatus}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <button
                          title="Download Word (.docx)"
                          disabled={!isReady}
                          onClick={() => handleDownload(sub.id, 'docx')}
                          style={{
                            padding: '0.5rem', borderRadius: '8px', border: '1px solid',
                            borderColor: isReady ? '#2563eb' : '#e2e8f0',
                            background: isReady ? '#eff6ff' : '#fafafa',
                            color: isReady ? '#2563eb' : '#94a3b8',
                            cursor: isReady ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          onMouseOver={(e) => { if(isReady) { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff'; } }}
                          onMouseOut={(e) => { if(isReady) { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#2563eb'; } }}
                        >
                          <FileText size={18} />
                        </button>

                        <button
                          title="View Strategic Audit Letter"
                          onClick={() => handleDownload(sub.id, 'pdf')}
                          style={{
                            padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0',
                            background: '#fff',
                            color: '#475569',
                            cursor: 'pointer',
                            transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <Download size={18} />
                        </button>

                        <a
                          title="Download Chambers Submission DOCX"
                          href={`/api/generate-docx?id=${sub.id}&type=submission`}
                          style={{
                            padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #c7d2fe',
                            background: '#eef2ff',
                            color: '#4338ca',
                            cursor: 'pointer',
                            transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '0.375rem', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600
                          }}
                        >
                          <FileText size={14} />
                          DOCX
                        </a>

                        <button
                          title="Delete Report"
                          onClick={() => setSubmissionToDelete(sub.id)}
                          style={{
                            padding: '0.5rem', borderRadius: '8px', border: '1px solid #fee2e2',
                            background: '#fff', color: '#ef4444',
                            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {submissionToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '16px', maxWidth: '400px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'scaleIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={24} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f172a', margin: '0 0 0.25rem 0' }}>Delete Report?</h3>
                <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>This action cannot be undone.</p>
              </div>
            </div>
            <p style={{ color: '#475569', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete this report? All associated matters and AI-optimized texts will be lost forever.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setSubmissionToDelete(null)}
                disabled={isDeleting}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Report'}
              </button>
            </div>
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
          `}} />
        </div>
      )}
    </div>
  );
}
