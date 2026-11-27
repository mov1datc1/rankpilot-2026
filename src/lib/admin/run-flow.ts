/**
 * Flujo del grafo (admin): what entered and what left each block of one editorial
 * job, built only from what the job already records — its ledger (every paid call,
 * code gate and judge verdict, in order), the engine's node events and the final
 * reports of the case. Pure and read-only: it never calls a model or writes data.
 */
export const RUN_FLOW_VERSION = 'run-flow-v1';

export type BlockKind = 'source' | 'model' | 'code' | 'review' | 'repair' | 'judge' | 'outcome';
export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

export interface FlowItem { label: string; detail?: string; tone?: Tone; count?: number }
export interface FlowCall {
  step: number; round: number; block: string; role: string; model: string; unit: string;
  inputTokens: number; cachedTokens: number; outputTokens: number; reasoningTokens: number;
  seconds: number; usd: number; parallel: boolean; fields: string[]; rag: number; status: string;
}
export interface FlowBlock {
  id: string; label: string; kind: BlockKind; column: number; lane: number; role: string;
  calls: number; visits: number; usd: number; seconds: number; inputTokens: number; cachedTokens: number;
  outputTokens: number; reasoningTokens: number; models: string[]; rounds: number[];
  rejections: number; entered: FlowItem[]; exited: FlowItem[];
  rag: { source: string; tier: string; uses: number; best: number }[];
}
export interface FlowLink { from: string; to: string; count: number; kind: 'forward' | 'loop' | 'rag' }
export interface FlowStep {
  index: number; stage: string; round: number; cursor: number | null; startedAt: string | null; durationMs: number;
  blocks: string[]; calls: number; usd: number; issue: FlowItem | null; verdict: FlowItem | null; worker: string;
}
export interface EnginePath {
  nodes: { id: string; visits: number; seconds: number; statuses: Record<string, number> }[];
  transitions: { from: string; to: string; count: number; status: string }[];
  sequence: { node: string; status: string; repeat: number }[];
}
export interface RunFlow {
  version: string;
  meta: { jobId: string; submissionId: string; firm: string; practice: string; owner: string; status: string; stage: string;
    createdAt: string | null; updatedAt: string | null; workers: string[]; issue: string };
  totals: { usd: number; calls: number; stepSeconds: number; wallSeconds: number; inputTokens: number; outputTokens: number;
    rounds: number; gateRejections: number; judgeVerdicts: number; repairs: number; ragCalls: number };
  blocks: FlowBlock[]; links: FlowLink[]; steps: FlowStep[]; engine: EnginePath; calls: FlowCall[];
  findings: { group: string; items: FlowItem[] }[];
}

interface BlockSpec { label: string; kind: BlockKind; column: number; lane: number; role: string }

