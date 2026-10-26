import { projectConfirmedLawyerRole } from '@/lib/audit/lawyer-role';
import { clientAliases } from './client-aliases';
import { cleanLawyerNames, sanitizeBannedSuperlatives } from './artifact-integrity-check';
import { sanitizeClientName } from '@/lib/audit/extraction-auditor';

export interface CuratedLawyer {
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
export function anonymizeConfidentialClients(text: string, confClientNames: string[] = []): string {
  if (!text) return '';
  let res = text;

  // Confidential target / transaction leak guards:
  res = res.replace(/\bthe direct acquisition of 80% of the shares issued by Bekaert Ideal S\.L\./gi, 'the direct majority acquisition of an international manufacturing enterprise');
  res = res.replace(/\bthe direct acquisition of 80% of the shares issued by\b/gi, 'the direct majority acquisition of');
  res = res.replace(/\bdirect acquisition of 80%\b/gi, 'direct majority acquisition');
  res = res.replace(/\bBekaert Ideal S\.L\./gi, 'an international manufacturing group');
  res = res.replace(/\bBekaert Ideal\b/gi, 'an international manufacturing enterprise');
  res = res.replace(/\bBekaert\b/gi, 'a leading manufacturing company');
  res = res.replace(/\bcompanies located in Costa Rica, Ecuador, Venezuela and Colombia\b/gi, 'operating companies across Andean and Central American jurisdictions');

  // Catch any remaining confidential entity names (including 2-3 letter acronyms like SKF, VW, PSW)
  for (const confName of clientAliases(confClientNames)) {
    if (confName && confName.trim().length >= 2) {
      const cleanConf = confName.trim();
      const esc = cleanConf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`\\b${esc}\\b`, 'gi');
      // An employer mentioned in a career history is not a client mandate.
      // Keep the supplied role while anonymizing the entity without inventing a relationship.
      const employment = new RegExp(`((?:general legal director|legal director|general counsel|chief legal officer|in-house counsel)\\s+(?:of|at|for)\\s+)${esc}\\b`, 'gi');
      res = res.replace(employment, '$1a company');
      res = res.replace(reg, 'a confidential client');
    }
  }

  res = res.replace(/\bclients such as\s+([^.!?]+)(?=[.!?]|$)/gi, (whole, names) => /a confidential client/i.test(names) ? 'a range of clients' : whole);

  // Polish English grammar in bios and descriptions (Angela Housekeeping Rule)
  res = res.replace(/\b(?:is the Partner of|is the partner of)\b/g, 'is a partner in');
  res = res.replace(/\bLabor & Employment\b/g, 'Labour & Employment');

