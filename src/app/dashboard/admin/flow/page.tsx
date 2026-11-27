import type { CSSProperties } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { flowAdmin, listFlowRuns } from '@/lib/admin/run-flow-data';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; color: string }> = {
  completed: { label: 'Completado', color: '#34d399' },
  running: { label: 'En curso', color: '#38bdf8' },
  queued: { label: 'En cola', color: '#a5b4fc' },
  failed: { label: 'Fallido', color: '#f87171' },
  stopped: { label: 'Detenido', color: '#fbbf24' },
};

const when = (iso: string) => new Date(iso).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';

export default async function FlowRunsPage() {
  const admin = await flowAdmin();
  if (!admin) redirect('/builder');
  const runs = await listFlowRuns(80);
  const cell: CSSProperties = { padding: '0.8rem 0.9rem', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.86rem', verticalAlign: 'top' };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>Flujo del grafo</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '0.35rem 0 0', maxWidth: 720 }}>
            Cada corrida, bloque por bloque: qué entró y qué salió del registro, la selección, la redacción, las compuertas en código,
            la revisión de campo, las reparaciones, el RAG y el juez. Solo lectura; visible para administradores.
          </p>
        </div>
        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Últimas {runs.length} corridas · costo estimado con precios de lista</span>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, background: 'rgba(15,23,42,0.6)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {['Inicio', 'Caso', 'Usuario', 'Estado', 'Pasos', 'Llamadas', 'Costo', ''].map(h => <th key={h} style={{ ...cell, fontWeight: 600 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {runs.map(run => {
              const status = STATUS[run.status] || { label: run.status, color: '#94a3b8' };
              return (
                <tr key={run.id}>
                  <td style={{ ...cell, whiteSpace: 'nowrap', color: '#cbd5e1' }}>{when(run.createdAt)}</td>
                  <td style={cell}>
                    <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{run.firm || 'Sin firma'}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{run.practice || '—'} · <code style={{ color: '#64748b' }}>{run.id.slice(0, 8)}</code></div>
                    {run.issue && <div style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: 4 }}>{run.issue}</div>}
                  </td>
                  <td style={{ ...cell, color: '#cbd5e1' }}>{run.owner || '—'}</td>
                  <td style={cell}>
                    <span style={{ color: status.color, background: `${status.color}1a`, border: `1px solid ${status.color}40`, padding: '0.15rem 0.55rem', borderRadius: 999, fontSize: '0.76rem', fontWeight: 600 }}>{status.label}</span>
                    <div style={{ color: '#64748b', fontSize: '0.76rem', marginTop: 4 }}>{run.stage}</div>
                  </td>
                  <td style={{ ...cell, color: '#cbd5e1' }}>{run.steps}</td>
                  <td style={{ ...cell, color: '#cbd5e1' }}>{run.calls}</td>
                  <td style={{ ...cell, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>{run.usd.toFixed(2)} USD</td>
                  <td style={cell}>
                    <Link href={`/dashboard/admin/flow/${run.id}`} style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Ver flujo →</Link>
                  </td>
                </tr>
              );
            })}
            {!runs.length && <tr><td colSpan={8} style={{ ...cell, color: '#94a3b8', textAlign: 'center' }}>Todavía no hay corridas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