/** Every block, in the order a case moves through the graph. Columns read left to right. */
export const BLOCKS: Record<string, BlockSpec> = {
  rag:                { label: 'RAG · metodología', kind: 'source', column: 0, lane: 0, role: 'Reglas de metodología recuperadas para cada llamada (fuente, nivel y puntuación).' },
  register:           { label: 'Registro del caso', kind: 'model', column: 0, lane: 1, role: 'Una lectura única de quién es quién: clientes, líderes, fechas, restricciones y conflictos de la fuente.' },
  strategist:         { label: 'Estratega', kind: 'model', column: 1, lane: 0, role: 'Elige la tesis y los asuntos principales, de reserva y fuera.' },
  selection_reviewer: { label: 'Revisor de selección', kind: 'review', column: 2, lane: 0, role: 'Comprueba la selección contra la cartera completa; la rechaza o la acepta.' },
  plan:               { label: 'Plan editorial', kind: 'model', column: 3, lane: 0, role: 'Plan compartido: candidaturas, categoría, estrategia original y plan de evidencia de cada asunto.' },
  matters:            { label: 'Asuntos (D/E)', kind: 'model', column: 4, lane: 0, role: 'Redacta las narrativas de los asuntos por lotes.' },
  bio:                { label: 'B9 · perfiles', kind: 'model', column: 4, lane: 1, role: 'Redacta el B9 de cada abogado.' },
  institutional:      { label: 'B10 / C2', kind: 'model', column: 4, lane: 2, role: 'Redacta el B10 y el C2.' },
  construction:       { label: 'Otras unidades', kind: 'model', column: 4, lane: 3, role: 'Unidades auxiliares de la construcción (comparaciones, aperturas).' },
  gate:               { label: 'Compuertas en código', kind: 'code', column: 5, lane: 0, role: 'Validaciones deterministas: rechazan una entrega que incumple un contrato y la devuelven a reparar.' },
  field_reviewer:     { label: 'Revisor de campo', kind: 'review', column: 6, lane: 0, role: 'Revisa cada campo del Submission contra sus obligaciones de fuente.' },
  repair:             { label: 'Reparación', kind: 'repair', column: 7, lane: 0, role: 'Corrige solo los campos señalados por las compuertas, el revisor o el juez.' },
  writer:             { label: 'Redactor del Audit', kind: 'model', column: 8, lane: 0, role: 'Redacta la carta estratégica (Audit).' },
  audit_reviewer:     { label: 'Revisor del Audit', kind: 'review', column: 8, lane: 1, role: 'Revisa los campos del Audit contra sus obligaciones.' },
  judge:              { label: 'Juez SOL', kind: 'judge', column: 9, lane: 0, role: 'Lee el documento completo y decide: entregar o devolver a reparar.' },
  delivery:           { label: 'Entrega', kind: 'outcome', column: 10, lane: 0, role: 'Resultado final del job y del caso.' },
  other:              { label: 'Otros roles', kind: 'model', column: 4, lane: 4, role: 'Llamadas de roles no clasificados.' },
};

const n = (value: any) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const text = (value: any, max = 600) => {
  const s = typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
};
const list = (value: any): any[] => (Array.isArray(value) ? value : []);

/** USD per million tokens (input, output). Cache reads bill at 0.1x input (ai-engine/utils/prompt_cache.py). */
export function prices(model: string): [number, number] {
  return /sol/i.test(model) ? [4, 20] : [2, 12];
}

export function callUsd(call: any): number {
  const usage = call?.usage || {};
  const [input, output] = prices(String(call?.model || ''));
  const cached = n(usage.input_token_details?.cache_read);
  return (Math.max(0, n(usage.input_tokens) - cached) * input + cached * input * 0.1 + n(usage.output_tokens) * output) / 1e6;
}

export function blockOf(call: any, stage: string): string {
  const role = String(call?.role || '');
  if (role === 'case_register') return 'register';
  if (role === 'strategist') return 'strategist';
  if (role === 'selection_reviewer') return 'selection_reviewer';
  if (role === 'development') {
    const kind = String(call?.construction_unit?.kind || call?.rag_unit || '');
    if (kind === 'plan' || kind === 'plan_comparisons') return 'plan';
    if (kind === 'matters' || kind === 'bio' || kind === 'institutional') return kind;
    return 'construction';
  }
  if (role === 'field_reviewer') return stage === 'audit' ? 'audit_reviewer' : 'field_reviewer';
  if (role === 'repair') return 'repair';
  if (role === 'writer' || role === 'letter') return 'writer';
  if (role === 'editor' || role === 'judge') return 'judge';
  return 'other';
}

/** The calls of one ledger trace: a batch keeps them in `calls`, a single call is the trace. */
export function traceCalls(trace: any): any[] {
  if (!trace || typeof trace !== 'object') return [];
  if (Array.isArray(trace.calls) && trace.calls.length) return trace.calls;
  return trace.role ? [trace] : [];
}

function roundOf(tasks: string[], cursor: number | null): number {
  if (cursor == null) return 0;
  return Math.max(1, tasks.slice(0, cursor + 1).filter(t => t === 'development').length);
}

