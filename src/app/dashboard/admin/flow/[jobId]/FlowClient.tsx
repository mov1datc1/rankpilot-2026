'use client';

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { BlockKind, FlowBlock, FlowCall, FlowItem, FlowLink, FlowStep, RunFlow, Tone } from '@/lib/admin/run-flow';

type Metric = 'calls' | 'usd' | 'seconds' | 'tokens';
type Tab = 'map' | 'steps' | 'engine' | 'findings' | 'calls';
type Selection = { type: 'block'; id: string } | { type: 'step'; index: number } | null;

const KIND: Record<BlockKind, { color: string; label: string }> = {
  source: { color: '#a78bfa', label: 'Fuente' },
  model: { color: '#38bdf8', label: 'Modelo' },
  code: { color: '#f59e0b', label: 'Código' },
  review: { color: '#34d399', label: 'Revisión' },
  repair: { color: '#fb7185', label: 'Reparación' },
  judge: { color: '#facc15', label: 'Juez' },
  outcome: { color: '#e2e8f0', label: 'Resultado' },
};
const TONE: Record<Tone, string> = { neutral: '#64748b', good: '#34d399', warn: '#fbbf24', bad: '#f87171', info: '#38bdf8' };
const COLUMN: Record<number, string> = {
  0: 'Entrada', 1: 'Selección', 2: 'Revisión de selección', 3: 'Plan', 4: 'Redacción', 5: 'Compuertas',
  6: 'Revisión de campo', 7: 'Reparación', 8: 'Audit', 9: 'Juez', 10: 'Entrega',
};
const METRICS: { id: Metric; label: string }[] = [
  { id: 'calls', label: 'Llamadas' }, { id: 'usd', label: 'Costo' }, { id: 'seconds', label: 'Tiempo' }, { id: 'tokens', label: 'Tokens' },
];
const TABS: { id: Tab; label: string }[] = [
  { id: 'map', label: 'Mapa de bloques' }, { id: 'steps', label: 'Recorrido paso a paso' }, { id: 'engine', label: 'Ruta del motor' },
  { id: 'findings', label: 'Hallazgos' }, { id: 'calls', label: 'Llamadas' },
];

const COL_W = 178, BAR_W = 13, TOP = 76, LEFT = 24, MIN_H = 30, MAX_H = 190, LABEL_H = 58, GAP = 22;

