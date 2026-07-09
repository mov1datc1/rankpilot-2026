'use client';

import { useState, useTransition } from 'react';
import { updateSubmissionStatus } from '@/app/actions/submissions';
import { CheckCircle2, XCircle, Send } from 'lucide-react';

export default function StatusActionButtons({ 
  submissionId, 
  currentStatus 
}: { 
  submissionId: string; 
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (newStatus: string) => {
    startTransition(async () => {
      const res = await updateSubmissionStatus(submissionId, newStatus);
      if (res.success) {
        window.location.reload();
      } else {
        alert('Error updating status: ' + res.error);
      }
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b', marginRight: '0.5rem' }}>Status: <strong style={{ color: '#1e293b' }}>{currentStatus}</strong></span>
      
      {currentStatus !== 'Submitted' && (
        <button 
          onClick={() => handleStatusChange('Submitted')}
          disabled={isPending}
          style={{ background: '#eff6ff', color: '#2563eb', padding: '0.375rem 0.75rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', transition: 'background 0.2s', opacity: isPending ? 0.5 : 1, cursor: isPending ? 'not-allowed' : 'pointer', border: 'none' }}
        >
          <Send style={{ width: '16px', height: '16px', marginRight: '0.375rem' }} />
          Mark as Sent
        </button>
      )}

      {currentStatus !== 'Accepted' && (
        <button 
          onClick={() => handleStatusChange('Accepted')}
          disabled={isPending}
          style={{ background: '#f0fdf4', color: '#16a34a', padding: '0.375rem 0.75rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', transition: 'background 0.2s', opacity: isPending ? 0.5 : 1, cursor: isPending ? 'not-allowed' : 'pointer', border: 'none' }}
        >
          <CheckCircle2 style={{ width: '16px', height: '16px', marginRight: '0.375rem' }} />
          Mark Accepted
        </button>
      )}

      {currentStatus !== 'Rejected' && (
        <button 
          onClick={() => handleStatusChange('Rejected')}
          disabled={isPending}
          style={{ background: '#fef2f2', color: '#dc2626', padding: '0.375rem 0.75rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', transition: 'background 0.2s', opacity: isPending ? 0.5 : 1, cursor: isPending ? 'not-allowed' : 'pointer', border: 'none' }}
        >
          <XCircle style={{ width: '16px', height: '16px', marginRight: '0.375rem' }} />
          Mark Rejected
        </button>
      )}
    </div>
  );
}
