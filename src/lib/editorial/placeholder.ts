/** Shared by the browser wizard and the server (no server-only imports). */
// Same list as PLACEHOLDERS in ai-engine/core/case_register.py: answers that mean "no value".
const PLACEHOLDERS = new Set(['na','n a','nil','null','none','tbd','tba','pending','pendiente','not applicable',
  'no aplica','not stated','sin informacion','unknown','desconocido','nd','n d','x','confidential','confidencial','no']);

export function identity(value: unknown): string {
  return (String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().match(/[\p{L}\p{N}_]+/gu) || []).join(' ');
}

export function isPlaceholder(value: unknown): boolean {
  const key = identity(value);
  return !key || PLACEHOLDERS.has(key);
}