const fmtUsd = (v: number) => `${v.toFixed(v > 0 && v < 1 ? 3 : 2)} USD`;
const fmtNum = (v: number) => Math.round(v).toLocaleString('es');
const fmtSecs = (s: number) => (s < 60 ? `${s.toFixed(0)} s` : s < 3600 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${(s / 3600).toFixed(1)} h`);
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }) : '—');
const roundName = (r: number) => (r === 0 ? 'Preparación' : r === 1 ? 'Ronda 1 · generación' : `Ronda ${r} · tras el juez`);

function metricOf(block: FlowBlock, metric: Metric): number {
  if (metric === 'usd') return block.usd;
  if (metric === 'seconds') return block.seconds;
  if (metric === 'tokens') return block.inputTokens + block.outputTokens;
  return block.calls || block.visits + block.rejections;
}
function metricLabel(block: FlowBlock, metric: Metric): string {
  if (metric === 'usd') return fmtUsd(block.usd);
  if (metric === 'seconds') return fmtSecs(block.seconds);
  if (metric === 'tokens') return `${fmtNum(block.inputTokens + block.outputTokens)} tokens`;
  if (block.kind === 'code') return `${block.rejections} rechazo${block.rejections === 1 ? '' : 's'}`;
  if (block.kind === 'outcome') return block.visits ? 'final' : '—';
  return `${block.calls} llamada${block.calls === 1 ? '' : 's'}`;
}

interface Box { x: number; y: number; h: number; block: FlowBlock }

function layout(flow: RunFlow, metric: Metric) {
  const columns = [...new Set(flow.blocks.map(b => b.column))].sort((a, b) => a - b);
  const max = Math.max(1e-9, ...flow.blocks.filter(b => b.kind !== 'source').map(b => metricOf(b, metric)));
  const boxes: Record<string, Box> = {};
  let bottom = TOP;
  columns.forEach((column, index) => {
    let y = TOP;
    for (const block of flow.blocks.filter(b => b.column === column).sort((a, b) => a.lane - b.lane)) {
      const value = metricOf(block, metric);
      const h = block.kind === 'source' ? 44 : Math.max(MIN_H, Math.min(MAX_H, MIN_H + (value / max) * (MAX_H - MIN_H)));
      boxes[block.id] = { x: LEFT + index * COL_W, y, h, block };
      y += Math.max(h, LABEL_H) + GAP;
    }
    bottom = Math.max(bottom, y);
  });
  return { columns, boxes, bottom, width: LEFT + columns.length * COL_W + 40 };
}

/** Band positions along each bar, so bands leave and enter in order instead of on one point. */
function slots(links: FlowLink[], boxes: Record<string, Box>, thickness: (l: FlowLink) => number) {
  const out = new Map<FlowLink, number>(), into = new Map<FlowLink, number>();
  const place = (side: 'from' | 'to', map: Map<FlowLink, number>) => {
    const groups = new Map<string, FlowLink[]>();
    for (const l of links) groups.set(l[side], [...(groups.get(l[side]) || []), l]);
    for (const [id, group] of groups) {
      const box = boxes[id]; if (!box) continue;
      const other = side === 'from' ? 'to' : 'from';
      group.sort((a, b) => (boxes[a[other]]?.y || 0) - (boxes[b[other]]?.y || 0));
      const total = group.reduce((s, l) => s + thickness(l), 0);
      let y = box.y + Math.max(0, (box.h - total) / 2);
      for (const l of group) { const t = thickness(l); map.set(l, Math.min(box.y + box.h, y + t / 2)); y += t; }
    }
  };
  place('from', out); place('to', into);
  return { out, into };
}

function Pill({ children, color }: { children: ReactNode; color: string }) {
  return <span style={{ color, background: `${color}1a`, border: `1px solid ${color}40`, padding: '0.1rem 0.5rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</span>;
}

function Item({ item }: { item: FlowItem }) {
  const [open, setOpen] = useState(false);
  const detail = item.detail || '';
  const long = detail.length > 260;
  return (
    <div style={{ borderLeft: `3px solid ${TONE[item.tone || 'neutral']}`, background: 'rgba(148,163,184,0.06)', borderRadius: 8, padding: '0.55rem 0.7rem', marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#e2e8f0' }}>{item.label}</span>
        {item.count !== undefined && <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(item.count)}</span>}
      </div>
      {detail && (
        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 3, lineHeight: 1.45, wordBreak: 'break-word' }}>
          {long && !open ? detail.slice(0, 260) + '…' : detail}
          {long && <button onClick={() => setOpen(!open)} style={{ marginLeft: 6, background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.76rem', padding: 0 }}>{open ? 'ver menos' : 'ver más'}</button>}
        </div>
      )}
    </div>
  );
}

function Section({ title, children, empty }: { title: string; children: ReactNode; empty?: boolean }) {
  return (
    <section style={{ marginTop: '1.1rem' }}>
      <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', margin: '0 0 0.5rem' }}>{title}</h4>
      {empty ? <div style={{ fontSize: '0.8rem', color: '#475569' }}>Sin registros.</div> : children}
    </section>
  );
}

function CallsTable({ calls, onStep }: { calls: FlowCall[]; onStep?: (index: number) => void }) {
  const th: CSSProperties = { textAlign: 'left', padding: '0.4rem 0.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.08)' };
  const td: CSSProperties = { padding: '0.4rem 0.5rem', fontSize: '0.78rem', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums' };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Paso', 'Ronda', 'Rol', 'Unidad / campos', 'Entrada', 'Salida', 'Tiempo', 'Costo'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {calls.map((c, i) => (
            <tr key={i}>
              <td style={td}>{onStep ? <button onClick={() => onStep(c.step)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0, fontSize: '0.78rem' }}>#{c.step + 1}</button> : `#${c.step + 1}`}</td>
              <td style={td}>{c.round}</td>
              <td style={td}>{c.role}{c.parallel ? <span style={{ color: '#64748b' }}> ∥</span> : null}<div style={{ color: '#64748b', fontSize: '0.7rem' }}>{c.model}</div></td>
              <td style={{ ...td, maxWidth: 260, wordBreak: 'break-word', color: '#94a3b8' }}>{c.fields.length ? c.fields.join(', ') : c.unit || '—'}{c.rag ? <div style={{ color: KIND.source.color, fontSize: '0.7rem' }}>RAG: {c.rag} regla(s)</div> : null}</td>
              <td style={td}>{fmtNum(c.inputTokens)}{c.cachedTokens ? <div style={{ color: '#64748b', fontSize: '0.7rem' }}>caché {fmtNum(c.cachedTokens)}</div> : null}</td>
              <td style={td}>{fmtNum(c.outputTokens)}{c.reasoningTokens ? <div style={{ color: '#64748b', fontSize: '0.7rem' }}>razon. {fmtNum(c.reasoningTokens)}</div> : null}</td>
              <td style={td}>{fmtSecs(c.seconds)}</td>
              <td style={td}>{fmtUsd(c.usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0.75rem 0.9rem', minWidth: 0 }}>
      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: color || '#f8fafc', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function BlockPanel({ block, flow, onStep }: { block: FlowBlock; flow: RunFlow; onStep: (i: number) => void }) {
  const calls = flow.calls.filter(c => c.block === block.id);
  const color = KIND[block.kind].color;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: color, flex: 'none' }} />
        <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc' }}>{block.label}</h3>
        <Pill color={color}>{KIND[block.kind].label}</Pill>
      </div>
      <p style={{ color: '#94a3b8', fontSize: '0.84rem', lineHeight: 1.5, margin: '0.6rem 0 0' }}>{block.role}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, marginTop: '0.9rem' }}>
        <Stat label="Llamadas" value={String(block.calls)} sub={`${block.visits} visita(s)`} />
        <Stat label="Costo" value={fmtUsd(block.usd)} />
        <Stat label="Tiempo" value={fmtSecs(block.seconds)} />
        <Stat label="Entrada" value={fmtNum(block.inputTokens)} sub={`caché ${fmtNum(block.cachedTokens)}`} />
        <Stat label="Salida" value={fmtNum(block.outputTokens)} sub={`razon. ${fmtNum(block.reasoningTokens)}`} />
        <Stat label="Rechazos" value={String(block.rejections)} color={block.rejections ? '#f87171' : undefined} sub={block.rounds.length ? `rondas ${block.rounds.join(', ')}` : undefined} />
      </div>
      {block.models.length > 0 && <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 8 }}>Modelo: {block.models.join(', ')}</div>}
      <Section title="Qué entró" empty={!block.entered.length}>{block.entered.map((item, i) => <Item key={i} item={item} />)}</Section>
      <Section title="Qué salió" empty={!block.exited.length}>{block.exited.map((item, i) => <Item key={i} item={item} />)}</Section>
      {block.rag.length > 0 && (
        <Section title="RAG · reglas recuperadas">
          {block.rag.map(r => (
            <div key={r.source} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.8rem', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: '#e2e8f0', wordBreak: 'break-word' }}>{r.source}<span style={{ color: '#64748b' }}> · {r.tier || 'sin nivel'}</span></span>
              <span style={{ color: '#a78bfa', whiteSpace: 'nowrap' }}>{r.uses} uso(s) · máx. {r.best}</span>
            </div>
          ))}
        </Section>
      )}
      {calls.length > 0 && <Section title={`Llamadas (${calls.length})`}><CallsTable calls={calls} onStep={onStep} /></Section>}
    </div>
  );
}