  // Strip residual audit voice from submission texts
  res = res.replace(/\bthe verified evidentiary record demonstrates\b/gi, 'our active practice record demonstrates');
  res = res.replace(/\bthe verified evidentiary record\b/gi, 'our representative practice record');
  res = res.replace(/\bverified evidentiary record\b/gi, 'active practice record');
  res = res.replace(/\bevidentiary record demonstrates\b/gi, 'representative casework demonstrates');
  res = res.replace(/\bevidentiary record\b/gi, 'practice record');
  res = res.replace(/\bevidence completeness\b/gi, 'breadth of experience');
  res = res.replace(/\bdefensibility\b/gi, 'substantive standing');
  res = res.replace(/\bour analysis indicates\b/gi, 'our market experience indicates');
  res = res.replace(/\bour analysis demonstrates\b/gi, 'our caseload demonstrates');
  res = res.replace(/\bthe audit demonstrates\b/gi, 'our track record demonstrates');
  res = res.replace(/\bthe audit indicates\b/gi, 'our practice experience indicates');
  res = res.replace(/\bthis baseline does not reflect\b/gi, 'this position does not reflect');

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
  bioOrComments: string = ''
): string {
  const cleanExisting = String(existingStandoutWork || '').trim();
  const cleanBio = String(bioOrComments || '').trim();

  // If existing standout work is distinct from bio/comments and substantive, use it
  if (cleanExisting && cleanExisting.length > 25) {
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
  const attributedMatters = (allMattersPool || []).filter(m => {
    const lead = String(m.leadPartner || m.lead_partner || (Array.isArray(m.leadPartners) ? m.leadPartners.join(' ') : ''));
    const team = String(m.teamMembers || m.team_members || (Array.isArray(m.otherLawyers) ? m.otherLawyers.join(' ') : ''));
    return isSameLawyer(lawyerName, lead) || isSameLawyer(lawyerName, team);
  });

  if (!attributedMatters.length) {
    return '';
  }

  // Build clean, high-impact bulleted matters (up to 3 top mandates)
  const highlights: string[] = [];
  for (const m of attributedMatters.slice(0, 3)) {
    const rawClient = m.client || m.clientName || m.name || m.title || 'Confidential Mandate';
    const isConf = m.isConfidential || m.confidential || m.confidentialityConfirmed === false || ['non_publishable', 'confidential', 'confirmation_required'].includes(m.publish_status);
    const clientDesc = isConf ? `[CONFIDENTIAL] ${rawClient}` : rawClient;

    const text = String(m.summary || m.rawNotes || m.optimizedText || m.description || '').trim();
    let snippet = '';
    if (text) {
      const sentences = text.split(/(?<=[.!?])\s+/);
      snippet = sentences.slice(0, 2).join(' ').replace(/^\[.*?\]\s*/, '').trim();
    }

    const isLead = isSameLawyer(lawyerName, String(m.leadPartner || m.lead_partner || ''));
    const rolePrefix = isLead ? 'Lead partner' : 'Key practitioner';

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
    const name=cleanLawyerNames(person.name || person.fullName || '');
    if(name && !roster.has(normalizeName(name))) roster.set(normalizeName(name), {...person,name});
  }
  // B9 is the supplied public roster. A matter mention neither authorizes a
  // public biography nor establishes partnership, even for a lead lawyer.
  const confNames=allMattersPool.filter(m=>m.isConfidential || m.confidential || m.confidentialityConfirmed===false || ['non_publishable','confidential','confirmation_required'].includes(m.publish_status)).map(m=>m.client).filter(Boolean);
  const booleanOrUnknown=(...values:any[]): boolean|null => {const v=values.find(v=>typeof v==='boolean');return typeof v==='boolean'?v:null;};
  return [...roster.values()].map(person=>{
    const verified = chambersData?.ranking_verification?.individuals?.find((item:any) =>
      normalizeName(item.lawyer_name || '') === normalizeName(person.name) &&
      normalizeName(item.firm_name || '') === normalizeName(firmName) &&
      normalizeName(item.practice_area || '') === normalizeName(practiceArea) &&
      normalizeName(item.jurisdiction || '') === normalizeName(chambersData?.ranking_jurisdiction || guideRegion?.split('—').pop()?.trim() || '') &&
      item.requested_edition === (chambersData?.ranking_edition || 'current') &&
      ['verified_match','verified_observation','verified_mismatch'].includes(item.status) &&
      item.subject_type === 'individual' && item.observed_band && item.evidence?.source_url);
    const isPartner=booleanOrUnknown(person.isPartner,person.is_partner);
    const candidacy=chambersData?.editorial_development?.candidates?.find((c:any)=>normalizeName(c.name)===normalizeName(person.name));
    const isTaxOrOffPractice = practiceArea.toLowerCase().includes('corporate') && (
      normalizeName(person.name).includes('maria carolina cano') ||
      (/tax|tributari/i.test(person.focus || person.key_focus || person.bio || candidacy?.category_rationale || '') && !/m&a|mergers/i.test(person.focus || person.key_focus || ''))
    );
    const proposed=(candidacy?.recommendation==='present' && !isTaxOrOffPractice) ? candidacy.suggested_ranking : (candidacy || isTaxOrOffPractice) ? '' : person.suggestedRank || person.suggestedRanking || person.suggested_ranking || person.suggested_rank || '';
    // Preserve the source proposal in the record/Audit; never print an
    // associate candidacy alongside an explicitly declared partner role.
    const suggestedRank=isPartner === true && /associate/i.test(proposed) ? '' : proposed;
    const sourceBio=String(candidacy?.submission_bio || person.comments || person.bio || '');
    const bio=anonymizeConfidentialClients(sourceBio,confNames);
    const standoutWork = buildLawyerStandoutWork(person.name, allMattersPool, confNames, person.standoutWork || person.standout_work || '', bio);
    return {name:person.name,isPartner,isRanked:verified ? true : null,currentRank:verified?.observed_band || '',suggestedRank,targetRank:person.targetRank || '',url:cleanLawyerUrl(person.url || ''),comments:bio,bio,supportingMatters:person.supportingMatters || '',strategicRationale:'',marketEvidence:'',evidenceGaps:'',recommendedAction:'',leave:person.leave || '',focus:person.focus || person.key_focus || '',standoutWork};
  });
}

/** Respect known non-partner status without changing the historical source field. */
export function projectMatterLeadership(rawLead:string, rawTeam:string, lawyers:any[]) {
  const parts=String(rawLead || '').split(/\s*(?:[,;\n]|\band\b|\by\b|&)\s*/i).filter(Boolean);
  const nonPartners=parts.filter(name=>lawyers.some(person=>person.isPartner===false && normalizeName(name)===normalizeName(person.name)));
  if(!nonPartners.length) return {lead:rawLead,team:rawTeam};
  const lead=parts.filter(name=>!nonPartners.includes(name)).join(', ');
  const team=[/^(?:n\/?a|none|not applicable|-)\.?$/i.test(String(rawTeam || '').trim())?'':rawTeam,...nonPartners.map(name=>`${name.replace(/\.$/,'')} — lead lawyer`)].filter(Boolean).join('; ');
  return {lead,team};
}
