'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Search,
  Calendar,
  Filter,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  FileText,
  Building2,
  TrendingUp,
  Award,
  Layers,
  X,
  ExternalLink,
} from 'lucide-react';

export interface SubmissionAuditRecord {
  id: string;
  firmName: string;
  userEmail: string;
  userName: string | null;
  practiceArea: string;
  guideRegion: string;
  targetDirectory: string;
  status: string;
  matterCount: number;
  judgeScore: number | null;
  judgeFeedback: string;
  judgeChecks: Array<{
    check_id?: string;
    component?: string;
    passed?: boolean;
    reason?: string;
    affected_matter_ids?: string[];
  }>;
  violations: string[];
  hasClonedDocx: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuditClientProps {
  records: SubmissionAuditRecord[];
  currentUserRole: string;
}

type DateRangeFilter = 'all' | 'today' | '7days' | '30days' | 'custom';
type ScoreFilter = 'all' | 'high' | 'medium' | 'low' | 'unscored';

export default function AuditClient({ records, currentUserRole }: AuditClientProps) {
  // Search and Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [practiceAreaFilter, setPracticeAreaFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('all');
  const [customDate, setCustomDate] = useState('');
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('all');
  const [selectedRecord, setSelectedRecord] = useState<SubmissionAuditRecord | null>(null);

  // Distinct practice areas for dropdown
  const practiceAreas = useMemo(() => {
    const areas = new Set<string>();
    records.forEach((r) => {
      if (r.practiceArea) areas.add(r.practiceArea);
    });
    return Array.from(areas).sort();
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // 1. Text Search: Firm, User Name, Email, or Practice
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesText =
          r.firmName.toLowerCase().includes(query) ||
          r.userEmail.toLowerCase().includes(query) ||
          (r.userName && r.userName.toLowerCase().includes(query)) ||
          r.practiceArea.toLowerCase().includes(query) ||
          r.judgeFeedback.toLowerCase().includes(query);
        if (!matchesText) return false;
      }

      // 2. Practice Area Filter
      if (practiceAreaFilter !== 'all' && r.practiceArea !== practiceAreaFilter) {
        return false;
      }

      // 3. Score Filter
      if (scoreFilter !== 'all') {
        if (scoreFilter === 'high' && (r.judgeScore === null || r.judgeScore < 8)) return false;
        if (scoreFilter === 'medium' && (r.judgeScore === null || r.judgeScore < 6 || r.judgeScore > 7)) return false;
        if (scoreFilter === 'low' && (r.judgeScore === null || r.judgeScore >= 6)) return false;
        if (scoreFilter === 'unscored' && r.judgeScore !== null) return false;
      }

      // 4. Date Filter
      if (dateRangeFilter !== 'all') {
        const itemDate = new Date(r.createdAt);
        const now = new Date();

        if (dateRangeFilter === 'today') {
          const isToday =
            itemDate.getDate() === now.getDate() &&
            itemDate.getMonth() === now.getMonth() &&
            itemDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (dateRangeFilter === '7days') {
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) return false;
        } else if (dateRangeFilter === '30days') {
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 30) return false;
        } else if (dateRangeFilter === 'custom' && customDate) {
          const custom = new Date(customDate);
          const sameDay =
            itemDate.getDate() === custom.getDate() &&
            itemDate.getMonth() === custom.getMonth() &&
            itemDate.getFullYear() === custom.getFullYear();
          if (!sameDay) return false;
        }
      }

      return true;
    });
  }, [records, searchTerm, practiceAreaFilter, dateRangeFilter, customDate, scoreFilter]);

  // Key KPI stats
  const stats = useMemo(() => {
    const total = records.length;
    const scoredList = records.filter((r) => r.judgeScore !== null).map((r) => r.judgeScore as number);
    const avgScore = scoredList.length
      ? (scoredList.reduce((acc, curr) => acc + curr, 0) / scoredList.length).toFixed(1)
      : '0.0';
    const highQuality = records.filter((r) => r.judgeScore !== null && r.judgeScore >= 8).length;
    const flagged = records.filter((r) => r.judgeScore !== null && r.judgeScore < 7).length;

    return { total, avgScore, highQuality, flagged };
  }, [records]);

  // Color helper for scores
  const getScoreBadge = (score: number | null) => {
    if (score === null) {
      return {
        text: 'N/A',
        bg: 'rgba(148, 163, 184, 0.1)',
        border: 'rgba(148, 163, 184, 0.25)',
        color: '#94a3b8',
        icon: Clock,
      };
    }
    if (score >= 8) {
      return {
        text: `${score}/10`,
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.3)',
        color: '#34d399',
        icon: CheckCircle2,
      };
    }
    if (score >= 6) {
      return {
        text: `${score}/10`,
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.3)',
        color: '#fbbf24',
        icon: AlertTriangle,
      };
    }
    return {
      text: `${score}/10`,
      bg: 'rgba(244, 63, 94, 0.12)',
      border: 'rgba(244, 63, 94, 0.3)',
      color: '#fb7185',
      icon: XCircle,
    };
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Overview Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>Total Submissions Auditadas</span>
            <Layers size={20} color="#38bdf8" />
          </div>
          <div style={kpiValueStyle}>{stats.total}</div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Generadas o intentadas desde el Builder</span>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>Score Promedio Judge SOL</span>
            <Award size={20} color="#fbbf24" />
          </div>
          <div style={{ ...kpiValueStyle, color: '#fbbf24' }}>
            {stats.avgScore} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>/ 10</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Calidad integral editorial Chambers</span>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>Calidad Alta (Score 8-10)</span>
            <CheckCircle2 size={20} color="#34d399" />
          </div>
          <div style={{ ...kpiValueStyle, color: '#34d399' }}>{stats.highQuality}</div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Listas para presentar ante directorio</span>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>Con Observaciones (Score &lt; 7)</span>
            <AlertTriangle size={20} color="#f43f5e" />
          </div>
          <div style={{ ...kpiValueStyle, color: '#fb7185' }}>{stats.flagged}</div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Feedback valioso para mejoras del SaaS</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
            <Search
              size={18}
              color="#64748b"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por firma, usuario, práctica o hallazgo..."
              style={{
                width: '100%',
                padding: '0.65rem 1rem 0.65rem 2.4rem',
                background: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Practice Area Filter */}
          <div style={{ minWidth: '180px' }}>
            <select
              value={practiceAreaFilter}
              onChange={(e) => setPracticeAreaFilter(e.target.value)}
              style={selectFilterStyle}
            >
              <option value="all">Todas las Áreas</option>
              {practiceAreas.map((pa) => (
                <option key={pa} value={pa}>
                  {pa}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div style={{ minWidth: '160px' }}>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value as DateRangeFilter)}
              style={selectFilterStyle}
            >
              <option value="all">Todo el Historial</option>
              <option value="today">Hoy</option>
              <option value="7days">Últimos 7 días</option>
              <option value="30days">Últimos 30 días</option>
              <option value="custom">Fecha Específica...</option>
            </select>
          </div>

          {/* Custom Date Input */}
          {dateRangeFilter === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              style={{ ...selectFilterStyle, minWidth: '140px' }}
            />
          )}

          {/* Score Range Filter */}
          <div style={{ minWidth: '160px' }}>
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value as ScoreFilter)}
              style={selectFilterStyle}
            >
              <option value="all">Todos los Scores</option>
              <option value="high">🟢 Alto (8 - 10)</option>
              <option value="medium">🟡 Medio (6 - 7)</option>
              <option value="low">🔴 Bajo (1 - 5)</option>
              <option value="unscored">⚪ Sin Calificar</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {(searchTerm || practiceAreaFilter !== 'all' || dateRangeFilter !== 'all' || scoreFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setPracticeAreaFilter('all');
                setDateRangeFilter('all');
                setCustomDate('');
                setScoreFilter('all');
              }}
              style={{
                padding: '0.65rem 1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                borderRadius: '8px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Limpiar Filtros
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          Mostrando <strong style={{ color: '#f8fafc' }}>{filteredRecords.length}</strong> de {records.length}{' '}
          submissions auditadas
        </div>
      </div>

      {/* Main Audit Table */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(30, 41, 59, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <th style={thStyle}>Nombre o Firma</th>
                <th style={thStyle}>Área de Práctica</th>
                <th style={{ ...thStyle, width: '120px', textAlign: 'center' }}>Score Judge SOL</th>
                <th style={thStyle}>Hallazgos / Qué Detectó Judge SOL</th>
                <th style={{ ...thStyle, width: '130px' }}>Fecha</th>
                <th style={{ ...thStyle, width: '100px', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    <ShieldCheck size={36} color="#334155" style={{ margin: '0 auto 0.75rem auto' }} />
                    <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>No se encontraron registros de auditoría</p>
                    <p style={{ fontSize: '0.8rem' }}>Intenta ajustando los filtros de búsqueda o fecha.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const scoreBadge = getScoreBadge(r.judgeScore);
                  const ScoreIcon = scoreBadge.icon;

                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {/* Nombre o Firma */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: '2px',
                            }}
                          >
                            <Building2 size={16} color="#38bdf8" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>{r.firmName}</div>
                            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>
                              {r.userName ? `${r.userName} (${r.userEmail})` : r.userEmail}
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '4px' }}>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  color: '#94a3b8',
                                }}
                              >
                                {r.matterCount} matters
                              </span>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: r.status === 'Submitted' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                  color: r.status === 'Submitted' ? '#34d399' : '#fbbf24',
                                }}
                              >
                                {r.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Área de Práctica */}
                      <td style={tdStyle}>
                        <div>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.6rem',
                              background: 'rgba(99, 102, 241, 0.12)',
                              border: '1px solid rgba(99, 102, 241, 0.25)',
                              borderRadius: '6px',
                              color: '#a5b4fc',
                              fontWeight: 500,
                              fontSize: '0.8rem',
                            }}
                          >
                            {r.practiceArea}
                          </span>
                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>
                            {r.guideRegion} • {r.targetDirectory}
                          </div>
                        </div>
                      </td>

                      {/* Score Judge SOL */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.35rem 0.75rem',
                            background: scoreBadge.bg,
                            border: `1px solid ${scoreBadge.border}`,
                            borderRadius: '9999px',
                            color: scoreBadge.color,
                            fontWeight: 700,
                            fontSize: '0.9rem',
                          }}
                        >
                          <ScoreIcon size={14} />
                          {scoreBadge.text}
                        </div>
                      </td>

                      {/* Qué detectó Judge SOL */}
                      <td style={tdStyle}>
                        <div style={{ maxWidth: '420px' }}>
                          <p
                            style={{
                              color: '#cbd5e1',
                              fontSize: '0.82rem',
                              lineHeight: 1.45,
                              margin: 0,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {r.judgeFeedback || 'Sin observaciones registradas.'}
                          </p>
                          <button
                            onClick={() => setSelectedRecord(r)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#38bdf8',
                              fontSize: '0.75rem',
                              padding: '4px 0 0 0',
                              cursor: 'pointer',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            Ver detalle de auditoría →
                          </button>
                        </div>
                      </td>

                      {/* Fecha */}
                      <td style={tdStyle}>
                        <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{formatDate(r.createdAt)}</div>
                      </td>

                      {/* Acciones */}
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button
                            onClick={() => setSelectedRecord(r)}
                            title="Auditar hallazgos"
                            style={{
                              padding: '0.45rem',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '6px',
                              color: '#cbd5e1',
                              cursor: 'pointer',
                            }}
                          >
                            <ShieldCheck size={16} />
                          </button>
                          <Link
                            href={`/reports/${r.id}`}
                            title="Ver entrega / Reporte"
                            target="_blank"
                            style={{
                              padding: '0.45rem',
                              background: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              borderRadius: '6px',
                              color: '#38bdf8',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textDecoration: 'none',
                            }}
                          >
                            <ExternalLink size={16} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal for Selected Submission */}
      {selectedRecord && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
          onClick={() => setSelectedRecord(null)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '20px',
              maxWidth: '750px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <ShieldCheck size={22} color="#38bdf8" />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    Auditoría Detallada — Judge SOL
                  </h2>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                  Firma: <strong style={{ color: '#f8fafc' }}>{selectedRecord.firmName}</strong> • {selectedRecord.practiceArea}
                </p>
              </div>

              <button
                onClick={() => setSelectedRecord(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.4rem',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Score Banner */}
            {(() => {
              const badge = getScoreBadge(selectedRecord.judgeScore);
              const ScoreIcon = badge.icon;
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    borderRadius: '12px',
                    background: badge.bg,
                    border: `1px solid ${badge.border}`,
                    marginBottom: '1.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ScoreIcon size={24} color={badge.color} />
                    <div>
                      <div style={{ fontSize: '0.75rem', color: badge.color, textTransform: 'uppercase', fontWeight: 700 }}>
                        Calificación Oficial Judge SOL
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                        {selectedRecord.judgeScore !== null ? `${selectedRecord.judgeScore} de 10 Puntos` : 'Sin Calificación'}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      color: badge.color,
                      fontWeight: 600,
                    }}
                  >
                    {selectedRecord.judgeScore && selectedRecord.judgeScore >= 8
                      ? 'Nivel Chambers Elite'
                      : selectedRecord.judgeScore && selectedRecord.judgeScore >= 6
                      ? 'Estándar Con Observaciones'
                      : 'Requiere Pulido Estratégico'}
                  </span>
                </div>
              );
            })()}

            {/* Full Judge SOL Critique */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
                📝 Informe Textual y Hallazgos de Calidad
              </h3>
              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  color: '#cbd5e1',
                  whiteSpace: 'pre-line',
                }}
              >
                {selectedRecord.judgeFeedback || 'No se registraron comentarios adicionales.'}
              </div>
            </div>

            {/* Checks breakdown if available */}
            {selectedRecord.judgeChecks && selectedRecord.judgeChecks.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.75rem' }}>
                  🔍 Desglose por Componente Editorial
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedRecord.judgeChecks.map((chk, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        background: chk.passed ? 'rgba(16, 185, 129, 0.05)' : 'rgba(244, 63, 94, 0.05)',
                        border: `1px solid ${chk.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.2)'}`,
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                      }}
                    >
                      {chk.passed ? (
                        <CheckCircle2 size={16} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
                      ) : (
                        <AlertTriangle size={16} color="#fb7185" style={{ flexShrink: 0, marginTop: '2px' }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong style={{ color: chk.passed ? '#34d399' : '#fb7185', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                            {chk.component || chk.check_id || 'COMPONENTE'}
                          </strong>
                          {chk.affected_matter_ids && chk.affected_matter_ids.length > 0 && (
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                              Matters: {chk.affected_matter_ids.join(', ')}
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '4px 0 0 0', color: '#cbd5e1' }}>{chk.reason || 'Verificado correctamente.'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submission Metadata Details */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '10px',
                padding: '1rem',
                fontSize: '0.8rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                color: '#94a3b8',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <span style={{ display: 'block', color: '#64748b' }}>ID de Submission:</span>
                <code style={{ color: '#38bdf8' }}>{selectedRecord.id.substring(0, 16)}...</code>
              </div>
              <div>
                <span style={{ display: 'block', color: '#64748b' }}>Usuario / Email:</span>
                <span style={{ color: '#f8fafc' }}>{selectedRecord.userEmail}</span>
              </div>
              <div>
                <span style={{ display: 'block', color: '#64748b' }}>Total de Asuntos:</span>
                <span style={{ color: '#f8fafc' }}>{selectedRecord.matterCount} Matters</span>
              </div>
              <div>
                <span style={{ display: 'block', color: '#64748b' }}>DOCX Clonado:</span>
                <span style={{ color: selectedRecord.hasClonedDocx ? '#34d399' : '#94a3b8' }}>
                  {selectedRecord.hasClonedDocx ? 'Disponible ✅' : 'Estándar'}
                </span>
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setSelectedRecord(null)}
                style={{
                  padding: '0.6rem 1.25rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#cbd5e1',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
              <Link
                href={`/reports/${selectedRecord.id}`}
                target="_blank"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1.25rem',
                  background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  boxShadow: '0 0 15px rgba(56, 189, 248, 0.25)',
                }}
              >
                Abrir Entrega Completa <ExternalLink size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '0.85rem 1rem',
  color: '#94a3b8',
  fontWeight: 600,
  fontSize: '0.75rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

const tdStyle: React.CSSProperties = {
  padding: '1rem',
  verticalAlign: 'middle',
};

const kpiCardStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.6)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '14px',
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#94a3b8',
  fontWeight: 500,
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: '1.8rem',
  fontWeight: 700,
  color: '#f8fafc',
  letterSpacing: '-0.02em',
};

const selectFilterStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 1rem',
  background: '#0f172a',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: '#f8fafc',
  fontSize: '0.85rem',
  outline: 'none',
  cursor: 'pointer',
};
