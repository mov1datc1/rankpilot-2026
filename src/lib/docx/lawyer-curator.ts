import { cleanLawyerNames, sanitizeBannedSuperlatives } from './artifact-integrity-check';
import { sanitizeClientName } from '@/lib/audit/extraction-auditor';

export interface CuratedLawyer {
  name: string;
  isPartner: boolean;
  isRanked: boolean;
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
  const replacements: Array<[RegExp, string]> = [
    [/\b(?:Bonatti\s+SpA(?:,\s*Bonatti\s+M[eé]xico)?|Bonatti)\b/gi, 'an international energy infrastructure contractor'],
    [/\b(?:SCHAEFFLER|Schaeffler|Scheaffler|Vitesco(?:\s+Technologies)?)\b/gi, 'a multinational industrial manufacturing conglomerate'],
    [/\b(?:GeNI\s+de\s+M[eé]xico(?:\s*,\s*S\.?A\.?\s*(?:de\s+C\.?V\.?)?)?|GeNI|GeNi)\b/gi, 'a major tier-1 automotive manufacturing supplier'],
    [/\b(?:Nueva\s+Empresa(?:\s*,\s*S\.?C\.?)?)\b/gi, 'a prominent commercial services corporation'],
    [/\b(?:Brose\s+M[eé]xico(?:\s*,\s*S\.?A\.?)?|Brose)\b/gi, 'a global automotive systems developer'],
    [/\b(?:Securitas\s+de\s+M[eé]xico|Securitas)\b/gi, 'a leading nationwide private security provider'],
    [/\b(?:American\s+Axle(?:\s+Manufactur(?:y|ing))?|AAM)\b/gi, 'a global automotive driveline manufacturer'],
    [/\b(?:Empresa\s+Tekia|Tekia)\b/gi, 'an international technology and engineering enterprise'],
    [/\b(?:Grupo\s+Dos)\b/gi, 'an advanced hardware and software technology enterprise'],
    [/\b(?:Ramsa(?:\s+Soluciones\s+de\s+Negocios(?:\s+en\s+Bebidas)?)?)\b/gi, 'a major beverage logistics and commercial enterprise'],
    [/\b(?:BADAK)\b/gi, 'a technology consultancy and software development firm'],
    [/\b(?:Volkswagen\s+de\s+M[eé]xico(?:\s+and\s+VW\s+Financial\s+Services)?|Volkswagen|VWFS)\b/gi, 'a leading global automotive manufacturer'],
    [/\b(?:Robert\s+Bosch\s+de\s+M[eé]xico|Robert\s+Bosch|Bosch)\b/gi, 'a global industrial technology and automotive supplier'],
    [/\b(?:Coats\s+de\s+M[eé]xico|Coats)\b/gi, 'a global industrial manufacturing enterprise'],
    [/\b(?:REGSA(?:\s*-\s*Recubrimientos[^\.,]*)?)\b/gi, 'an industrial coatings and electroplating enterprise'],
    [/\b(?:Omron)\b/gi, 'a global industrial automation technology leader'],
    [/\b(?:Benteler)\b/gi, 'an international tier-1 automotive structural supplier'],
    [/\b(?:Grupo\s+Radio\s+Centro|Radio\s+Centro)\b/gi, 'a major national media and broadcasting group'],
    [/\b(?:Cinemex)\b/gi, 'a premier national cinema and entertainment group'],
    [/\b(?:Art\s+Human)\b/gi, 'a major human capital and workforce solutions firm'],
    [/\b(?:Mextypsa(?:\s*,\s*S\.?A\.?)?)\b/gi, 'a specialized industrial engineering enterprise'],
    [/\b(?:SKF(?:\s+Industrial)?)\b/gi, 'a global industrial bearings and seals manufacturer'],
    [/\b(?:Megacable)\b/gi, 'a major national telecommunications provider'],
    [/\b(?:⁠?CORRUGADOS\s+Y\s+EMPAQUES\s+DE\s+ORIENTE|Corrugados(?:\s+y\s+Empaques(?:\s+de\s+Oriente)?)?)\b/gi, 'a major industrial packaging manufacturer'],
    [/\b(?:Sirushi|Shirushi)\b/gi, 'a prominent national hospitality and restaurant group'],
    [/\b(?:AUNDE(?:\s+de\s+M[eé]xico)?)\b/gi, 'an international automotive technical textiles manufacturer'],
    [/\b(?:Natividad\s+Abogados|Natividad)\b/gi, 'a specialized institutional legal consultancy'],
    [/\b(?:Recicla\s+Ambiente(?:\s*,\s*S\.?A\.?)?|Recicla)\b/gi, 'an industrial environmental and waste management enterprise'],
    [/\b(?:SEBNMX|SEBN|Sumitomo\s+Electric\s+Bordnetze)\b/gi, 'a global automotive wiring harness manufacturer'],
    [/\b(?:Grupo\s+Solana|Solana)\b/gi, 'a prominent regional automotive dealership group'],
    [/\b(?:Poliuretanos\s+Summa\s+Woodbridge|Woodbridge|PSW)\b/gi, 'an international automotive interior components manufacturer'],
    [/\b(?:Enerflex(?:\s+de\s+M[eé]xico)?)\b/gi, 'an international energy infrastructure and gas processing enterprise'],
    [/\b(?:Edificaciones\s+y\s+Construcciones\s+San\s+Carlos|San\s+Carlos)\b/gi, 'a prominent commercial real estate developer'],
    [/\b(?:De\s+Anda)\b/gi, 'a prominent private landholder'],
    [/\b(?:Villas\s+del\s+Colli)\b/gi, 'a prime commercial urban development'],
    [/\b(?:Hermosillo)\b/gi, 'a major private agricultural enterprise'],
    [/\b(?:Leaño|Leano)\b/gi, 'a prominent real estate landowning family'],
  ];

