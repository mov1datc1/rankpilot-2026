'use client';

import React, { useState } from 'react';
import {
  Inbox,
  Search,
  Mail,
  Building,
  Globe,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';
import { updateLeadStatus, deleteLeadInquiry } from '@/app/actions/leads';

interface LeadItem {
  id: string;
  name: string;
  email: string;
  firmName: string;
  role: string | null;
  country: string | null;
  message: string;
  status: string;
  createdAt: string;
}

interface LeadsClientProps {
  initialLeads: LeadItem[];
  currentUserRole: string;
}

export default function LeadsClient({ initialLeads, currentUserRole }: LeadsClientProps) {
  const [leads, setLeads] = useState<LeadItem[]>(initialLeads);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredLeads = leads.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.firmName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.country && l.country.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    const res = await updateLeadStatus(id, newStatus);
    if (res.success) {
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
      );
    }
    setUpdatingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro de consulta?')) return;
    setUpdatingId(id);
    const res = await deleteLeadInquiry(id);
    if (res.success) {
      setLeads((prev) => prev.filter((l) => l.id !== id));
    }
    setUpdatingId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)', label: 'Nuevo' };
      case 'CONTACTED':
        return { bg: 'rgba(250, 204, 21, 0.15)', text: '#facc15', border: 'rgba(250, 204, 21, 0.3)', label: 'Contactado' };
      case 'PROPOSAL':
        return { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)', label: 'Propuesta' };
      case 'CLOSED':
        return { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.3)', label: 'Cerrado' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)', label: status };
    }
  };

  const countNew = leads.filter((l) => l.status === 'NEW').length;
  const countContacted = leads.filter((l) => l.status === 'CONTACTED').length;
  const countClosed = leads.filter((l) => l.status === 'CLOSED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header and KPI Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.4rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Inbox size={24} color="#38bdf8" /> Consultas de Asesoría (Rankings Decoded)
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
            Consultas recibidas desde el formulario principal de la landing page.
          </p>
        </div>

        {/* Quick Metrics */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '0.5rem 0.9rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Total</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>{leads.length}</span>
          </div>
          <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 8, padding: '0.5rem 0.9rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Nuevos</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>{countNew}</span>
          </div>
          <div style={{ backgroundColor: 'rgba(250, 204, 21, 0.1)', border: '1px solid rgba(250, 204, 21, 0.25)', borderRadius: 8, padding: '0.5rem 0.9rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Contactados</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#facc15' }}>{countContacted}</span>
          </div>
          <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: 8, padding: '0.5rem 0.9rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Cerrados</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#4ade80' }}>{countClosed}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '450px' }}>
          <Search size={16} color="#64748b" style={{ position: 'absolute', left: 12, top: 12 }} />
          <input
            type="text"
            placeholder="Buscar por firma, contacto, país o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.9rem 0.65rem 2.25rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              color: '#f8fafc',
              fontSize: '0.88rem',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['ALL', 'NEW', 'CONTACTED', 'PROPOSAL', 'CLOSED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                backgroundColor: statusFilter === st ? '#1b44ed' : 'rgba(255, 255, 255, 0.05)',
                color: statusFilter === st ? '#ffffff' : '#94a3b8',
                border: '1px solid ' + (statusFilter === st ? '#1b44ed' : 'rgba(255, 255, 255, 0.1)'),
                padding: '0.5rem 0.95rem',
                borderRadius: '7px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {st === 'ALL' ? 'Todos' : st === 'NEW' ? 'Nuevos' : st === 'CONTACTED' ? 'Contactados' : st === 'PROPOSAL' ? 'Propuesta' : 'Cerrados'}
            </button>
          ))}
        </div>
      </div>

      {/* Leads List */}
      {filteredLeads.length === 0 ? (
        <div style={{ padding: '3.5rem', textAlign: 'center', backgroundColor: 'rgba(15, 23, 42, 0.4)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Inbox size={42} color="#475569" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>No se encontraron consultas</h3>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
            {searchQuery ? 'Prueba ajustando los términos de búsqueda o filtros.' : 'Aún no se han recibido registros con este filtro.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {filteredLeads.map((lead) => {
            const badge = getStatusBadge(lead.status);
            return (
              <div
                key={lead.id}
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
                }}
              >
                {/* Header row: Firm Name, Badges, Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
                      <Building size={18} color="#38bdf8" />
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                        {lead.firmName}
                      </h3>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          backgroundColor: badge.bg,
                          color: badge.text,
                          border: `1px solid ${badge.border}`,
                          padding: '0.2rem 0.55rem',
                          borderRadius: 6,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.84rem', color: '#94a3b8' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <User size={14} color="#64748b" /> {lead.name} {lead.role ? `(${lead.role})` : ''}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Mail size={14} color="#64748b" />{' '}
                        <a href={`mailto:${lead.email}`} style={{ color: '#38bdf8', textDecoration: 'none' }}>
                          {lead.email}
                        </a>
                      </span>
                      {lead.country && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Globe size={14} color="#64748b" /> {lead.country}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={13} /> {new Date(lead.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Actions: Direct reply & Delete */}
                    <a
                      href={`mailto:${lead.email}?subject=Rankings%20Decoded%20%E2%80%94%20${encodeURIComponent(lead.firmName)}&body=Dear%20${encodeURIComponent(lead.name)},%0A%0AThank%20you%20for%20contacting%20Rankings%20Decoded.%20We%20have%20reviewed%20your%20priorities%20regarding%20${encodeURIComponent(lead.firmName)}...`}
                      style={{
                        backgroundColor: '#1b44ed',
                        color: '#ffffff',
                        padding: '0.45rem 0.85rem',
                        borderRadius: 6,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      Responder <ExternalLink size={12} />
                    </a>

                    {currentUserRole === 'SUPERADMIN' && (
                      <button
                        onClick={() => handleDelete(lead.id)}
                        disabled={updatingId === lead.id}
                        style={{
                          backgroundColor: 'transparent',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          padding: '0.45rem',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                        title="Eliminar consulta"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Message Body */}
                <div style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 8,
                  padding: '1rem 1.25rem',
                  fontSize: '0.9rem',
                  color: '#cbd5e1',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap'
                }}>
                  <strong style={{ display: 'block', color: '#94a3b8', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                    Prioridades y Objetivos de la Firma:
                  </strong>
                  {lead.message}
                </div>

                {/* Status Switcher Footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.85rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Cambiar estado:</span>
                  {(['NEW', 'CONTACTED', 'PROPOSAL', 'CLOSED'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(lead.id, st)}
                      disabled={updatingId === lead.id || lead.status === st}
                      style={{
                        backgroundColor: lead.status === st ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                        color: lead.status === st ? '#f8fafc' : '#64748b',
                        border: '1px solid ' + (lead.status === st ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'),
                        borderRadius: 5,
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.74rem',
                        fontWeight: lead.status === st ? 700 : 500,
                        cursor: lead.status === st ? 'default' : 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {st === 'NEW' ? 'Nuevo' : st === 'CONTACTED' ? 'Contactado' : st === 'PROPOSAL' ? 'Propuesta' : 'Cerrado'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