function StepPanel({ step, flow, onBlock }: { step: FlowStep; flow: RunFlow; onBlock: (id: string) => void }) {
  const calls = flow.calls.filter(c => c.step === step.index);
  const byId = new Map(flow.blocks.map(b => [b.id, b]));
  return (
    <div>
      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc' }}>Paso {step.index + 1} · {step.stage || 'registro'}</h3>
      <div style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: 4 }}>{roundName(step.round)} · inicio {fmtTime(step.startedAt)} · {fmtSecs(step.durationMs / 1000)}{step.worker ? ` · worker ${step.worker}` : ''}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        {step.blocks.map(id => {
          const b = byId.get(id); if (!b) return null;
          return <button key={id} onClick={() => onBlock(id)} style={{ cursor: 'pointer', background: `${KIND[b.kind].color}1a`, border: `1px solid ${KIND[b.kind].color}55`, color: KIND[b.kind].color, borderRadius: 999, padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 600 }}>{b.label}</button>;
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, marginTop: '0.9rem' }}>
        <Stat label="Llamadas" value={String(step.calls)} />
        <Stat label="Costo" value={fmtUsd(step.usd)} />
        <Stat label="Duración" value={fmtSecs(step.durationMs / 1000)} />
      </div>
      <Section title="Resultado" empty={!step.issue && !step.verdict}>
        {step.issue && <Item item={{ ...step.issue, label: `Compuerta: ${step.issue.label}` }} />}
        {step.verdict && <Item item={{ ...step.verdict, label: `Juez: ${step.verdict.label}` }} />}
      </Section>
      {calls.length > 0 && <Section title={`Llamadas (${calls.length})`}><CallsTable calls={calls} /></Section>}
    </div>
  );
}

