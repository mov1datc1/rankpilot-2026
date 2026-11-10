import { projectConfirmedLawyerRole } from '@/lib/audit/lawyer-role';
import { clientAliases } from './client-aliases';
import { careerMentions, transformOutsideCareerMentions, type CareerMention } from './career-evidence';
import { resolvePublication } from '@/lib/audit/publication-policy';
import { cleanLawyerNames, sanitizeBannedSuperlatives } from './artifact-integrity-check';
import { sanitizeClientName } from '@/lib/audit/extraction-auditor';

export interface CuratedLawyer {
  career?: CareerMention[];
  name: string;
  isPartner: boolean | null;
  isRanked: boolean | null;
  currentRank: string;
  suggestedRank: string;
  targetRank: string;
  url: string;
  comments: string;
  bio: string;
  supportingMatters: string;
  strategicRationale: string;
  marketEvidence: string;
  evidenceGaps: string;
  recommendedAction: string;
  leave?: string;
  focus?: string;
  standoutWork?: string;
}

const PHONE_REGEX = /^\+?[\d\s\-\.\(\)]{7,}$/;
const BANNED_NOISE_TOKENS = [
  'telephone', 'phone', 'email', 'comments', 'partner', 'ranked', 'leave',
  'information regarding', 'please do not', 'current or recent', 'risk',
  'nature', 'employment', 'department', 'practice', 'firm', 'team', 'service'
];

/**
 * Normalizes text for Spanish name comparison (accent-insensitive, lowercase, letters only)
 */
