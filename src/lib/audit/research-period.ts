/**
 * v1.0.117 (Jonathan, 25 Nov): the research period was asked only after
 * generating, so 15 of 16 stored real runs ended with the same observation
 * ("research_period not supplied"). It is now proposed in the first wizard for
 * the user to confirm or adjust before the case runs.
 *
 * The proposal is the twelve months that end on the submission deadline (the
 * directory form asks for work "in the last 12 months"), or today when no
 * deadline is saved. It is a proposal: nothing is stored until the user saves.
 */
export type ResearchPeriod = { from: string; to: string };

const iso = (date: Date) => date.toISOString().slice(0, 10);
const isIsoDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function validResearchPeriod(from: unknown, to: unknown): boolean {
  return isIsoDate(from) && isIsoDate(to) && from <= to;
}

export function proposedResearchPeriod(deadline?: unknown, today: Date = new Date()): ResearchPeriod & { basis: 'deadline' | 'today' } {
  const parsed = deadline instanceof Date ? deadline : typeof deadline === 'string' && deadline.trim() ? new Date(deadline) : null;
  const usable = !!parsed && Number.isFinite(parsed.getTime());
  const end = usable ? parsed! : today;
  const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate()));
  return { from: iso(start), to: iso(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))), basis: usable ? 'deadline' : 'today' };
}

/** What the wizard shows first: the saved period, or the proposal. */
export function initialResearchPeriod(saved: any, deadline?: unknown, today: Date = new Date()): ResearchPeriod & { confirmed: boolean } {
  if (validResearchPeriod(saved?.from, saved?.to)) return { from: saved.from, to: saved.to, confirmed: true };
  const { from, to } = proposedResearchPeriod(deadline, today);
  return { from, to, confirmed: false };
}