function FlowMap({ flow, metric, showRag, hover, setHover, selected, onBlock }: {
  flow: RunFlow; metric: Metric; showRag: boolean; hover: string | null; setHover: (id: string | null) => void; selected: Selection; onBlock: (id: string) => void;
}) {
  const { columns, boxes, bottom, width } = useMemo(() => layout(flow, metric), [flow, metric]);
  const forward = flow.links.filter(l => l.kind === 'forward' && boxes[l.from] && boxes[l.to]);
  const loops = flow.links.filter(l => l.kind === 'loop' && boxes[l.from] && boxes[l.to])
    .sort((a, b) => Math.abs(boxes[a.from].x - boxes[a.to].x) - Math.abs(boxes[b.from].x - boxes[b.to].x));
  const rag = showRag ? flow.links.filter(l => l.kind === 'rag' && boxes[l.from] && boxes[l.to]) : [];
  const maxCount = Math.max(1, ...forward.map(l => l.count), ...loops.map(l => l.count));
  const thick = (l: FlowLink) => 3 + (l.count / maxCount) * 15;
  const { out, into } = slots(forward, boxes, thick);
  const loopTop = bottom + 18;
  const height = loopTop + loops.length * 24 + 40;
  const active = (l: FlowLink) => !hover || l.from === hover || l.to === hover;
  const selectedId = selected?.type === 'block' ? selected.id : null;
  const ragUse = new Map(flow.links.filter(l => l.kind === 'rag').map(l => [l.to, l.count]));
  // The admin page is 1,200 px wide; the map takes the whole main area when there is room.
  const frame = useRef<HTMLDivElement>(null);
  const [bleed, setBleed] = useState<{ width: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = frame.current, main = el?.closest('main'), host = el?.parentElement;
      if (!el || !main || !host) return;
      const m = main.getBoundingClientRect(), h = host.getBoundingClientRect();
      const room = m.width - 48;
      setBleed(room > h.width + 40 ? { width: Math.min(room, width + 2), left: m.left + 24 - h.left } : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [width]);

  return (
    <div ref={frame} style={{ position: 'relative', ...(bleed ? { width: bleed.width, marginLeft: bleed.left } : {}), overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, background: 'radial-gradient(1200px 400px at 0% 0%, rgba(56,189,248,0.06), transparent), rgba(2,6,23,0.9)' }}>
      <svg width={width} height={height} role="img" aria-label="Mapa de bloques del flujo del caso" style={{ display: 'block' }}>
        {columns.map((column, index) => (
          <g key={column}>
            <text x={LEFT + index * COL_W} y={26} fill="#475569" fontSize={10.5} fontWeight={600} letterSpacing="0.08em">{index === 0 ? 'PUNTO DE PARTIDA' : `PASO +${index}`}</text>
            <text x={LEFT + index * COL_W} y={44} fill="#cbd5e1" fontSize={12.5} fontWeight={600}>{COLUMN[column] || ''}</text>
            <line x1={LEFT + index * COL_W} x2={LEFT + index * COL_W + COL_W - 30} y1={54} y2={54} stroke="rgba(255,255,255,0.06)" />
          </g>
        ))}

        {rag.map((l, i) => {
          const a = boxes[l.from], b = boxes[l.to];
          const x1 = a.x + BAR_W, y1 = a.y + a.h / 2, x2 = b.x + BAR_W / 2, y2 = b.y;
          return <path key={`rag${i}`} d={`M${x1},${y1} C${x1 + 80},${y1} ${x2},${y2 - 60} ${x2},${y2}`} fill="none" stroke={KIND.source.color}
            strokeOpacity={active(l) ? 0.45 : 0.06} strokeWidth={1 + Math.min(4, l.count)} strokeDasharray="2 5" />;
        })}

        {forward.map((l, i) => {
          const a = boxes[l.from], b = boxes[l.to];
          const x1 = a.x + BAR_W, x2 = b.x, y1 = out.get(l) ?? a.y + a.h / 2, y2 = into.get(l) ?? b.y + b.h / 2;
          const mid = (x1 + x2) / 2;
          return (
            <path key={`f${i}`} d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`} fill="none" stroke={KIND[a.block.kind].color}
              strokeOpacity={active(l) ? (hover ? 0.75 : 0.42) : 0.05} strokeWidth={thick(l)}>
              <title>{`${a.block.label} → ${b.block.label}: ${l.count}`}</title>
            </path>
          );
        })}

        {loops.map((l, i) => {
          const a = boxes[l.from], b = boxes[l.to];
          const sx = a.x + BAR_W / 2, tx = b.x + BAR_W / 2, sy = a.y + a.h, ty = b.y + b.h, ly = loopTop + i * 24, r = 10;
          const dir = tx < sx ? -1 : 1;
          const d = `M${sx},${sy} V${ly - r} Q${sx},${ly} ${sx + dir * r},${ly} H${tx - dir * r} Q${tx},${ly} ${tx},${ly - r} V${ty}`;
          const w = 1.5 + (l.count / maxCount) * 6;
          return (
            <g key={`l${i}`} opacity={active(l) ? 1 : 0.15}>
              <path d={d} fill="none" stroke="#fb7185" strokeOpacity={0.75} strokeWidth={w} strokeDasharray="7 5" markerEnd="url(#arrow)" />
              <rect x={(sx + tx) / 2 - 22} y={ly - 9} width={44} height={18} rx={9} fill="#1f0a12" stroke="#fb718566" />
              <text x={(sx + tx) / 2} y={ly + 4} fill="#fda4af" fontSize={11} fontWeight={700} textAnchor="middle">↺ ×{l.count}</text>
              <title>{`Bucle: ${a.block.label} → ${b.block.label} (${l.count})`}</title>
            </g>
          );
        })}

        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#fb7185" />
          </marker>
        </defs>

        {Object.values(boxes).map(({ x, y, h, block }) => {
          const color = KIND[block.kind].color;
          const isSel = selectedId === block.id;
          const dim = hover && hover !== block.id && !flow.links.some(l => (l.from === hover && l.to === block.id) || (l.to === hover && l.from === block.id));
          return (
            <g key={block.id} role="button" tabIndex={0} style={{ cursor: 'pointer', outline: 'none' }} opacity={dim ? 0.35 : 1}
              onMouseEnter={() => setHover(block.id)} onMouseLeave={() => setHover(null)} onClick={() => onBlock(block.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBlock(block.id); } }}>
              {isSel && <rect x={x - 5} y={y - 5} width={COL_W - 26} height={Math.max(h, LABEL_H) + 10} rx={10} fill="rgba(56,189,248,0.07)" stroke="#38bdf8" strokeOpacity={0.6} />}
              <rect x={x} y={y} width={BAR_W} height={h} rx={3} fill={color} fillOpacity={block.kind === 'code' || block.kind === 'outcome' ? 0.85 : 0.95} />
              {block.kind === 'code' && <rect x={x} y={y} width={BAR_W} height={h} rx={3} fill="url(#hatch)" />}
              <rect x={x + BAR_W + 4} y={y - 2} width={COL_W - BAR_W - 22} height={LABEL_H - 4} rx={6} fill="#020617" fillOpacity={0.8} />
              <text x={x + BAR_W + 10} y={y + 14} fill="#f1f5f9" fontSize={12} fontWeight={600}>{block.label}</text>
              <text x={x + BAR_W + 10} y={y + 31} fill="#cbd5e1" fontSize={12} fontWeight={700} style={{ fontVariantNumeric: 'tabular-nums' }}>{metricLabel(block, metric)}</text>
              <text x={x + BAR_W + 10} y={y + 47} fontSize={10.5}>
                {block.rejections > 0 && <tspan fill="#f87171" fontWeight={700}>✕ {block.rejections}  </tspan>}
                {block.visits > 1 && block.kind !== 'source' && <tspan fill="#fbbf24">{block.visits} visitas  </tspan>}
                {block.kind !== 'source' && ragUse.has(block.id) && <tspan fill={KIND.source.color} fontWeight={700}>RAG ×{ragUse.get(block.id)}  </tspan>}
                {block.rounds.length > 0 && <tspan fill="#64748b">R{block.rounds.join('·')}</tspan>}
              </text>
            </g>
          );
        })}
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#020617" strokeOpacity={0.35} strokeWidth={2} />
          </pattern>
        </defs>
      </svg>
    </div>
  );
}

function Steps({ flow, onStep, selected }: { flow: RunFlow; onStep: (i: number) => void; selected: Selection }) {
  const byId = new Map(flow.blocks.map(b => [b.id, b]));
  const total = Math.max(1, flow.steps.reduce((s, x) => s + Math.max(x.durationMs, 1000), 0));
  const rounds = [...new Set(flow.steps.map(s => s.round))].sort((a, b) => a - b);
  const td: CSSProperties = { padding: '0.55rem 0.6rem', fontSize: '0.82rem', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'top' };
  return (
    <div>
      <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
        {flow.steps.map(step => {
          const b = byId.get(step.blocks[0] || '');
          const color = step.issue ? KIND.code.color : b ? KIND[b.kind].color : '#475569';
          const sel = selected?.type === 'step' && selected.index === step.index;
          return <button key={step.index} title={`Paso ${step.index + 1} · ${step.stage} · ${fmtSecs(step.durationMs / 1000)}`} onClick={() => onStep(step.index)}
            style={{ flex: Math.max(step.durationMs, 1000) / total, background: color, opacity: sel ? 1 : 0.7, border: 'none', borderRight: '1px solid #020617', cursor: 'pointer', padding: 0, minWidth: 3 }} />;
        })}
      </div>
      <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: 16 }}>Barra de tiempo: cada segmento es un paso, con ancho proporcional a su duración; en ámbar, los pasos rechazados por una compuerta en código; el color de los demás es el de su bloque.</div>
      {rounds.map(round => (
        <div key={round} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', margin: '0 0 6px' }}>{roundName(round)}</div>
          <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <tbody>
                {flow.steps.filter(s => s.round === round).map(step => (
                  <tr key={step.index} onClick={() => onStep(step.index)} style={{ cursor: 'pointer', background: selected?.type === 'step' && selected.index === step.index ? 'rgba(56,189,248,0.08)' : undefined }}>
                    <td style={{ ...td, color: '#64748b', width: 48 }}>#{step.index + 1}</td>
                    <td style={{ ...td, width: 90, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(step.startedAt)}</td>
                    <td style={{ ...td, width: 100 }}>{step.stage || 'registro'}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {step.blocks.map(id => { const b = byId.get(id); return b ? <Pill key={id} color={KIND[b.kind].color}>{b.label}</Pill> : null; })}
                      </div>
                    </td>
                    <td style={{ ...td, width: 70, textAlign: 'right' }}>{step.calls} ll.</td>
                    <td style={{ ...td, width: 90, textAlign: 'right' }}>{fmtSecs(step.durationMs / 1000)}</td>
                    <td style={{ ...td, width: 90, textAlign: 'right' }}>{fmtUsd(step.usd)}</td>
                    <td style={{ ...td, width: 220 }}>
                      {step.issue && <div style={{ color: '#fca5a5', fontSize: '0.78rem' }}>✕ {step.issue.label}</div>}
                      {step.verdict && <div style={{ color: TONE[step.verdict.tone || 'neutral'], fontSize: '0.78rem' }}>⚖ {step.verdict.label}</div>}
                      {!step.issue && !step.verdict && <span style={{ color: '#475569' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function Engine({ flow }: { flow: RunFlow }) {
  const { engine } = flow;
  if (!engine.sequence.length) return <div style={{ color: '#94a3b8', fontSize: '0.86rem' }}>Esta corrida no guardó la ruta interna del motor.</div>;
  const statusColor = (s: string) => (s === 'rejected' ? '#f87171' : s === 'completed' ? '#34d399' : '#94a3b8');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
      <div>
        <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: 0 }}>Nodos del motor en el orden en que se ejecutaron. Los ciclos repetidos se pliegan en una fila con su número de vueltas.</p>
        {engine.sequence.map((row, i) => {
          const nodes = row.node.split(' → '), statuses = row.status.split(' → ');
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '0.45rem 0.6rem', borderLeft: `2px solid ${row.repeat > 1 ? '#fb7185' : 'rgba(255,255,255,0.1)'}`, marginBottom: 4, background: row.repeat > 1 ? 'rgba(251,113,133,0.06)' : undefined, borderRadius: 6 }}>
              {nodes.map((node, j) => (
                <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {j > 0 && <span style={{ color: '#475569' }}>→</span>}
                  <span style={{ fontSize: '0.8rem', color: '#e2e8f0', border: `1px solid ${statusColor(statuses[j])}55`, borderRadius: 6, padding: '0.12rem 0.45rem' }}>
                    {node}<span style={{ color: statusColor(statuses[j]), marginLeft: 5, fontSize: '0.72rem' }}>{statuses[j] === 'rejected' ? 'rechazado' : statuses[j] === 'completed' ? 'ok' : statuses[j]}</span>
                  </span>
                </span>
              ))}
              {row.repeat > 1 && <span style={{ marginLeft: 'auto', color: '#fda4af', fontWeight: 700, fontSize: '0.8rem' }}>↺ ×{row.repeat}</span>}
            </div>
          );
        })}
      </div>
      <div>
        <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Nodo', 'Visitas', 'Estados', 'Tiempo'].map(h => <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.6rem', fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {engine.nodes.map(node => (
                <tr key={node.id}>
                  <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', color: '#e2e8f0' }}>{node.id}</td>
                  <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', color: '#cbd5e1' }}>{node.visits}</td>
                  <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.78rem' }}>{Object.entries(node.statuses).map(([s, c]) => <span key={s} style={{ color: statusColor(s), marginRight: 8 }}>{s === 'rejected' ? 'rechazado' : s === 'completed' ? 'ok' : s} ×{c}</span>)}</td>
                  <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', color: '#cbd5e1' }}>{fmtSecs(node.seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', margin: '1rem 0 0.4rem' }}>Transiciones</h4>
        {[...engine.transitions].sort((a, b) => b.count - a.count).map((t, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#cbd5e1', padding: '0.25rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span>{t.from} <span style={{ color: statusColor(t.status) }}>({t.status === 'rejected' ? 'rechazado' : 'ok'})</span> → {t.to}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>×{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FlowClient({ flow }: { flow: RunFlow }) {
  const [tab, setTab] = useState<Tab>('map');
  const [metric, setMetric] = useState<Metric>('calls');
  const [showRag, setShowRag] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [callFilter, setCallFilter] = useState('all');
  const t = flow.totals, m = flow.meta;
  const block = selected?.type === 'block' ? flow.blocks.find(b => b.id === selected.id) : undefined;
  const step = selected?.type === 'step' ? flow.steps.find(s => s.index === selected.index) : undefined;
  const statusColor = m.status === 'completed' ? '#34d399' : m.status === 'failed' ? '#f87171' : '#38bdf8';
  const filtered = callFilter === 'all' ? flow.calls : flow.calls.filter(c => c.block === callFilter);
  const button = (on: boolean): CSSProperties => ({ cursor: 'pointer', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 600,
    border: `1px solid ${on ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: on ? 'rgba(56,189,248,0.12)' : 'transparent', color: on ? '#7dd3fc' : '#94a3b8' });

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700 }}>{m.firm || 'Caso sin firma'} <span style={{ color: '#64748b', fontWeight: 500 }}>· {m.practice || 'práctica no indicada'}</span></h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 6, color: '#94a3b8', fontSize: '0.82rem' }}>
            <Pill color={statusColor}>{m.status}{m.stage ? ` · ${m.stage}` : ''}</Pill>
            <span>Job <code style={{ color: '#cbd5e1' }}>{m.jobId.slice(0, 8)}</code></span>
            {m.owner && <span>· {m.owner}</span>}
            {m.createdAt && <span>· {new Date(m.createdAt).toLocaleString('es', { timeZone: 'UTC' })} UTC</span>}
            {m.workers.length > 0 && <span>· worker {m.workers.join(', ')}</span>}
          </div>
          {m.issue && <div style={{ color: '#fca5a5', fontSize: '0.82rem', marginTop: 6 }}>{m.issue}</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10, margin: '1.1rem 0 1.25rem' }}>
        <Stat label="Costo estimado" value={fmtUsd(t.usd)} sub="precios de lista" />
        <Stat label="Llamadas" value={String(t.calls)} sub={`${t.ragCalls} con RAG`} />
        <Stat label="Cómputo" value={fmtSecs(t.stepSeconds)} sub={`total ${fmtSecs(t.wallSeconds)}`} />
        <Stat label="Tokens" value={fmtNum(t.inputTokens + t.outputTokens)} sub={`entrada ${fmtNum(t.inputTokens)}`} />
        <Stat label="Rondas" value={String(t.rounds)} />
        <Stat label="Rechazos en código" value={String(t.gateRejections)} color={t.gateRejections ? '#f87171' : undefined} />
        <Stat label="Veredictos del juez" value={String(t.judgeVerdicts)} color="#facc15" />
        <Stat label="Reparaciones" value={String(t.repairs)} color={t.repairs ? '#fb7185' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 14, overflowX: 'auto' }}>
        {TABS.map(x => (
          <button key={x.id} onClick={() => setTab(x.id)} style={{ cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${tab === x.id ? '#38bdf8' : 'transparent'}`,
            color: tab === x.id ? '#38bdf8' : '#94a3b8', fontWeight: tab === x.id ? 600 : 500, padding: '0.7rem 1rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
            {x.label}{x.id === 'findings' ? ` (${flow.findings.reduce((s, g) => s + g.items.length, 0)})` : ''}
          </button>
        ))}
      </div>

      {tab === 'map' && (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontSize: '0.76rem', color: '#64748b', marginRight: 4 }}>Tamaño por</span>
            {METRICS.map(x => <button key={x.id} onClick={() => setMetric(x.id)} style={button(metric === x.id)}>{x.label}</button>)}
            <button onClick={() => setShowRag(!showRag)} style={{ ...button(showRag), marginLeft: 8 }}>Enlaces RAG {showRag ? 'visibles' : 'ocultos'}</button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.74rem', color: '#94a3b8' }}>
              {(Object.keys(KIND) as BlockKind[]).map(k => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: KIND[k].color }} />{KIND[k].label}</span>)}
              <span style={{ color: '#fda4af' }}>╌ bucle de corrección</span>
              <span style={{ color: '#c4b5fd' }}>┄ RAG</span>
            </div>
          </div>
          <FlowMap flow={flow} metric={metric} showRag={showRag} hover={hover} setHover={setHover} selected={selected} onBlock={id => setSelected({ type: 'block', id })} />
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 8 }}>
            Clic en un bloque para ver qué entró y qué salió. Las bandas siguen el recorrido real de la corrida; las líneas punteadas rojas son los regresos (rechazos y reparaciones), con su número de vueltas.
            Los informes de revisión y reparación muestran el estado final guardado del caso.
          </div>
        </div>
      )}
      {tab === 'steps' && <Steps flow={flow} selected={selected} onStep={index => setSelected({ type: 'step', index })} />}
      {tab === 'engine' && <Engine flow={flow} />}
      {tab === 'findings' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {flow.findings.map(group => (
            <div key={group.group} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0.9rem', background: 'rgba(15,23,42,0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: '0.92rem' }}>{group.group}</strong><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{group.items.length}</span>
              </div>
              {group.items.map((item, i) => <Item key={i} item={item} />)}
            </div>
          ))}
          {!flow.findings.length && <div style={{ color: '#94a3b8' }}>Sin hallazgos registrados.</div>}
        </div>
      )}
      {tab === 'calls' && (
        <div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <button onClick={() => setCallFilter('all')} style={button(callFilter === 'all')}>Todas ({flow.calls.length})</button>
            {flow.blocks.filter(b => b.calls && b.kind !== 'source').map(b => <button key={b.id} onClick={() => setCallFilter(b.id)} style={button(callFilter === b.id)}>{b.label} ({b.calls})</button>)}
          </div>
          <CallsTable calls={filtered} onStep={index => setSelected({ type: 'step', index })} />
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 8 }}>Total: {fmtUsd(filtered.reduce((s, c) => s + c.usd, 0))} · {fmtSecs(filtered.reduce((s, c) => s + c.seconds, 0))}</div>
        </div>
      )}

      {(block || step) && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.45)', zIndex: 40 }} />
          <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(480px, 100vw)', background: '#0b1220', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 50, overflowY: 'auto', padding: '1.25rem 1.25rem 2rem', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)' }}>
            <button onClick={() => setSelected(null)} aria-label="Cerrar" style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer' }}>×</button>
            {block && <BlockPanel block={block} flow={flow} onStep={index => setSelected({ type: 'step', index })} />}
            {step && <StepPanel step={step} flow={flow} onBlock={id => setSelected({ type: 'block', id })} />}
          </aside>
        </>
      )}
    </div>
  );
}
