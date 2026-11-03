export type PublicationStatus =
  'publishable' | 'confidential' | 'confirmation_required';

/**
 * Deterministic publication permission resolver.
 * Enforces directory ethics: missing, contradictory or pending permission NEVER becomes public.
 */
export function resolvePublication(m: any): PublicationStatus {
  if (!m || typeof m !== 'object') return 'confirmation_required';

  const statuses = [m.publish_status, m.confidentialityStatus, m.confidentiality_status, m.publishStatus]
    .filter(v => typeof v === 'string' && v.trim())
    .map(v => v.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const flags = [m.isConfidential, m.is_confidential, m.confidential].filter(v => typeof v === 'boolean');

  const restricted = flags.includes(true) ||
    statuses.some(s => ['confidential', 'non_publishable'].includes(s));
  const publicIntent = flags.includes(false) || statuses.includes('publishable');
  const pending = m.confidentialityConfirmed === false ||
    statuses.includes('confirmation_required') ||
    statuses.some(s => !['publishable', 'confidential', 'non_publishable'].includes(s));

  if (pending || (restricted && publicIntent)) return 'confirmation_required';
  if (restricted) return 'confidential';
  if (statuses.includes('publishable') && m.confidentialityConfirmed === true && !restricted) {
    return 'publishable';
  }
  if (m.isConfidential === false && m.confidentialityConfirmed === true && !restricted) {
    return 'publishable';
  }
  return 'confirmation_required';
}

/**
 * Document delivery section router.
 * Only confirmed publishable matters route to Section D (Publishable).
 * Any matter with confidential or unconfirmed status routes safely to Section E (Confidential).
 */
export function publicationRoute(m: any): 'D' | 'E' {
  return resolvePublication(m) === 'publishable' ? 'D' : 'E';
}