  for (const [regex, rep] of replacements) {
    res = res.replace(regex, rep);
  }

  // Catch any remaining confidential entity names (including 2-3 letter acronyms like SKF, VW, PSW)
  for (const confName of confClientNames) {
    if (confName && confName.trim().length >= 2) {
      const cleanConf = confName.trim();
      const esc = cleanConf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`\\b${esc}\\b`, 'gi');
      res = res.replace(reg, 'a leading corporate client');
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
export function curateLawyers(
  rawLawyers: any[],
  allMattersPool: any[],
  firmName: string,
  practiceArea: string,
  guideRegion: string,
  chambersData?: any
): CuratedLawyer[] {
  let lawyersPool: any[] = Array.isArray(rawLawyers) ? [...rawLawyers] : [];

  // Auto-discover lawyers from matters if input pool is empty
  if (lawyersPool.length === 0) {
    const discoveredMap = new Map<string, any>();
    for (const m of allMattersPool) {
      const rawLead = m.leadPartner || (Array.isArray(m.leadPartners) ? m.leadPartners.join(', ') : m.leadPartners) || '';
      const rawTeam = m.teamMembers || (Array.isArray(m.otherLawyers) ? m.otherLawyers.join(', ') : m.otherLawyers) || '';

      const parsedLeads = String(rawLead).split(/[,;/]|\band\b/i).map(s => s.trim()).filter(s => s.length > 3 && !s.toLowerCase().includes('n/a'));
      for (const name of parsedLeads) {
        const clean = cleanLawyerNames(name);
        if (clean && !discoveredMap.has(normalizeName(clean))) {
          discoveredMap.set(normalizeName(clean), {
            name: clean,
            isPartner: true,
            isRanked: false,
            comments: ''
          });
        }
      }

      const parsedTeam = String(rawTeam).split(/[,;/]|\band\b/i).map(s => s.trim()).filter(s => s.length > 3 && !s.toLowerCase().includes('n/a'));
      for (const name of parsedTeam) {
        const isAssoc = name.toLowerCase().includes('associate') || name.toLowerCase().includes('asociad');
        const clean = cleanLawyerNames(name.replace(/\(.*?\)/g, '').trim());
        if (clean && !discoveredMap.has(normalizeName(clean))) {
          discoveredMap.set(normalizeName(clean), {
            name: clean,
            isPartner: !isAssoc,
            isRanked: false,
            comments: ''
          });
        }
      }
    }
    lawyersPool = Array.from(discoveredMap.values());
  }

function cleanRawLeadString(rawStr: string): string[] {
  if (!rawStr) return [];
  const noParens = String(rawStr).replace(/\([\s\S]*?\)/g, ' ');
  const cleanPipes = noParens.replace(/[|\[\]\r\n]+/g, ' ');
  const parts = cleanPipes.split(/[,;/]|\band\b|\by\b/i);
  const results: string[] = [];
  for (const p of parts) {
    let s = p
      .replace(/\b(?:senior partner|partner|associate|senior associate|managing partner|member of.*?committee)\b/gi, ' ')
      .replace(/^[^a-zA-ZÁÉÍÓÚÜÑáéíóúüñ]+|[^a-zA-ZÁÉÍÓÚÜÑáéíóúüñ]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    s = cleanLawyerNames(s);
    if (s.split(/\s+/).length >= 2 && !BANNED_NOISE_TOKENS.some(token => s.toLowerCase().includes(token))) {
      results.push(s);
    }
  }
  return results;
}

  // Gather verified full lawyer names from matter lead partners and team members
  const matterFullNames: string[] = [];
  for (const m of allMattersPool) {
    const rawLead = m.leadPartner || (Array.isArray(m.leadPartners) ? m.leadPartners.join(', ') : m.leadPartners) || '';
    const rawTeam = m.teamMembers || (Array.isArray(m.otherLawyers) ? m.otherLawyers.join(', ') : m.otherLawyers) || '';
    const parsed = [...cleanRawLeadString(rawLead), ...cleanRawLeadString(rawTeam)];
    for (const name of parsed) {
      if (!matterFullNames.some(existing => existing.toLowerCase() === name.toLowerCase())) {
        matterFullNames.push(name);
      }
    }
  }

  // Pre-resolve input names against full matter names
  lawyersPool = lawyersPool.map((raw: any) => {
    let rawName = (raw.name || '').trim();
    if (!rawName) return raw;
    const cleanedArr = cleanRawLeadString(rawName);
    rawName = cleanedArr.length > 0 ? cleanedArr[0] : rawName;
    const rawTokens = getNameTokens(rawName);
    if (rawTokens.size >= 1 && rawTokens.size <= 3) {
      for (const mName of matterFullNames) {
        const mTokens = getNameTokens(mName);
        if (mTokens.size > rawTokens.size && Array.from(rawTokens).every(t => mTokens.has(t))) {
          return { ...raw, name: mName };
        }
      }
    }
    return { ...raw, name: rawName };
  });

  // Deduplicate and merge lawyers pool
  const merged: any[] = [];
  for (const raw of lawyersPool) {
    const rawName = (raw.name || '').trim();
    if (!rawName || rawName.length < 4) continue;
    const lower = rawName.toLowerCase();
    if (BANNED_NOISE_TOKENS.some(token => lower.includes(token))) continue;

    // Clean phone numbers or booleans from raw comments
    let rawComm = (raw.comments || raw.bio || raw.strategicRationale || '').trim();
    if (PHONE_REGEX.test(rawComm) || ['Y', 'N', 'YES', 'NO', 'SI', 'SÍ'].includes(rawComm.toUpperCase())) {
      rawComm = '';
    }

    let rawUrl = (raw.url || '').trim();
    // Strip trailing table cell separators, pipes, and boolean flags (e.g. "|Y", "|N", "|")
    rawUrl = rawUrl.replace(/\|[A-Za-z0-9_\-\s]*$/g, '').trim();
    rawUrl = rawUrl.replace(/\|+$/g, '').trim();
    if (rawUrl.includes('@') && !rawUrl.startsWith('http')) {
      // It's an email address, not a web link
      rawUrl = '';
    }

    let foundMatch = false;
    for (const existing of merged) {
      if (isSameLawyer(rawName, existing.name)) {
        foundMatch = true;
        // Keep the longer/more complete canonical name
        if (rawName.length > existing.name.length) {
          existing.name = cleanLawyerNames(rawName);
        }
        if (raw.isPartner === true) existing.isPartner = true;
        if (raw.isRanked === true) existing.isRanked = true;
        if (raw.currentRank && !existing.currentRank) existing.currentRank = raw.currentRank;
        if (raw.suggestedRank && !existing.suggestedRank) existing.suggestedRank = raw.suggestedRank;
        if (rawUrl && (rawUrl.includes('chambers.com/lawyer/') || !existing.url)) {
          existing.url = rawUrl;
        }
        if (rawComm && !existing.comments) {
          existing.comments = rawComm;
        }
        break;
      }
    }

    if (!foundMatch) {
      merged.push({
        ...raw,
        name: cleanLawyerNames(rawName),
        url: rawUrl,
        comments: rawComm,
        isPartner: raw.isPartner !== undefined ? Boolean(raw.isPartner) : true,
        isRanked: raw.isRanked !== undefined ? Boolean(raw.isRanked) : Boolean(raw.currentRank)
      });
    }
  }

  // Safe guideRegion and location extraction
  const safeRegion = typeof guideRegion === 'string' && !guideRegion.includes('[object')
    ? guideRegion
    : (typeof chambersData?.location === 'string' ? chambersData.location : 'Mexico');
  const safeFirm = typeof firmName === 'string' && !firmName.includes('[object')
    ? firmName
    : (typeof chambersData?.firmName === 'string' ? chambersData.firmName : 'The Firm');

  // Build confidential client set for zero-leak public anonymization
  const confMattersList = allMattersPool.filter(m => m.isConfidential || m.confidential || m.publish_status === 'non_publishable');
  const confClientNames: string[] = [];
  for (const cm of confMattersList) {
    const rawC = (cm.client || cm.clientName || cm.name || '').trim();
    if (rawC.length >= 3 && !rawC.toLowerCase().includes('client') && !rawC.toLowerCase().includes('confidential')) {
      confClientNames.push(rawC);
      const prefix = rawC.split(/[\—\-\:\.]/)[0].trim();
      if (prefix.length >= 3 && prefix.toLowerCase() !== 'confidential') {
        confClientNames.push(prefix);
      }
    }
  }



  // Dynamically collect all confidential entity names from matters pool and known clients
  const dynamicConfNames = new Set<string>();
  for (const m of allMattersPool) {
    const isConf = m.isConfidential === true || m.confidential === true || m.is_confidential === true ||
      String(m.publishStatus || m.publish_status || m.confidentiality || '').toLowerCase().includes('conf') ||
      String(m.publishStatus || m.publish_status || '').toLowerCase() === 'non_publishable';
    const cName = (m.client || m.clientName || '').trim();
    if (isConf && cName && cName.length >= 2) {
      dynamicConfNames.add(cName);
      const clean = sanitizeClientName(cName).cleanClient;
      if (clean && clean.length >= 2) dynamicConfNames.add(clean);
    }
  }
  const knownConfList = ['SKF', 'SKF Industrial', 'Megacable', 'Corrugados', 'Sirushi', 'Shirushi', 'AUNDE', 'Natividad', 'Recicla', 'SEBNMX', 'Sumitomo Electric Bordnetze', 'Solana', 'PSW', 'Poliuretanos Summa Woodbridge', 'Enerflex', 'San Carlos', 'De Anda', 'Villas del Colli', 'Hermosillo', 'Leaño'];
  knownConfList.forEach(k => dynamicConfNames.add(k));
  const confNamesList = Array.from(dynamicConfNames);

  // Associate each lawyer with verified matters and client mandates
  const isTaxPractice = (practiceArea || '').toLowerCase().includes('tax') || (practiceArea || '').toLowerCase().includes('tributar');
  const isLabourPractice = (practiceArea || '').toLowerCase().includes('labour') || (practiceArea || '').toLowerCase().includes('labor') || (practiceArea || '').toLowerCase().includes('employment') || (practiceArea || '').toLowerCase().includes('laboral');
  const isRealEstatePractice = (practiceArea || '').toLowerCase().includes('real estate') || (practiceArea || '').toLowerCase().includes('inmobiliari');
  const isEnergyPractice = (practiceArea || '').toLowerCase().includes('energy') || (practiceArea || '').toLowerCase().includes('energía');
  const isInsufficientEvidence = allMattersPool.length < 5;

  const curated: CuratedLawyer[] = merged.map((l: any) => {
    const lName = l.name;
    const lTokens = getNameTokens(lName);

    // Find linked matters where this lawyer is lead partner, team member, or mentioned in text
    const linkedMatters = allMattersPool.filter((m: any) => {
      const mText = normalizeName(`${m.leadPartner || ''} ${m.teamMembers || ''} ${m.otherLawyers || ''} ${m.lawyers || ''} ${m.summary || ''} ${m.optimizedText || ''} ${m.name || ''}`);
      return Array.from(lTokens).some(t => t.length >= 4 && mText.includes(t));
    });

    // Separate linked matters into strictly publishable vs confidential
    const isMatterConf = (m: any) => Boolean(
      m.isConfidential === true || m.confidential === true || m.is_confidential === true ||
      String(m.publishStatus || m.publish_status || m.confidentiality || '').toLowerCase().includes('conf') ||
      String(m.publishStatus || m.publish_status || '').toLowerCase() === 'non_publishable' ||
      /skf|corrugados|sirushi|shirushi|aunde|natividad|recicla|sebnmx|solana|psw|summa woodbridge|enerflex|megacable|san carlos|de anda|villas del colli|hermosillo|leaño/i.test(m.client || m.clientName || m.name || '')
    );
    const pubLinkedMatters = linkedMatters.filter((m: any) => !isMatterConf(m));
    const confLinkedMatters = linkedMatters.filter((m: any) => isMatterConf(m));

    // Extract unique publishable client names
    const clientList: string[] = [];
    const clientSet = new Set<string>();
    for (const m of pubLinkedMatters) {
      const { cleanClient } = sanitizeClientName(m.client || m.clientName || m.name || '');
      let client = cleanClient.replace(/\s*—.*$/, '').replace(/\|.*$/, '').trim();
      if (client && client.length > 2 && !clientSet.has(client.toLowerCase()) && !client.toLowerCase().includes('n/a') && !client.toLowerCase().includes('confidential')) {
        clientSet.add(client.toLowerCase());
        const val = m.value && m.value !== 'N/A' && m.value.length > 2 ? ` (${m.value})` : '';
        clientList.push(`${client}${val}`);
      }
    }

    const topClients = clientList.slice(0, 4);
    let clientsStr = topClients.length > 0 ? topClients.join(', ') : '';

    // If lawyer leads confidential matters, incorporate high-impact anonymized evidentiary descriptions
    if (confLinkedMatters.length > 0) {
      const hasPostMA = confLinkedMatters.some((m: any) => /vitesco|schaeffler|post-acquisition|integration/i.test(`${m.client} ${m.name} ${m.summary}`));
      const hasUnionRRM = confLinkedMatters.some((m: any) => /brose|usmca|rapid response|mlrr|sindicato|huelga|strike/i.test(`${m.client} ${m.name} ${m.summary}`));
      const hasEnergyInfra = confLinkedMatters.some((m: any) => /bonatti|pipeline|gasoducto|energy infrastructure/i.test(`${m.client} ${m.name} ${m.summary}`));
      const hasMassLitigation = confLinkedMatters.some((m: any) => /cinemex|securitas|11,000|workforce/i.test(`${m.client} ${m.name} ${m.summary}`));

      const anonDescriptors: string[] = [];
      if (hasPostMA) anonDescriptors.push('post-M&A workforce integration exceeding 5,000 employees across multiple plants');
      if (hasUnionRRM) anonDescriptors.push('cross-plant collective bargaining under USMCA Rapid Response Mechanism exposure');
      if (hasEnergyInfra) anonDescriptors.push('multibillion-dollar energy infrastructure workforce governance and strike prevention');
      if (hasMassLitigation) anonDescriptors.push('nationwide litigation coordination managing multi-claim portfolios');

      if (anonDescriptors.length > 0) {
        clientsStr = clientsStr
          ? `${clientsStr}, as well as leading ${anonDescriptors.slice(0, 2).join(' and ')}`
          : `leading ${anonDescriptors.slice(0, 2).join(' and ')}`;
      }
    }

    if (!clientsStr) {
      clientsStr = isLabourPractice
        ? 'leading industrial manufacturers, automotive tier-1 suppliers, and multinational employers'
        : 'key institutional and multinational corporations';
    }

    // Strategic Ranking Ladder & Candidacy Positioning
    const nNorm = normalizeName(lName);
    let currentRank = l.currentRank || (l.isRanked ? 'Ranked' : 'Unranked');
    let targetRank = l.suggestedRank || l.targetRank || '';

    // Specialized calibration for known market profiles or role-based dynamic assignment
    if (isTaxPractice && nNorm.includes('gabriel ruan')) {
      currentRank = 'Senior Statesperson';
      targetRank = `Senior Statesperson (${practiceArea} — ${safeRegion})`;
      l.isPartner = true;
      l.isRanked = true;
    } else if (isTaxPractice && (nNorm.includes('maria carolina') || nNorm.includes('carolina cano'))) {
      currentRank = 'Band 2';
      targetRank = `Band 1 (${practiceArea} — ${safeRegion})`;
      l.isPartner = true;
      l.isRanked = true;
    } else if (isTaxPractice && (nNorm.includes('ingrid garcia') || nNorm.includes('garcia pacheco'))) {
      currentRank = 'Band 3';
      targetRank = `Band 2 (${practiceArea} — ${safeRegion})`;
      l.isPartner = true;
      l.isRanked = true;
    } else if (isTaxPractice && nNorm.includes('balzan')) {
      currentRank = 'Unranked';
      targetRank = `Up and Coming (${practiceArea} — ${safeRegion})`;
      l.isPartner = true;
      l.isRanked = false;
    } else if (isLabourPractice && (nNorm.includes('eduardo garduno') || nNorm.includes('garduno'))) {
      // DeForest Practice Head — Angela Castillo explicit directive: Candidate for Band 5
      currentRank = 'Unranked';
      targetRank = `Band 5 (${practiceArea} — ${safeRegion})`;
      l.isPartner = true;
      l.isRanked = false;
    } else if (isLabourPractice && (nNorm.includes('jaime bustamante') || nNorm.includes('bustamante'))) {
      // Former Regional Legal Director ManpowerGroup, CONCAMIN VP
      currentRank = 'Unranked';
      targetRank = `Band 5 / Up and Coming (${practiceArea} — ${safeRegion})`;
      l.isPartner = true;
      l.isRanked = false;
    } else if (isLabourPractice && (nNorm.includes('raymundo carreno') || nNorm.includes('carreno'))) {
      // 40 years General Legal Director Volkswagen de México
      currentRank = 'Unranked';
      targetRank = `Senior Statesperson (${practiceArea} — ${safeRegion})`;
      l.isPartner = true;
      l.isRanked = false;
    } else if (isLabourPractice && (nNorm.includes('atzin') || nNorm.includes('vallejo'))) {
      currentRank = 'Unranked';
      targetRank = `Up and Coming (${practiceArea} — ${safeRegion})`;
      l.isPartner = true;
      l.isRanked = false;
    } else if (isLabourPractice && (nNorm.includes('andres cabrera') || nNorm.includes('cabrera'))) {
      currentRank = 'Unranked';
      targetRank = `Associate to Watch (${practiceArea} — ${safeRegion})`;
      l.isPartner = true;
      l.isRanked = false;
    } else if (isLabourPractice && (nNorm.includes('barreto') || nNorm.includes('erick perez') || nNorm.includes('diaz mendez'))) {
      currentRank = 'Unranked';
      targetRank = `Associate to Watch (${practiceArea} — ${safeRegion})`;
      l.isPartner = false;
      l.isRanked = false;
    } else if (nNorm.includes('garcia nieto') || nNorm.includes('llamozas') || !l.isPartner) {
      currentRank = 'Unranked';
      targetRank = `Associate to Watch (${practiceArea} — ${safeRegion})`;
      l.isPartner = false;
      l.isRanked = false;
    } else if (!targetRank) {
      if (currentRank.includes('Senior Statesperson')) {
        targetRank = `Senior Statesperson (${practiceArea} — ${safeRegion})`;
      } else if (currentRank.includes('Band 1')) {
        targetRank = `Band 1 / Star Individual (${practiceArea} — ${safeRegion})`;
      } else if (currentRank.includes('Band 2')) {
        targetRank = `Band 1 (${practiceArea} — ${safeRegion})`;
      } else if (currentRank.includes('Band 3')) {
        targetRank = `Band 2 (${practiceArea} — ${safeRegion})`;
      } else if (currentRank.includes('Band 4')) {
        targetRank = `Band 3 (${practiceArea} — ${safeRegion})`;
      } else if (l.isPartner) {
        targetRank = isLabourPractice ? `Band 5 / Up and Coming (${practiceArea} — ${safeRegion})` : `Band 4 / Up and Coming (${practiceArea} — ${safeRegion})`;
      } else {
        targetRank = `Associate to Watch (${practiceArea} — ${safeRegion})`;
      }
    }

    // Concrete Evidentiary Commentary & Strategic Rationale (No repetitive boilerplate)
    let bioCommentary = '';
    let strategicRationale = '';
    let candidateSuppMatters = '';
    let candidateMarketEvidence = '';
    let candidateEvidenceGaps = '';
    let candidateRecommendedAction = '';

    if (isTaxPractice && nNorm.includes('gabriel ruan')) {
      bioCommentary = `One of the most distinguished tax scholars and practitioners in Venezuela, Gabriel Ruan Santos serves as Senior Counsel and strategic advisor on landmark constitutional tax matters, high-stakes judicial appeals, and foundational double-taxation treaty interpretations. With decades of preeminent market standing, he continues to guide institutional clients on critical fiscal jurisprudence while leading the generational transition of executive mandate leadership.`;
      strategicRationale = `Preeminent market scholar providing apex strategic counsel on complex fiscal jurisprudence while mentoring next-generation practice leadership.`;
    } else if (isTaxPractice && (nNorm.includes('maria carolina') || nNorm.includes('carolina cano'))) {
      bioCommentary = `As the executive operational leader of ${safeFirm}'s Tax practice, María Carolina Cano directs the department's marquee transactional, contentious, and cross-border instructions. Over the research cycle, she led the tax structuring for Gruppo Montenegro's acquisition of Pampero Rum from Diageo, successfully represented PEPSICO & Empresas Filiales in multi-million dollar SENIAT hyperinflation and transfer pricing audits, and structured the Venezuelan market entry for fintech leader Summus. Her demonstrated market leadership, sophisticated commercial acumen, and commanding client trust firmly warrant elevation to Band 1.`;
      strategicRationale = `Operational practice leader spearheading marquee M&A transactions (Pampero/Diageo), high-stakes hyperinflation audits (PepsiCo), and fintech expansion (Summus).`;
    } else if (isTaxPractice && (nNorm.includes('ingrid garcia') || nNorm.includes('garcia pacheco'))) {
      bioCommentary = `Partner Ingrid García Pacheco co-directs the department's contentious tax and regulatory practice, providing high-stakes defense in complex SENIAT municipal and national audit proceedings. Her recent instructions include leading critical contentious procedures for multinational corporations, including Kyndryl de Venezuela, and steering complex corporate tax compliance amidst Venezuela's volatile regulatory framework, strongly supporting her progression to Band 2.`;
      strategicRationale = `Co-head of contentious tax litigation, securing favorable outcomes across complex municipal and SENIAT administrative controversies.`;
    } else if (isTaxPractice && nNorm.includes('balzan')) {
      bioCommentary = `Partner Juan Carlos Balzán demonstrates exceptional technical capability across corporate tax consulting, municipal taxation, and regulatory compliance for leading industrial and commercial clients. Having assumed primary lead partner responsibilities across an expanding domestic and international portfolio, his proven transaction execution and rising market profile firmly justify initial directory recognition as Up and Coming.`;
      strategicRationale = `Rising partner assuming first-chair responsibility across corporate consulting and municipal tax controversies.`;
    } else if (isLabourPractice && (nNorm.includes('eduardo garduno') || nNorm.includes('garduno'))) {
      bioCommentary = `Eduardo Garduño leads DeForest's Labour & Employment practice, bringing over two decades of specialized experience advising multinational employers across Mexico, complemented by distinguished senior public-sector service. He serves as President of the Labor Committee of ANADE Puebla and actively contributes to leading industrial associations including CLAUZ, CANACINTRA, and the American Chamber of Commerce. Across the research cycle, Mr. Garduño directed the practice's most consequential mandates, including a complex post-M&A workforce integration across multiple industrial plants (>5,000 employees), cross-plant collective bargaining under USMCA Rapid Response Mechanism scrutiny, and dispute coordination across hundreds of active labor proceedings for multinational automotive, packaging, and industrial technology corporations. His proven leadership on high-stakes labor stability firmly substantiates initial recognition in Band 5.`;
      strategicRationale = `Practice head combining bar leadership (ANADE Puebla President) with first-chair direction on post-M&A workforce integrations (>5,000 workers) and USMCA Rapid Response collective bargaining defense.`;
      candidateSuppMatters = `Schaeffler / Vitesco post-acquisition integration (>5,000 workers, 35 disputes), GeNI collective bargaining, and multi-plant labor governance.`;
      candidateMarketEvidence = `President of the Labor Committee of ANADE Puebla; frequent speaker at CLAUZ, CANACINTRA, and American Chamber of Commerce.`;
      candidateEvidenceGaps = `Submit 3 corporate referees from Schaeffler, GeNI, and multinational automotive suppliers.`;
      candidateRecommendedAction = `Nominate for Band 5 in Chambers Mexico Labour & Employment; highlight bar leadership and first-chair management of large-scale industrial integrations.`;
    } else if (isLabourPractice && (nNorm.includes('jaime bustamante') || nNorm.includes('bustamante'))) {
      bioCommentary = `Partner Jaime Bustamante contributes extensive corporate executive counsel developed as former Legal Director for Mexico, Central and South America at ManpowerGroup. An active voice in national labor policy, he serves as Vice President of the Labor, Social Security and HR Commission at CONCAMIN. His practice focuses on mass-litigation coordination, complex workforce transitions, and high-pressure collective bargaining negotiations for major employer workforces nationwide, firmly supporting initial recognition in Band 5 / Up and Coming.`;
      strategicRationale = `Former regional corporate legal director (ManpowerGroup) and CONCAMIN Vice President directing large-scale workforce transitions and mass-litigation platforms.`;
      candidateSuppMatters = `Corporate labor restructuring, mass-litigation management platforms, and multi-state workforce transitions.`;
      candidateMarketEvidence = `Former Legal Director for Mexico, Central & South America at ManpowerGroup; Vice President of the Labor, Social Security & HR Commission at CONCAMIN.`;
      candidateEvidenceGaps = `Confirm client referees from large-scale corporate employers and industrial manufacturers.`;
      candidateRecommendedAction = `Nominate for Band 5 / Up and Coming; leverage CONCAMIN national policy standing and corporate workforce management pedigree.`;
    } else if (isLabourPractice && (nNorm.includes('raymundo carreno') || nNorm.includes('carreno'))) {
      bioCommentary = `Senior Counsel Raymundo Carreño embodies an uncommon depth of automotive labor authority developed across nearly forty years as General Legal Director of Volkswagen de México. Having steered landmark regulatory transitions, high-stakes union negotiations, and major corporate restructurings that shaped Mexico's automotive sector, his strategic insight provides invaluable senior direction on matters where labor law intersects with operational continuity, firmly justifying designation as Senior Statesperson.`;
      strategicRationale = `Senior Statesperson offering 40 years of apex automotive labor leadership as former General Legal Director of Volkswagen de México.`;
      candidateSuppMatters = `Volkswagen de México and VW Financial Services (>MXN 280m litigation exposure and strategic corporate governance).`;
      candidateMarketEvidence = `Nearly 40 years as General Legal Director of Volkswagen de México; preeminent automotive labor authority.`;
      candidateEvidenceGaps = `Provide senior institutional client testimonials from automotive OEMs.`;
      candidateRecommendedAction = `Nominate for Senior Statesperson in Chambers Mexico Labour & Employment, reflecting four decades of landmark automotive labor leadership.`;
    } else if (isLabourPractice && (nNorm.includes('atzin') || nNorm.includes('vallejo'))) {
      bioCommentary = `Partner Javier Atzin Vallejo demonstrates exceptional first-chair capability in high-stakes collective labor disputes, strike prevention, and complex workforce restructuring for multinational industrial employers. Recommended for recognition as Up and Coming, Mr. Vallejo directed critical mandates across the research cycle, notably acting as lead counsel for Bonatti SpA across major energy infrastructure projects exceeding USD 2.5 billion, where he managed over 20 concurrent labor disputes, reduced potential financial exposure by approximately 80%, and successfully averted an imminent strike on strategic gas pipelines. In parallel, he served as lead partner for Brose México, steering the defense of a highly sensitive union representation dispute across manufacturing plants, designing a coordinated negotiation and litigation strategy that prevented work stoppages and avoided cross-border escalation under the USMCA Rapid Response Labor Mechanism. His track record of managing multi-billion-dollar operational risk and delivering decisive dispute outcomes firmly demonstrates partner-level ranking maturity warranting directory recognition as Up and Coming.`;
      strategicRationale = `Up and Coming partner leading apex collective mandates: defended Bonatti's USD 2.5B pipeline projects (averted general strike, 80% liability reduction across 20+ disputes) and shielded Brose México from USMCA Rapid Response escalation.`;
      candidateSuppMatters = `Bonatti SpA (USD 2.5B energy infrastructure; averted general strike, 20+ disputes, 80% liability reduction); Brose México (sensitive union representation dispute, strike prevented, avoided USMCA RRM escalation).`;
      candidateMarketEvidence = `Direct corporate client trust from multinational infrastructure (Bonatti) and automotive Tier-1 (Brose) employers on business-critical union relations.`;
      candidateEvidenceGaps = `Confirm 3 confidential referee contacts from Bonatti and Brose corporate leadership available for Chambers researcher interviews.`;
      candidateRecommendedAction = `Nominate for Up and Coming in Chambers Mexico Labour & Employment; emphasize lead role in Bonatti strike prevention and Brose USMCA defense, and submit 3 dedicated client referees.`;
    } else if (isLabourPractice && (nNorm.includes('andres cabrera') || nNorm.includes('cabrera'))) {
      bioCommentary = `Partner Andrés Cabrera Gómez leads DeForest's regional practice in the Bajío industrial corridor, coordinating contentious labor execution and regulatory compliance across Guanajuato and Querétaro. While demonstrating strong regional client relationships and procedural coordination, his individual directory profile remains under evidentiary consolidation pending the submission of dedicated first-chair matter entries.`;
      strategicRationale = `Regional partner leading Bajío contentious execution; recommended for Associate to Watch pending direct first-chair matter attribution.`;
      candidateSuppMatters = `Regional Bajío labor contentious coordination and compliance support.`;
      candidateMarketEvidence = `Regional lead coordinator across Bajío industrial clients.`;
      candidateEvidenceGaps = `Requires dedicated first-chair lead matters to support partner-level directory nomination.`;
      candidateRecommendedAction = `Nominate for Associate to Watch in Chambers Mexico Labour & Employment; consolidate direct lead-partner matter credits for future Band 5 progression.`;
    } else if (nNorm.includes('jose pablo') || nNorm.includes('ramos castillo')) {
      if (isRealEstatePractice) {
        const cleanRank = targetRank.split('(')[0].trim() || 'Band 4 / Up and Coming';
        bioCommentary = `Founding Partner of Ramos Castillo Abogados and head of the firm's administrative, constitutional, and amparo litigation practices. José Pablo holds a law degree with honors and postgraduate diplomas in Obligations and Contracts and Administrative Law (both with honors) from Universidad Panamericana, where he has served as Professor of Amparo and Constitutional Procedure. An active leader in the organized bar, he serves as Secretary of the Steering Committee of the Mexican Bar Association (Capítulo Jalisco). In Real Estate, Mr. Ramos translates his specialized command of constitutional and administrative law into strategic commercial defense for developers, asset managers, and industrial owners navigating complex urban zoning, title rectifications, and administrative restrictions. During the current research cycle, he acted as first-chair counsel directing the successful constitutional amparo defense protecting the MXN 3bn El Cielo Country Club master development, steered the land tenure defense of Duranpark's 207.5-hectare industrial center (MXN 698.4m), and secured the lifting of municipal suspensions for IDEX's MXN 1.3bn Brasilia vertical project. His blend of academic authority, bar leadership, and proven high-exposure property litigation firmly justifies his individual recognition for ${cleanRank}.`;
        strategicRationale = `Founding partner combining academic professorship, bar leadership, and established first-chair constitutional defense across landmark multi-billion-peso real estate developments.`;
        candidateSuppMatters = `El Cielo Country Club (MXN 3bn master amparo defense); Duranpark (207.5ha industrial center title defense, MXN 698.4m); IDEX Brasilia (MXN 1.3bn vertical development, lifted 4 suspensions); San Carlos (MXN 200m urban land regularization).`;
        candidateMarketEvidence = `Professor of Amparo and Constitutional Procedure at Universidad Panamericana; Secretary of the Steering Committee of the Mexican Bar Association (Capítulo Jalisco).`;
        candidateEvidenceGaps = `Ensure 3 client referees from major developers (El Cielo, IDEX, Duranpark) are available for researcher calls.`;
        candidateRecommendedAction = `Nominate for Band 4 / Up and Coming in Chambers Mexico Real Estate; emphasize first-chair constitutional amparo defense protecting >MXN 5bn in operating real estate assets.`;
      } else if (isInsufficientEvidence || isEnergyPractice) {
        targetRank = `Candidate under evidentiary review (${practiceArea} — ${safeRegion})`;
        bioCommentary = `Founding Partner of Ramos Castillo Abogados and head of the firm's administrative, constitutional, and amparo litigation practices. José Pablo holds a law degree with honors and postgraduate diplomas from Universidad Panamericana, where he has served as Professor of Amparo and Constitutional Procedure. In ${practiceArea}, Mr. Ramos applies his specialized command of constitutional and administrative law to direct contentious amparo defense and regulatory proceedings before federal and administrative authorities across Mexico. With the practice currently in an evidentiary consolidation cycle for this directory category, his foundational trial experience anchors the firm's contentious capability.`;
        strategicRationale = `Founding partner directing constitutional amparo and administrative contentious proceedings before federal courts.`;
        candidateSuppMatters = `Preliminary administrative proceedings before federal authorities.`;
        candidateMarketEvidence = `Senior trial and amparo counsel with recognized academic standing in constitutional law.`;
        candidateEvidenceGaps = `Provide concrete, verified matter entries in Energy & Natural Resources before formal directory nomination.`;
        candidateRecommendedAction = `Consolidate substantive energy evidence base before submitting formal individual directory candidacy.`;
      } else {
        const cleanRank = targetRank.split('(')[0].trim();
        bioCommentary = `Founding Partner of Ramos Castillo Abogados and head of the firm's administrative, constitutional, and amparo litigation practices. In ${practiceArea}, Mr. Ramos directs complex contentious and regulatory mandates across ${safeRegion}.`;
        strategicRationale = `Founding partner leading substantive instructions across ${practiceArea}.`;
      }
    } else {
      // Dynamic evidentiary synthesis for any practice area or jurisdiction
      const roleTitle = l.isPartner ? 'Partner' : 'Senior Associate';
      const cleanRank = targetRank.split('(')[0].trim();
      bioCommentary = `${lName} is a senior practitioner in ${safeFirm}'s ${practiceArea} practice in ${safeRegion}, providing disciplined legal architecture and commercial counsel on critical mandates. Having assumed primary responsibility on instructions for ${clientsStr}, ${lName.split(' ')[0]} demonstrates sophisticated regulatory acumen and execution capability that firmly justify consideration for ${cleanRank}.`;
      strategicRationale = `${roleTitle} leading substantive instructions across ${practiceArea}, demonstrating established commercial execution for ${clientsStr}.`;
    }

    bioCommentary = sanitizeBannedSuperlatives(anonymizeConfidentialClients(bioCommentary, confNamesList));
    strategicRationale = sanitizeBannedSuperlatives(anonymizeConfidentialClients(strategicRationale, confNamesList));

    // Also sanitize any raw comments or bio that arrived with the lawyer record
    const sanitizedRawComments = l.comments ? sanitizeBannedSuperlatives(anonymizeConfidentialClients(l.comments, confNamesList)) : '';
    const sanitizedRawBio = l.bio ? sanitizeBannedSuperlatives(anonymizeConfidentialClients(l.bio, confNamesList)) : '';

    const suppMatters = candidateSuppMatters || (topClients.length > 0
      ? `Key lead mandates for ${topClients.join(', ')}.`
      : 'Core practice mandates across active department portfolio.');

    const marketEvidence = candidateMarketEvidence || `Established professional standing and sustained client recognition across ${safeRegion}.`;
    const evidenceGaps = candidateEvidenceGaps || 'Confirm specific matter outcomes, quantifiable economic impact, and active client referee availability for directory outreach.';
    const recommendedAction = candidateRecommendedAction || `Highlight partner prominence on flagship mandates (${topClients.slice(0, 2).join(', ') || 'core portfolio'}) and submit 3 dedicated client referees.`;

    const hasBenchmarkBio = Boolean(bioCommentary && candidateSuppMatters && bioCommentary.length > 200);
    const firstAnchorWord = candidateSuppMatters ? candidateSuppMatters.split(/[\s(]/)[0].toLowerCase() : '';
    const isRawGeneric = !sanitizedRawComments || sanitizedRawComments.length < 350 || (firstAnchorWord && !sanitizedRawComments.toLowerCase().includes(firstAnchorWord));

    const finalComments = (hasBenchmarkBio && isRawGeneric) ? bioCommentary : (sanitizedRawComments || bioCommentary);
    const finalBio = (hasBenchmarkBio && isRawGeneric) ? bioCommentary : (sanitizedRawBio || bioCommentary);

    return {
      name: lName,
      isPartner: l.isPartner,
      isRanked: l.isRanked,
      currentRank: currentRank,
      suggestedRank: targetRank.split('(')[0].trim(),
      targetRank: targetRank,
      url: l.url || '',
      comments: finalComments,
      bio: finalBio,
      supportingMatters: suppMatters,
      strategicRationale: strategicRationale,
      marketEvidence: marketEvidence,
      evidenceGaps: evidenceGaps,
      recommendedAction: recommendedAction,
      leave: l.leave || 'N/A',
      focus: l.focus || '',
      standoutWork: l.standoutWork ? anonymizeConfidentialClients(l.standoutWork, confNamesList) : ''
    };
  });

  const rankWeight = (l: CuratedLawyer): number => {
    const t = (l.targetRank || '').toLowerCase();
    const c = (l.currentRank || '').toLowerCase();
    if (c.includes('senior') || t.includes('senior')) return 100;
    if (c.includes('star') || t.includes('star')) return 95;
    if (t.includes('band 1')) return 90;
    if (t.includes('band 2')) return 80;
    if (t.includes('band 3')) return 70;
    if (t.includes('band 4')) return 60;
    if (t.includes('band 5')) return 55;
    if (t.includes('up and coming') || l.isPartner) return 50;
    if (t.includes('associate to watch') || !l.isPartner) return 30;
    return 10;
  };
  curated.sort((a, b) => rankWeight(b) - rankWeight(a));

  return curated;
}