function issueItem(issue: any): FlowItem | null {
  if (!issue || typeof issue !== 'object') return null;
  const code = [issue.code, issue.rule_id].filter(Boolean).join(' · ');
  return { label: code || 'Rechazo', detail: text(issue.message, 900), tone: 'bad' };
}

const SUPERVISION_LABEL: Record<string, string> = { repair: 'Devuelve a reparar', deliver: 'Entrega', stop: 'Detiene', retry: 'Reintenta' };

function verdictItem(supervision: any): FlowItem | null {
  if (!supervision || typeof supervision !== 'object') return null;
  const action = String(supervision.action || '');
  const fields = list(supervision.repair_fields);
  const findings = list(supervision.findings).length;
  const detail = [supervision.reason && `motivo: ${supervision.reason}`, findings && `${findings} hallazgos`,
    fields.length && `campos: ${fields.join(', ')}`, supervision.repair_strategy && `estrategia: ${supervision.repair_strategy}`,
    list(supervision.repair?.tasks).length && `rehace: ${list(supervision.repair?.tasks).join(' → ')}`].filter(Boolean).join(' · ');
  return { label: SUPERVISION_LABEL[action] || action || 'Veredicto', detail, tone: action === 'deliver' ? 'good' : action === 'repair' ? 'warn' : 'bad' };
}

function bump(map: Map<string, number>, key: string, by = 1) { map.set(key, (map.get(key) || 0) + by); }

function counts(values: string[]): FlowItem[] {
  const map = new Map<string, number>();
  for (const v of values) if (v) bump(map, v);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
}

/** Repeated cycles folded into one row: [case, development rejected, release] ×8. */
export function foldCycles(tokens: string[], longest = 4): { items: string[]; repeat: number }[] {
  const out: { items: string[]; repeat: number }[] = [];
  let i = 0;
  while (i < tokens.length) {
    let best = { size: 1, repeat: 1 };
    for (let size = 1; size <= longest && i + size <= tokens.length; size++) {
      const pattern = tokens.slice(i, i + size).join('|');
      let repeat = 1;
      while (tokens.slice(i + repeat * size, i + (repeat + 1) * size).join('|') === pattern) repeat++;
      if (repeat > 1 && size * repeat > best.size * best.repeat) best = { size, repeat };
    }
    out.push({ items: tokens.slice(i, i + best.size), repeat: best.repeat });
    i += best.size * best.repeat;
  }
  return out;
}

/** The engine's own route (register → strategy → … → release), as recorded node by node. */
export function enginePath(events: any[]): EnginePath {
  const nodes = new Map<string, { id: string; visits: number; seconds: number; statuses: Record<string, number> }>();
  const transitions = new Map<string, { from: string; to: string; count: number; status: string }>();
  const tokens: string[] = [];
  let previous: { node: string; status: string } | null = null;
  for (const event of list(events)) {
    const id = String(event?.node || ''); if (!id) continue;
    const status = String(event?.status || '');
    const node = nodes.get(id) || { id, visits: 0, seconds: 0, statuses: {} };
    node.visits += 1; node.seconds += n(event.seconds); node.statuses[status] = (node.statuses[status] || 0) + 1;
    nodes.set(id, node);
    if (previous) {
      const key = `${previous.node}>${id}`;
      const t = transitions.get(key) || { from: previous.node, to: id, count: 0, status: previous.status };
      t.count += 1; transitions.set(key, t);
    }
    tokens.push(`${id}:${status}`);
    previous = { node: id, status };
  }
  const sequence = foldCycles(tokens).map(group => ({ node: group.items.map(t => t.split(':')[0]).join(' → '),
    status: group.items.map(t => t.split(':')[1]).join(' → '), repeat: group.repeat }));
  return { nodes: [...nodes.values()], transitions: [...transitions.values()], sequence };
}

function addItems(block: FlowBlock, side: 'entered' | 'exited', items: (FlowItem | null | undefined | false)[]) {
  for (const item of items) if (item) block[side].push(item);
}

