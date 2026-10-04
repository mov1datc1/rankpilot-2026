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

/**
 * Anonymization dictionary to replace confidential client names with high-impact sector descriptors in public bios.
 * Prevents confidential leaks in public sections (B9, B10, C2) while preserving high-caliber substantive evidence.
 */
export function anonymizeConfidentialClients(text: string, confClientNames: string[] = []): string {
  if (!text) return '';
  let res = text;
  // Catch any remaining confidential entity names (including 2-3 letter acronyms like SKF, VW, PSW)
  for (const confName of confClientNames) {
    if (confName && confName.trim().length >= 2) {
      const cleanConf = confName.trim();
      const esc = cleanConf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`\\b${esc}\\b`, 'gi');
      res = res.replace(reg, 'a confidential client');
    }
  }

  // Polish English grammar in bios and descriptions (Angela Housekeeping Rule)
  res = res.replace(/\b(?:is the Partner of|is the partner of)\b/g, 'leads');
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
/** Factual roster projection. No rankings, bios or roles are inferred from a name. */
export function curateLawyers(rawLawyers: any[], allMattersPool: any[], firmName: string, practiceArea: string, guideRegion: string, chambersData?: any): CuratedLawyer[] {
  const roster = new Map<string, any>();
  for (const person of rawLawyers || []) {
    const name=cleanLawyerNames(person.name || '');
    if(name && !roster.has(normalizeName(name))) roster.set(normalizeName(name), {...person,name});
  }
  for (const matter of allMattersPool) {
    for (const [field,partner] of [[matter.leadPartner || matter.lead_partner,true],[matter.teamMembers || matter.team_members,null]] as const) {
      for(const name of String(field || '').split(/[,;\/]|\band\b/i).map(s=>cleanLawyerNames(s.trim())).filter(s=>s.split(/\s+/).length>=2)) {
        if(!roster.has(normalizeName(name))) roster.set(normalizeName(name),{name,isPartner:partner});
      }
    }
  }
  const confNames=allMattersPool.filter(m=>m.isConfidential || m.confidential || m.confidentialityConfirmed===false || ['non_publishable','confidential','confirmation_required'].includes(m.publish_status)).map(m=>m.client).filter(Boolean);
  const booleanOrUnknown=(...values:any[]): boolean|null => {const v=values.find(v=>typeof v==='boolean');return typeof v==='boolean'?v:null;};
  return [...roster.values()].map(person=>{
    const sourceBio=String(person.comments || person.bio || '');
    const bio=anonymizeConfidentialClients(sourceBio,confNames);
    return {name:person.name,isPartner:booleanOrUnknown(person.isPartner,person.is_partner),isRanked:booleanOrUnknown(person.isRanked,person.is_ranked),currentRank:person.currentRank || person.currentRanking || person.current_ranking || '',suggestedRank:person.suggestedRank || person.suggested_ranking || '',targetRank:person.targetRank || '',url:person.url || '',comments:bio,bio,supportingMatters:person.supportingMatters || '',strategicRationale:'',marketEvidence:'',evidenceGaps:'',recommendedAction:'',leave:person.leave || '',focus:person.focus || person.key_focus || '',standoutWork:anonymizeConfidentialClients(person.standoutWork || person.standout_work || '',confNames)};
  });
}
