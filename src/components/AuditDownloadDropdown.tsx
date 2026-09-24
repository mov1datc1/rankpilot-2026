'use client';

import React, { useState, useEffect, useRef } from "react";
import { Download, ChevronDown, Printer, FileText } from "lucide-react";

interface AuditDownloadDropdownProps {
  submissionId: string;
}

export default function AuditDownloadDropdown({ submissionId }: AuditDownloadDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          background: isOpen ? '#EEF2FF' : '#FFFFFF',
          color: '#1A237E',
          border: '1px solid #CBD5E1',
          padding: '0.45rem 0.85rem',
          borderRadius: '7px',
          fontSize: '0.8rem',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          transition: 'all 0.15s ease'
        }}
        title="Descargar Strategic Audit Report en PDF o Word DOCX"
      >
        <Download size={14} color="#4F46E5" />
        <span>Descargar Reporte</span>
        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          zIndex: 100,
          width: '275px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          padding: '0.4rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px'
        }}>
          {/* Opción PDF */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              window.print();
            }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Printer size={16} color="#DC2626" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A' }}>Descargar como PDF</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Listo para imprimir o presentar a socios</div>
            </div>
          </button>

          {/* Opción Word DOCX */}
          <a
            href={`/api/generate-docx?id=${submissionId}&type=audit`}
            onClick={() => setIsOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '6px',
              textDecoration: 'none',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <FileText size={16} color="#2563EB" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A' }}>Descargar como Word (.docx)</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Editable con conciliación 1:1 y tablas</div>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}