/** Final reports of the case, attached to the block that produced them. */
function attachReports(blocks: Record<string, FlowBlock>, data: any, job: any) {
  const state = data?.review_checkpoint?.state || {};
  const build = state.development_build_report || {};
  const note = 'estado final del caso';

  const corrections = Object.entries(build.unit_corrections || {});
  for (const [unit, times] of corrections) {
    let kind = ''; try { kind = JSON.parse(unit)?.kind || ''; } catch { kind = ''; }
    const id = kind === 'plan_comparisons' ? 'plan' : ['plan', 'matters', 'bio', 'institutional'].includes(kind) ? kind : 'construction';
    addItems(blocks[id], 'exited', [{ label: 'Autocorrección de la unidad', detail: `${unit} · ${times} vez/veces`, tone: 'warn' }]);
  }
  for (const rejected of list(build.rejected_responses)) {
    const kind = String(rejected?.unit?.kind || '');
    const id = kind === 'plan_comparisons' ? 'plan' : ['plan', 'matters', 'bio', 'institutional'].includes(kind) ? kind : 'construction';
    addItems(blocks[id], 'exited', [{ label: 'Respuesta rechazada por el contrato', detail: text(rejected?.error, 900), tone: 'bad' }]);
  }
  const observe = (id: string, label: string, values: any[], tone: Tone = 'warn') =>
    addItems(blocks[id], 'exited', list(values).map(v => ({ label, detail: text(v, 700), tone })));
  observe('institutional', 'Observación de extensión o forma', build.length_observations);
  observe('matters', 'Observación de estado o forma', build.status_observations);
  observe('bio', 'Observación de forma del B9', build.shape_observations);
  if (list(build.plan_fixes).length) addItems(blocks.plan, 'exited', [{ label: 'Correcciones aplicadas en código al plan', count: list(build.plan_fixes).length, detail: counts(list(build.plan_fixes).map((f: any) => f?.fix)).map(c => `${c.label} ×${c.count}`).join(', '), tone: 'info' }]);
  if (build.first_pass_quality?.status) addItems(blocks.plan, 'exited', [{ label: 'Calidad de primera pasada', detail: `${build.first_pass_quality.status}${build.first_pass_quality.target_percent ? ` · objetivo ${build.first_pass_quality.target_percent} %` : ''}`, tone: 'info' }]);

  const checks = (receipts: any[], id: string) => {
    let met = 0, unmet = 0;
    const failing: FlowItem[] = [];
    for (const receipt of list(receipts)) for (const check of list(receipt?.checks)) {
      if (check?.status === 'met') met += 1;
      else { unmet += 1; failing.push({ label: `${receipt?.field || 'campo'} · ${check?.obligation_id || check?.status || ''}`, detail: text(check?.reason, 600), tone: 'bad' }); }
    }
    if (met || unmet) addItems(blocks[id], 'exited', [{ label: `Obligaciones revisadas (${note})`, detail: `${met} cumplidas · ${unmet} no cumplidas`, tone: unmet ? 'warn' : 'good', count: met + unmet }]);
    addItems(blocks[id], 'exited', failing.slice(0, 40));
  };
  checks(state.field_review_receipts, 'field_reviewer');
  checks(state.audit_review?.receipts, 'audit_reviewer');
  const attempts = Object.entries(state.field_review_attempts || {});
  if (attempts.length) addItems(blocks.field_reviewer, 'entered', [{ label: 'Campos revisados (intentos)', detail: attempts.map(([f, t]) => `${f} ×${t}`).join(' · '), tone: 'info', count: attempts.length }]);
  observe('field_reviewer', 'Reparación acotada terminada con observaciones', list(state.field_review_observations).map((o: any) => `${o?.field}: ${list(o?.defects).map((d: any) => d?.message).join(' / ')}`));
  observe('field_reviewer', 'Revisión fallida', state.field_review_failures, 'bad');

  addItems(blocks.repair, 'entered', list(state.repair_feedback).map((d: any) => ({ label: `${d?.code || 'Defecto'} · ${d?.field_path || d?.scope || ''}`, detail: text(d?.message, 700), tone: d?.severity === 'critical' ? 'bad' : 'warn' })));
  observe('repair', 'Sin resolver tras la reparación', state.repair_report?.unresolved, 'bad');
  const letter = state.letter_repair_report || {};
  if (list(letter.corrected_fields).length) addItems(blocks.repair, 'exited', [{ label: 'Campos del Audit corregidos', detail: list(letter.corrected_fields).join(', '), tone: 'good' }]);

  const selection = state.selection_review?.checks || {};
  const statuses = counts(Object.values(selection).map((c: any) => String(c?.status || '')));
  if (statuses.length) addItems(blocks.selection_reviewer, 'exited', [{ label: `Comprobaciones de la selección (${note})`, detail: statuses.map(s => `${s.label} ×${s.count}`).join(' · '), tone: 'info' }]);
  const history = list(state.selection_failure_history);
  if (history.length) addItems(blocks.selection_reviewer, 'exited', history.map((ids: any, i: number) => ({ label: `Intento ${i + 1}`, detail: list(ids).length ? `${list(ids).length} asunto(s) rechazado(s)` : 'aceptado', tone: (list(ids).length ? 'bad' : 'good') as Tone })));
  if (state.selection_repair_report) addItems(blocks.selection_reviewer, 'exited', [{ label: 'Reparación de la selección', detail: `${list(state.selection_repair_report.corrected_matter_ids).length} asunto(s) · campos ${list(state.selection_repair_report.field_paths).join(', ')}`, tone: 'warn' }]);

  observe('writer', 'Observación del Audit', state.writer_observations);
  if (state.audit_review?.status) addItems(blocks.audit_reviewer, 'exited', [{ label: 'Estado de la revisión del Audit', detail: String(state.audit_review.status), tone: /repaired|passed|met/.test(String(state.audit_review.status)) ? 'good' : 'warn' }]);

  const verdict = data?.release_verdict || state.release_verdict || {};
  if (list(verdict.errors).length) addItems(blocks.judge, 'exited', list(verdict.errors).map((e: any) => ({ label: 'Defecto del veredicto final', detail: text(e, 900), tone: 'bad' as Tone })));
  if (verdict.passed !== undefined || verdict.status) addItems(blocks.judge, 'exited', [{ label: 'Veredicto final', detail: [verdict.status, verdict.passed === true ? 'aprobado' : verdict.passed === false ? 'no aprobado' : ''].filter(Boolean).join(' · '), tone: verdict.passed ? 'good' : 'bad' }]);

  const gate = state.render_gate || {};
  addItems(blocks.delivery, 'entered', [
    { label: 'Estado del job', detail: [job?.status, job?.stage].filter(Boolean).join(' · '), tone: job?.status === 'completed' ? 'good' : job?.status === 'failed' ? 'bad' : 'info' },
    job?.issue && issueItem(job.issue),
    gate.status && { label: 'Compuerta de render', detail: `${gate.status}${gate.passed === false ? ' · no aprobada' : ''}`, tone: gate.passed ? 'good' : 'warn' },
  ]);
  observe('delivery', 'Observación de la compuerta de render', gate.errors);
  observe('delivery', 'Observación de cierre seguro', state.safe_closure?.observations);
  const artifacts = ['approved_artifact', 'available_artifact', 'draft_artifact'].filter(k => data?.[k]);
  addItems(blocks.delivery, 'exited', [{ label: 'Documentos disponibles', detail: artifacts.length ? artifacts.join(', ') : 'ninguno', tone: artifacts.length ? 'good' : 'bad' }]);
}

