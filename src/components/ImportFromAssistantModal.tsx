'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  BookOpen,
  Briefcase,
  Check,
  Loader2,
  AlertCircle,
  Building2,
  Plus
} from 'lucide-react';
import { getAllUserMatters, importMattersToSubmission } from '@/app/actions/matters';

interface ImportFromAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissionId: string;
  currentPracticeArea?: string;
  onMattersImported: (count: number) => void;
}

export default function ImportFromAssistantModal({
  isOpen,
  onClose,
  submissionId,
  currentPracticeArea,
  onMattersImported,
}: ImportFromAssistantModalProps) {
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [allMatters, setAllMatters] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterPractice, setFilterPractice] = useState<string>('all');

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setLoading(true);
    setSelectedIds(new Set());

    getAllUserMatters().then(res => {
      if (active && res.success && res.data) {
        // Exclude matters that are already attached to this specific submission
        const available = res.data.filter((m: any) => m.submissionId !== submissionId);
        setAllMatters(available);
      }
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [isOpen, submissionId]);

  if (!isOpen) return null;

  // Filter matters by search & practice area
  const filteredMatters = allMatters.filter(m => {
    const practice = m.practiceArea || m.submission?.practiceArea || '';
    if (filterPractice !== 'all' && practice.toLowerCase() !== filterPractice.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (m.name || '').toLowerCase().includes(q);
      const matchClient = (m.client || '').toLowerCase().includes(q);
      const matchPartner = (m.leadPartner || '').toLowerCase().includes(q);
      const matchPractice = practice.toLowerCase().includes(q);
      if (!matchName && !matchClient && !matchPartner && !matchPractice) return false;
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (selectedIds.size === filteredMatters.length && filteredMatters.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMatters.map(m => m.id)));
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    setImporting(true);

    try {
      const res = await importMattersToSubmission(submissionId, Array.from(selectedIds));
      if (res.success) {
        onMattersImported(res.count || selectedIds.size);
        onClose();
      } else {
        alert('Error importando asuntos: ' + (res.error || 'Error desconocido'));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(5px)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '90vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#F8FAFC'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#EEF2FF',
              color: '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Importar Asuntos desde Matter Assistant
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Selecciona mandatos de tu biblioteca o de otros submissions para agregarlos a este caso
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: '4px',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters and Search */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          background: '#FFFFFF',
          flexWrap: 'wrap'
        }}>
          {/* Search */}
          <div style={{
            position: 'relative',
            flex: 1,
            minWidth: '240px'
          }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, nombre de asunto o socio..."
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem 0.55rem 2.2rem',
                borderRadius: '7px',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
                outline: 'none',
                color: '#0F172A'
              }}
            />
          </div>

          {/* Practice Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={selectAllFiltered}
              disabled={filteredMatters.length === 0}
              style={{
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              {selectedIds.size === filteredMatters.length && filteredMatters.length > 0
                ? 'Deseleccionar Todos'
                : 'Seleccionar Todos'}
            </button>
          </div>
        </div>

        {/* Matters List Body */}
        <div style={{
          padding: '1rem 1.5rem',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          background: '#F8FAFC'
        }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
              <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem auto', color: '#4F46E5' }} />
              <p style={{ fontSize: '0.88rem', margin: 0 }}>Cargando asuntos del Matter Assistant...</p>
            </div>
          ) : filteredMatters.length === 0 ? (
            <div style={{
              background: '#FFFFFF',
              border: '1px dashed #CBD5E1',
              borderRadius: '12px',
              padding: '3rem 1.5rem',
              textAlign: 'center',
              color: '#64748B'
            }}>
              <Briefcase size={36} color="#94A3B8" style={{ margin: '0 auto 0.75rem auto' }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#1E293B', margin: '0 0 0.25rem 0' }}>
                No se encontraron asuntos disponibles
              </h4>
              <p style={{ fontSize: '0.82rem', margin: 0 }}>
                {allMatters.length === 0
                  ? 'Aún no has registrado mandatos en tu Matter Assistant. Puedes crearlos desde el menú lateral o capturarlos aquí.'
                  : 'Ningún asunto coincide con los filtros de búsqueda aplicados.'}
              </p>
            </div>
          ) : (
            filteredMatters.map(m => {
              const isSelected = selectedIds.has(m.id);
              const practice = m.practiceArea || m.submission?.practiceArea || 'General Practice';
              const isSamePractice = currentPracticeArea && practice.toLowerCase() === currentPracticeArea.toLowerCase();

              return (
                <div
                  key={m.id}
                  onClick={() => toggleSelect(m.id)}
                  style={{
                    background: isSelected ? '#F0FDF4' : '#FFFFFF',
                    border: isSelected ? '1.5px solid #16A34A' : '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '0.85rem 1.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1 }}>
                    {/* Checkbox */}
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '5px',
                      border: isSelected ? '2px solid #16A34A' : '2px solid #CBD5E1',
                      background: isSelected ? '#16A34A' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#EEF2FF', color: '#4F46E5', padding: '1px 6px', borderRadius: '4px' }}>
                          {practice}
                        </span>
                        {m.value && m.value !== 'N/A' && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, background: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: '4px' }}>
                            {m.value}
                          </span>
                        )}
                        {isSamePractice && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#DCFCE7', color: '#15803D', padding: '1px 6px', borderRadius: '4px' }}>
                            ✓ Coincide con Práctica
                          </span>
                        )}
                      </div>

                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.15rem 0' }}>
                        {m.name}
                      </h4>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#64748B' }}>
                        <span>Cliente: <strong style={{ color: '#334155' }}>{m.client || 'Confidencial'}</strong></span>
                        {m.leadPartner && (
                          <span>Socio: <strong style={{ color: '#334155' }}>{m.leadPartner}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #E2E8F0',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
            <strong style={{ color: '#0F172A' }}>{selectedIds.size}</strong> asunto(s) seleccionado(s)
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={onClose}
              disabled={importing}
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#475569',
                padding: '0.55rem 1rem',
                borderRadius: '7px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>

            <button
              onClick={handleImport}
              disabled={importing || selectedIds.size === 0}
              style={{
                background: selectedIds.size === 0
                  ? '#E2E8F0'
                  : 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
                color: selectedIds.size === 0 ? '#94A3B8' : '#FFFFFF',
                border: 'none',
                padding: '0.55rem 1.25rem',
                borderRadius: '7px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: selectedIds.size === 0 || importing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: selectedIds.size > 0 ? '0 2px 4px rgba(79, 70, 229, 0.2)' : 'none'
              }}
            >
              {importing ? (
                <><Loader2 size={14} className="animate-spin" /> Importando...</>
              ) : (
                <><Plus size={14} /> Importar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} a este Submission</>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
