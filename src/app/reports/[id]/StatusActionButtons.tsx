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
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium text-gray-500 mr-2">Status: <strong className="text-gray-800">{currentStatus}</strong></span>
      
      {currentStatus !== 'Submitted' && (
        <button 
          onClick={() => handleStatusChange('Submitted')}
          disabled={isPending}
          className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-md text-sm font-medium inline-flex items-center transition-colors disabled:opacity-50"
        >
          <Send className="h-4 w-4 mr-1.5" />
          Mark as Sent
        </button>
      )}

      {currentStatus !== 'Accepted' && (
        <button 
          onClick={() => handleStatusChange('Accepted')}
          disabled={isPending}
          className="bg-green-50 text-green-600 hover:bg-green-100 px-3 py-1.5 rounded-md text-sm font-medium inline-flex items-center transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          Mark Accepted
        </button>
      )}

      {currentStatus !== 'Rejected' && (
        <button 
          onClick={() => handleStatusChange('Rejected')}
          disabled={isPending}
          className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-md text-sm font-medium inline-flex items-center transition-colors disabled:opacity-50"
        >
          <XCircle className="h-4 w-4 mr-1.5" />
          Mark Rejected
        </button>
      )}
    </div>
  );
}