export function buildRunFlow(job: any, data: any, extra: { firm?: string; practice?: string; owner?: string } = {}): RunFlow {
  const tasks: string[] = list(job?.tasks).map(String);
  const blocks: Record<string, FlowBlock> = {};
  for (const [id, spec] of Object.entries(BLOCKS)) blocks[id] = { id, ...spec, calls: 0, visits: 0, usd: 0, seconds: 0, inputTokens: 0,
    cachedTokens: 0, outputTokens: 0, reasoningTokens: 0, models: [], rounds: [], rejections: 0, entered: [], exited: [], rag: [] };
  const sequence: string[] = [];
  const steps: FlowStep[] = [];
  const calls: FlowCall[] = [];
  const ragSources = new Map<string, { source: string; tier: string; uses: number; best: number; blocks: Map<string, number> }>();
  const ragBlockUse = new Map<string, number>();
  const triggers = new Map<string, FlowItem[]>();
  let pending: FlowItem[] = [];
  let ragCalls = 0, gateRejections = 0, judgeVerdicts = 0, repairs = 0;

  list(job?.ledger).forEach((entry: any, index: number) => {
    const stage = String(entry?.stage || '');
    const cursor = entry?.cursor == null ? null : n(entry.cursor);
    const round = roundOf(tasks, cursor);
    const stepCalls = traceCalls(entry?.trace);
    const stepBlocks: string[] = [];
    let stepUsd = 0;
    for (const call of stepCalls) {
      const id = blockOf(call, stage);
      const block = blocks[id];
      const usage = call?.usage || {};
      const usd = callUsd(call);
      const rules = list(call?.retrieved_rules);
      block.calls += 1; block.usd += usd; block.seconds += n(call?.seconds);
      block.inputTokens += n(usage.input_tokens); block.cachedTokens += n(usage.input_token_details?.cache_read);
      block.outputTokens += n(usage.output_tokens); block.reasoningTokens += n(usage.output_token_details?.reasoning);
      if (call?.model && !block.models.includes(call.model)) block.models.push(String(call.model));
      if (!block.rounds.includes(round)) block.rounds.push(round);
      if (id === 'repair') repairs += 1;
      if (pending.length && id !== sequence[sequence.length - 1]) { triggers.set(id, [...(triggers.get(id) || []), ...pending]); pending = []; }
      if (!stepBlocks.includes(id)) stepBlocks.push(id);
      if (sequence[sequence.length - 1] !== id) { sequence.push(id); block.visits += 1; }
      if (rules.length) {
        ragCalls += 1; bump(ragBlockUse, id);
        for (const rule of rules) {
          const key = String(rule?.source || rule?.chunk_id || 'regla');
          const s = ragSources.get(key) || { source: key, tier: String(rule?.tier || ''), uses: 0, best: 0, blocks: new Map() };
          s.uses += 1; s.best = Math.max(s.best, n(rule?.score)); bump(s.blocks, id); ragSources.set(key, s);
        }
      }
      const fields = list(call?.reviewed_fields).map((f: any) => String(f?.field || '')).filter(Boolean);
      calls.push({ step: index, round, block: id, role: String(call?.role || ''), model: String(call?.model || ''),
        unit: call?.construction_unit ? text(call.construction_unit, 120) : '', inputTokens: n(usage.input_tokens),
        cachedTokens: n(usage.input_token_details?.cache_read), outputTokens: n(usage.output_tokens),
        reasoningTokens: n(usage.output_token_details?.reasoning), seconds: n(call?.seconds), usd,
        parallel: Boolean(call?.parallel_batch), fields, rag: rules.length, status: String(call?.response_status || call?.finish_reason || '') });
      stepUsd += usd;
    }
    const issue = issueItem(entry?.issue);
    if (issue) {
      gateRejections += 1;
      const gate = blocks.gate;
      gate.rejections += 1; if (!gate.rounds.includes(round)) gate.rounds.push(round);
      gate.exited.push({ ...issue, detail: `Paso ${index + 1} · ronda ${round} · ${issue.detail || ''}` });
      if (stepBlocks.length) blocks[stepBlocks[stepBlocks.length - 1]].rejections += 1;
      if (sequence[sequence.length - 1] !== 'gate') { sequence.push('gate'); gate.visits += 1; }
      stepBlocks.push('gate');
      pending.push({ label: `Rechazo en código (paso ${index + 1})`, detail: issue.detail, tone: 'bad' });
    }
    const verdict = verdictItem(entry?.supervision);
    if (verdict) {
      judgeVerdicts += 1;
      blocks.judge.exited.push({ ...verdict, label: `Ronda ${round}: ${verdict.label}` });
      if (entry?.supervision?.action === 'repair') pending.push({ label: `Juez, ronda ${round}`, detail: verdict.detail, tone: 'warn' });
      if (entry?.supervision?.action === 'deliver' && sequence[sequence.length - 1] !== 'delivery') { sequence.push('delivery'); blocks.delivery.visits += 1; }
    }
    steps.push({ index, stage, round, cursor, startedAt: entry?.started_at || null, durationMs: n(entry?.duration_ms), blocks: stepBlocks,
      calls: stepCalls.length, usd: stepUsd, issue, verdict, worker: String(entry?.worker_commit || '').slice(0, 7) });
  });
  if (['completed', 'failed', 'stopped', 'cancelled'].includes(String(job?.status)) && sequence[sequence.length - 1] !== 'delivery') {
    sequence.push('delivery'); blocks.delivery.visits += 1;
  }

  // Links between consecutive blocks; a link that goes back to an earlier column is a loop.
  const linkMap = new Map<string, FlowLink>();
  for (let i = 1; i < sequence.length; i++) {
    const from = sequence[i - 1], to = sequence[i];
    const loop = blocks[to].column < blocks[from].column || (blocks[to].column === blocks[from].column && blocks[to].lane <= blocks[from].lane && from !== to && blocks[to].column !== 4);
    const key = `${from}>${to}`;
    const link = linkMap.get(key) || { from, to, count: 0, kind: loop ? 'loop' : 'forward' };
    link.count += 1; linkMap.set(key, link);
  }
  for (const [id, uses] of ragBlockUse) linkMap.set(`rag>${id}`, { from: 'rag', to: id, count: uses, kind: 'rag' });
  blocks.rag.calls = ragCalls; blocks.rag.visits = ragCalls;
  blocks.rag.rag = [...ragSources.values()].sort((a, b) => b.uses - a.uses).map(({ source, tier, uses, best }) => ({ source, tier, uses, best }));
  blocks.rag.exited = [...ragBlockUse.entries()].sort((a, b) => b[1] - a[1]).map(([id, uses]) => ({ label: `→ ${BLOCKS[id].label}`, count: uses, detail: `${uses} llamada(s) con reglas recuperadas` }));
  for (const [, s] of ragSources) for (const [id, uses] of s.blocks) {
    const b = blocks[id]; const row = b.rag.find(r => r.source === s.source);
    if (row) row.uses += uses; else b.rag.push({ source: s.source, tier: s.tier, uses, best: s.best });
  }

  const links = [...linkMap.values()];
  for (const block of Object.values(blocks)) {
    const inbound = links.filter(l => l.to === block.id && l.kind !== 'rag');
    const outbound = links.filter(l => l.from === block.id && l.kind !== 'rag');
    block.entered.unshift(...inbound.map(l => ({ label: `Desde ${BLOCKS[l.from].label}`, count: l.count, tone: (l.kind === 'loop' ? 'warn' : 'neutral') as Tone,
      detail: l.kind === 'loop' ? 'regreso (bucle de corrección)' : 'paso siguiente del recorrido' })));
    if (block.inputTokens) block.entered.push({ label: 'Tokens de entrada', count: block.inputTokens, detail: `${block.cachedTokens.toLocaleString('es')} leídos de caché`, tone: 'info' });
    block.entered.push(...(triggers.get(block.id) || []));
    block.exited.unshift(...outbound.map(l => ({ label: `Hacia ${BLOCKS[l.to].label}`, count: l.count, tone: (l.kind === 'loop' ? 'warn' : 'neutral') as Tone,
      detail: l.kind === 'loop' ? 'regreso (bucle de corrección)' : 'paso siguiente del recorrido' })));
    if (block.outputTokens) block.exited.push({ label: 'Tokens de salida', count: block.outputTokens, detail: `${block.reasoningTokens.toLocaleString('es')} de razonamiento`, tone: 'info' });
    block.rounds.sort((a, b) => a - b);
  }
  attachReports(blocks, data, job);
  const reviewed = calls.filter(c => c.fields.length);
  if (reviewed.length) {
    for (const id of ['field_reviewer', 'audit_reviewer']) {
      const fields = counts(reviewed.filter(c => c.block === id).flatMap(c => c.fields));
      if (fields.length) blocks[id].entered.push({ label: 'Campos enviados a revisión', count: fields.reduce((s, f) => s + (f.count || 0), 0),
        detail: fields.map(f => `${f.label}${(f.count || 0) > 1 ? ` ×${f.count}` : ''}`).join(' · '), tone: 'info' });
    }
  }

  const used = Object.values(blocks).filter(b => b.calls || b.visits || b.rejections || b.id === 'delivery');
  const created = job?.createdAt ? new Date(job.createdAt).getTime() : NaN;
  const updated = job?.updatedAt ? new Date(job.updatedAt).getTime() : NaN;
  // Findings are verdicts, rejections, defects and observations; route and token rows stay in the blocks.
  const finding = (i: FlowItem) => !/^(Hacia|Desde|Tokens) /.test(i.label);
  const findings = [
    { group: 'Compuertas en código', items: blocks.gate.exited.filter(finding) },
    { group: 'Juez SOL', items: blocks.judge.exited.filter(finding) },
    { group: 'Revisor de campo', items: [...blocks.field_reviewer.exited, ...blocks.audit_reviewer.exited].filter(i => i.tone === 'bad' || i.tone === 'warn') },
    { group: 'Reparación', items: [...blocks.repair.entered, ...blocks.repair.exited].filter(i => i.tone === 'bad' || i.tone === 'warn') },
    { group: 'Construcción', items: ['plan', 'matters', 'bio', 'institutional', 'construction'].flatMap(id => blocks[id].exited.filter(i => i.tone === 'bad' || i.tone === 'warn').map(i => ({ ...i, label: `${BLOCKS[id].label}: ${i.label}` }))) },
    { group: 'Entrega', items: blocks.delivery.entered.concat(blocks.delivery.exited).filter(i => i.tone === 'bad' || i.tone === 'warn') },
  ].map(g => ({ ...g, items: g.items.filter(finding) })).filter(g => g.items.length);
  const usd = calls.reduce((s, c) => s + c.usd, 0);
  return {
    version: RUN_FLOW_VERSION,
    meta: { jobId: String(job?.id || ''), submissionId: String(job?.submissionId || ''), firm: extra.firm || String(data?.firm_name || data?.firmName || ''),
      practice: extra.practice || String(data?.practice_area || ''), owner: extra.owner || '', status: String(job?.status || ''), stage: String(job?.stage || ''),
      createdAt: job?.createdAt ? new Date(job.createdAt).toISOString() : null, updatedAt: job?.updatedAt ? new Date(job.updatedAt).toISOString() : null,
      workers: [...new Set(list(job?.ledger).map((e: any) => String(e?.worker_commit || '').slice(0, 7)).filter(Boolean))],
      issue: job?.issue ? text(job.issue.message || job.issue, 400) : '' },
    totals: { usd, calls: calls.length, stepSeconds: steps.reduce((s, x) => s + x.durationMs, 0) / 1000,
      wallSeconds: Number.isFinite(created) && Number.isFinite(updated) ? Math.max(0, (updated - created) / 1000) : 0,
      inputTokens: calls.reduce((s, c) => s + c.inputTokens, 0), outputTokens: calls.reduce((s, c) => s + c.outputTokens, 0),
      rounds: Math.max(0, ...steps.map(s => s.round)), gateRejections, judgeVerdicts, repairs, ragCalls },
    blocks: used, links: links.filter(l => used.some(b => b.id === l.from) && used.some(b => b.id === l.to)), steps,
    engine: enginePath(data?.review_checkpoint?.state?.node_events), calls, findings,
  };
}