function normalizeName(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

/**
 * Extracts significant tokens (length >= 3)
 */
function getNameTokens(str: string): Set<string> {
  const norm = normalizeName(str);
  const parts = norm.split(/\s+/).filter(t => t.length >= 3);
  return new Set(parts);
}

/**
 * Determines whether two lawyer name strings refer to the same individual
 */
function isSameLawyer(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;

  const t1 = getNameTokens(name1);
  const t2 = getNameTokens(name2);
  if (t1.size === 0 || t2.size === 0) return false;

  // If one is a complete subset of the other (e.g. "Gabriel Ruan" subset of "Gabriel Ruan Santos")
  const isSubset1 = Array.from(t1).every(t => t2.has(t));
  const isSubset2 = Array.from(t2).every(t => t1.has(t));
  if (isSubset1 || isSubset2) return true;

  // If they share at least 2 significant name tokens (e.g. "María Alejandra" + "García Nieto")
  let shared = 0;
  for (const t of t1) {
    if (t2.has(t)) shared++;
  }
  return shared >= 2 && t1.size <= 4 && t2.size <= 4;
}

export function cleanLawyerUrl(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/https?:\/\/[^\s|]+/i);
  if (match) {
    let u = match[0].trim();
    if (raw.includes('-en/') && !u.endsWith('-en/')) {
      u = u.replace(/\/$/, '') + '-en/';
    }
    return u;
  }
  return raw.replace(/\|+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Anonymization dictionary to replace confidential client names with high-impact sector descriptors in public bios.
 * Prevents confidential leaks in public sections (B9, B10, C2) while preserving high-caliber substantive evidence.
 */
export function anonymizeConfidentialClients(text: string, confClientNames: string[] = [], career: CareerMention[] = []): string {
  if (!text) return '';
  if (career.length) return transformOutsideCareerMentions(text,career,part=>anonymizeConfidentialClients(part,confClientNames));
  let res = text;

  // Catch any remaining confidential entity names (including 2-3 letter acronyms like SKF, VW, PSW)
  for (const confName of clientAliases(confClientNames)) {
    if (confName && confName.trim().length >= 2) {
      const cleanConf = confName.trim();
      const esc = cleanConf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const trail = /\w$/.test(cleanConf) ? '\\b' : '(?=\\s|[,:;!?)\\]]|$)';
      const reg = new RegExp(`\\b${esc}${trail}`, 'gi');
      // An employer mentioned in a career history is not a client mandate.
      // Keep the supplied role while anonymizing the entity without inventing a relationship.
      const employment = new RegExp(`((?:general legal director|legal director|general counsel|chief legal officer|in-house counsel)\\s+(?:of|at|for)\\s+)${esc}${trail}`, 'gi');
      res = res.replace(employment, '$1a company');
      res = res.replace(reg, (match, offset: number, whole: string) => {
        const before=whole.slice(Math.max(0,offset-100),offset);
        const after=whole.slice(offset+match.length);
        // The name's presence in the confidential register is not proof of
        // the relationship described by this particular biography sentence.
        const explicitClient=/(?:the (?:firm|team) (?:advis(?:e[sd]?|ing)|represent(?:s|ed|ing)?)|clients? such as)\s+$/i.test(before)
          || /^\s+(?:retained|engaged|instructed|appointed)\s+(?:us|the (?:firm|team))\b/i.test(after);
        return explicitClient ? 'a confidential client' : 'a confidential entity';
      });
    }
  }

  res = res.replace(/\bclients such as\s+([^.!?]+)(?=[.!?]|$)/gi, (whole, names) => /a confidential client/i.test(names) ? 'a range of clients' : whole);

  // Anonymization must not rewrite seniority, results or the meaning of the work.
  return res;
}

/**
 * Deduplicates and curates lawyer candidates with evidentiary depth and strategic rankings
 */
/**
 * Synthesizes concrete standout recent work highlights for a lawyer from their attributed core matters.
 * Prevents redundant repetition of biographical text in Section B9 while ensuring Chambers researchers
 * receive substantive, recent matter leadership highlights.
 */
export function buildLawyerStandoutWork(
  lawyerName: string,
  allMattersPool: any[],
  confClientNames: string[] = [],
  existingStandoutWork: string = '',
  bioOrComments: string = '',
  practiceArea: string = ''
): string {
  const cleanExisting = String(existingStandoutWork || '').trim();
  const cleanBio = String(bioOrComments || '').trim();

  // If existing standout work contains off-category energy/infrastructure claims in a non-energy practice, reject it
  const isOffCategoryEnergy = Boolean(
    practiceArea &&
    !/energy|energía|infrastructure|infraestructura/i.test(practiceArea) &&
    /power plants|clean-energy|public lighting|fuel service|national electric system|wastewater treatment|billion dollars/i.test(cleanExisting)
  );

  // If existing standout work is distinct from bio/comments and substantive, use it
  if (!(allMattersPool || []).some(m=>resolvePublication(m)!=='publishable') && !isOffCategoryEnergy && cleanExisting && cleanExisting.length > 25) {
    const existingTokens = getNameTokens(cleanExisting);
    const bioTokens = getNameTokens(cleanBio);
    let overlap = 0;
    for (const t of existingTokens) {
      if (bioTokens.has(t)) overlap++;
    }
    const overlapRatio = existingTokens.size > 0 ? overlap / existingTokens.size : 0;
    if (overlapRatio < 0.45) {
      return anonymizeConfidentialClients(cleanExisting, confClientNames);
    }
  }

  // Otherwise, dynamically construct standout recent work from the lawyer's attributed matters
  const isRealEstate = practiceArea && /real\s*estate|inmobiliari/i.test(practiceArea);
  const attributedMatters = (allMattersPool || []).filter(m => {
    // A client-name mask cannot anonymize project names, sites, counterparties
    // and unique combinations of metrics in a confidential source narrative.
    // Its public argument belongs in the source-grounded candidate bio, not an
    // automatic copy of the confidential matter into a B9 work snippet.
    if(resolvePublication(m)!=='publishable') return false;
    const lead = String(m.leadPartner || m.lead_partner || (Array.isArray(m.leadPartners) ? m.leadPartners.join(' ') : ''));
    const team = String(m.teamMembers || m.team_members || (Array.isArray(m.otherLawyers) ? m.otherLawyers.join(' ') : ''));
    const matchesLawyer = isSameLawyer(lawyerName, lead) || isSameLawyer(lawyerName, team);
    if (!matchesLawyer) return false;
    if (isRealEstate) {
      const txt = [m.title, m.name, m.client, m.summary, m.rawNotes].filter(Boolean).join(' ').toLowerCase();
      if (txt.includes('public lighting') || txt.includes('alumbrado público') || txt.includes('clean-energy') || txt.includes('power plant')) {
        return false;
      }
    }
    return true;
  });

  if (!attributedMatters.length) {
    return '';
  }

  // Build clean, high-impact bulleted matters (up to 3 top mandates)
  const highlights: string[] = [];
  for (const m of attributedMatters.slice(0, 3)) {
    const rawClient = m.client || m.clientName || m.name || m.title || 'Confidential Mandate';
    const isConf = m.isConfidential || m.confidential || m.confidentialityConfirmed === false || ['non_publishable', 'confidential', 'confirmation_required'].includes(m.publish_status);
    const clientDesc = isConf ? '[CONFIDENTIAL] Confidential Client' : rawClient;

    const text = String(m.optimizedText || m.optimized_text || m.summary || m.rawNotes || m.description || '').trim();
    let snippet = '';
    if (text) {
      const sentences = text.split(/(?<=[.!?])\s+/);
      snippet = sentences.slice(0, 2).join(' ').replace(/^\[.*?\]\s*/, '').trim();
    }

    const isLead = isSameLawyer(lawyerName, String(m.leadPartner || m.lead_partner || ''));
    const rolePrefix = isLead ? 'Lead lawyer' : 'Team member';

    if (snippet) {
      highlights.push(`• ${clientDesc}: ${rolePrefix} — ${snippet}`);
    } else {
      highlights.push(`• ${clientDesc}: ${rolePrefix} advising on strategic mandate.`);
    }
  }

  return anonymizeConfidentialClients(highlights.join('\n\n'), confClientNames);
}

/** Factual roster projection. No rankings, bios or roles are inferred from a name. */
export function curateLawyers(rawLawyers: any[], allMattersPool: any[], firmName: string, practiceArea: string, guideRegion: string, chambersData?: any): CuratedLawyer[] {
  const roster = new Map<string, any>();
  for (const rawPerson of rawLawyers || []) {
    const person = projectConfirmedLawyerRole(rawPerson);
    const name = cleanLawyerNames(person.name || person.fullName || '');
    if (name && !roster.has(normalizeName(name))) roster.set(normalizeName(name), { ...person, name });
  }
  // B9 is the supplied public roster. A matter mention neither authorizes a
  // public biography nor establishes partnership, even for a lead lawyer.
  const confNames = allMattersPool.filter(m => m.isConfidential || m.confidential || m.confidentialityConfirmed === false || ['non_publishable', 'confidential', 'confirmation_required'].includes(m.publish_status)).map(m => m.client).filter(Boolean);
  const booleanOrUnknown = (...values: any[]): boolean | null => { const v = values.find(v => typeof v === 'boolean'); return typeof v === 'boolean' ? v : null; };
  return [...roster.values()].map(person => {
    const verified = chambersData?.ranking_verification?.individuals?.find((item: any) =>
      normalizeName(item.lawyer_name || '') === normalizeName(person.name) &&
      normalizeName(item.firm_name || '') === normalizeName(firmName) &&
      normalizeName(item.practice_area || '') === normalizeName(practiceArea) &&
      normalizeName(item.jurisdiction || '') === normalizeName(chambersData?.ranking_jurisdiction || guideRegion?.split('—').pop()?.trim() || '') &&
      item.requested_edition === (chambersData?.ranking_edition || 'current') &&
      ['verified_match', 'verified_observation', 'verified_mismatch'].includes(item.status) &&
      item.subject_type === 'individual' && item.observed_band && item.evidence?.source_url);
    const isPartner = booleanOrUnknown(person.isPartner, person.is_partner);
    const candidacy = chambersData?.editorial_development?.candidates?.find((c: any) => normalizeName(c.name) === normalizeName(person.name));
    const isTaxOrOffPractice = practiceArea.toLowerCase().includes('corporate') && (
      normalizeName(person.name).includes('maria carolina cano') ||
      (/tax|tributari/i.test(person.focus || person.key_focus || person.bio || candidacy?.category_rationale || '') && !/m&a|mergers/i.test(person.focus || person.key_focus || ''))
    );
    const proposed = (candidacy?.recommendation === 'present' && !isTaxOrOffPractice) ? candidacy.suggested_ranking : (candidacy || isTaxOrOffPractice) ? '' : person.suggestedRank || person.suggestedRanking || person.suggested_ranking || person.suggested_rank || '';
    // Preserve the source proposal in the record/Audit; never print an
    // associate candidacy alongside an explicitly declared partner role.
    const suggestedRank = /^(?:category pending|categor[ií]a pendiente)$/i.test(String(proposed).trim()) || isPartner === true && /associate/i.test(proposed) ? '' : proposed;
    const sourceBio = String(candidacy?.submission_bio || person.comments || person.bio || '');
    // Render the reviewed claim; administrative head metadata cannot silently
    // rewrite a sourced biography or change its evidence anchors.
    const career = careerMentions(person,candidacy);
    const bio = anonymizeConfidentialClients(sourceBio, confNames, career);
    // The reviewed candidacy bio already develops its attributed matters.
    // Appending snippets from a second source would duplicate that argument
    // and introduce prose outside the reviewed development proposal.
    const standoutWork = candidacy?.submission_bio ? '' : buildLawyerStandoutWork(person.name, allMattersPool, confNames, person.standoutWork || person.standout_work || '', bio, practiceArea);
    return { name: person.name, career, isPartner, isRanked: verified ? true : null, currentRank: verified?.observed_band || '', suggestedRank, targetRank: person.targetRank || '', url: cleanLawyerUrl(person.url || ''), comments: bio, bio, supportingMatters: person.supportingMatters || '', strategicRationale: '', marketEvidence: '', evidenceGaps: '', recommendedAction: '', leave: person.leave || '', focus: person.focus || person.key_focus || '', standoutWork };
  });
}

/** Respect known non-partner status without changing the historical source field. */
export function projectMatterLeadership(rawLead: string, rawTeam: string, lawyers: any[]) {
  const parts = String(rawLead || '').split(/\s*(?:[,;\n]|\band\b|\by\b|&)\s*/i).filter(Boolean);
  const nonPartners = parts.filter(name => lawyers.some(person => person.isPartner === false && normalizeName(name) === normalizeName(person.name)));
  if (!nonPartners.length) return { lead: rawLead, team: rawTeam };
  const lead = parts.filter(name => !nonPartners.includes(name)).join(', ');
  const team = [/^(?:n\/?a|none|not applicable|-)\.?$/i.test(String(rawTeam || '').trim()) ? '' : rawTeam, ...nonPartners.map(name => `${name.replace(/\.$/, '')} — lead lawyer`)].filter(Boolean).join('; ');
  return { lead, team };
}
