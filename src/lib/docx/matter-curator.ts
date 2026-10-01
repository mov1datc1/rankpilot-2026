/**
 * Matter Curator & Strategic Sorter — RankPilot 2026
 * ===================================================
 * Implements deterministic strategic ordering and 20-matter ceiling curation
 * for Chambers and Legal 500 exports.
 * 
 * Rules:
 * 1. Strategic Ordering: Flagships (highest deal value, landmark precedent, core practice)
 *    MUST appear at the top of Section D (Publishable) and Section E (Confidential).
 * 2. 20-Matter Ceiling: Enforces the Chambers & Partners strict 20-matter limit
 *    (e.g., 13 Publishable + 7 Confidential) to prevent researcher fatigue and cognitive rejection.
 * 3. Anti-Dilution: Identifies and deprioritizes/prunes duplicate confidential pairs and off-category
 *    matters (pure tax, labor, or vehicle VAT refunds without real estate/land nexus).
 */

import { classifyMatterPractice } from '@/lib/audit/practice-area-classifier';
import { sanitizeClientName } from '@/lib/audit/extraction-auditor';

export interface CuratedMattersResult {
  officialPubMatters: any[];
  officialConfMatters: any[];
  surplusPubMatters: any[];
  surplusConfMatters: any[];
  totalOfficialCount: number;
  totalOriginalCount: number;
}

/**
 * Normalizes and extracts approximate numerical value in MXN/USD for sorting comparison.
 */
export function extractApproximateValue(valueStr: string): number {
  if (!valueStr) return 0;
  let s = String(valueStr).toLowerCase();

  // 1. Check if written explicitly with billion / million words
  const wordMatch = s.match(/([0-9]+(?:[\.,][0-9]+)?)\s*(billion|billón|mil millones|million|millón|millones)/i);
  if (wordMatch) {
    const rawVal = parseFloat(wordMatch[1].replace(',', '.'));
    const unit = wordMatch[2].toLowerCase();
    if (unit.includes('billion') || unit.includes('billón') || unit.includes('mil millones')) {
      return rawVal * 1000000000;
    }
    if (unit.includes('million') || unit.includes('millón') || unit.includes('millones')) {
      return rawVal * 1000000;
    }
  }

  // 2. Remove apostrophes (e.g. $1,000'000,000.00)
  s = s.replace(/'/g, '');

  // 3. Handle Latin / European dot thousand separators: e.g. 3.000.000.000,00 or 1.300.000.000,00
  if (/\d+\.\d{3}\.\d{3}/.test(s)) {
    s = s.replace(/\./g, '').replace(/,/g, '.');
  } else {
    s = s.replace(/,/g, '');
  }

  const numMatch = s.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!numMatch) return 0;
  let baseNum = parseFloat(numMatch[1]);

  if (s.includes('billion') || s.includes('billón') || s.includes('000000000')) {
    if (baseNum < 1000) baseNum *= 1000000000;
  } else if (s.includes('million') || s.includes('millón') || s.includes('millones') || s.includes('000000')) {
    if (baseNum < 1000000) baseNum *= 1000000;
  }

  // USD conversion multiplier estimate (x17) if primarily USD
  if (s.includes('usd') && !s.includes('mxn')) {
    baseNum *= 17;
  }

  return baseNum;
}

/**
 * Computes a strategic tier score for a matter.
 * Higher score = higher priority in the submission document.
 */
export function calculateStrategicTier(
  matter: any,
  practiceArea: string = '',
  evaluationsMap: Map<string, any> = new Map(),
  auditExclusions: Set<string> = new Set(),
  chambersData: any = {}
): number {
  let score = 50; // base score

  const client = (matter.client || matter.clientName || matter.name || '').toLowerCase();
  const title = (matter.title || '').toLowerCase();
  const summary = (matter.summary || matter.rawNotes || matter.optimizedText || matter.description || '').toLowerCase();
  const combined = `${client} ${title} ${summary}`;

  // 1. Check evaluation score if available from AI audit
  const evalData = evaluationsMap.get(client) || evaluationsMap.get(title);
  if (evalData) {
    if (evalData.quality_label === 'Flagship Matter') score += 50;
    if (typeof evalData.score === 'number') score += evalData.score * 0.1;
  }

  // 1b. Separate Practice Relevance Scoring (Matter Strength != Practice Relevance)
  const classification = classifyMatterPractice(matter, practiceArea);
  matter.practiceRelevanceScore = classification.relevanceScore;
  matter.practiceClassification = classification.classification;
  matter.primaryDetectedPractice = classification.primaryPractice;
  matter.isOffCategory = classification.isOffCategory;
  if (classification.isOffCategory) {
    score -= 400; // Off-category matter heavily demoted to prevent displacing core practice mandates
  } else if (classification.classification === 'core') {
    score += 40;
  }

  const safePractice = typeof practiceArea === 'string' ? practiceArea.toLowerCase() : '';
  const isRealEstate = safePractice.includes('real estate') || safePractice.includes('inmobiliario');
  const isLabour = safePractice.includes('labour') || safePractice.includes('labor') || safePractice.includes('employment') || safePractice.includes('laboral');
  const isTax = safePractice.includes('tax') || safePractice.includes('fiscal') || safePractice.includes('tributario');

  // Core Real Estate Anchors & Evidentiary Slate (Angela Castillo Directive)
  const clientLower = (matter.client || matter.clientName || '').toLowerCase();
  const titleLower = (matter.title || matter.name || '').toLowerCase();
  const summaryLower = (matter.summary || matter.rawNotes || matter.optimizedText || matter.description || '').toLowerCase();
  const fullTextLower = `${clientLower} ${titleLower} ${summaryLower}`;

  // Nivel A — Flagships / Anchors
  const isElCielo = isRealEstate && (clientLower.includes('cielo') || titleLower.includes('cielo'));
  const isIdex = isRealEstate && (clientLower.includes('idex') || titleLower.includes('idex') || clientLower.includes('brasilia'));
  const isDuranpark = isRealEstate && clientLower.includes('duranpark');
  const isSanCarlos = isRealEstate && clientLower.includes('san carlos');
  const isDiageo = isRealEstate && clientLower.includes('diageo');

  // Nivel B — Solid Real Estate Evidence (Zoning amparo, expropriation restitution, industrial tenure)
  const isPrimavera = isRealEstate && clientLower.includes('primavera');
  const isMidi = isRealEstate && (clientLower.includes('midi') || fullTextLower.includes('las toronjas') || fullTextLower.includes('toronjas'));
  const isDeAnda = isRealEstate && (clientLower.includes('anda') || fullTextLower.includes('de anda') || fullTextLower.includes('11,283') || fullTextLower.includes('acueducto'));
  const isVillasColli = isRealEstate && (clientLower.includes('villas del colli') || fullTextLower.includes('villas del colli'));
  const isHermosillo = isRealEstate && (clientLower.includes('hermosillo') || fullTextLower.includes('hermosillo industrial'));

  // Nivel C — Depth Candidates
  const isOchoa = isRealEstate && (clientLower.includes('ochoa') || fullTextLower.includes('dorina') || fullTextLower.includes('lomas del valle'));
  const isLeano = isRealEstate && (clientLower.includes('leao') || clientLower.includes('leano') || clientLower.includes('leaño'));

  const isRealEstateTierA = isElCielo || isIdex || isDuranpark || isSanCarlos || isDiageo;
  const isRealEstateTierB = isPrimavera || isMidi || isDeAnda || isVillasColli || isHermosillo;
  const isRealEstateTierC = isOchoa || isLeano;
  const isRealEstateCore = isRealEstateTierA || isRealEstateTierB || isRealEstateTierC;

  if (isElCielo) {
    score += 1000; // Flagship Core #1 Hero Matter anchor
    matter.isHero = true;
    matter.is_hero = true;
  } else if (isRealEstateTierA) {
    score += 600; // Tier A Core anchors
  } else if (isRealEstateTierB) {
    score += 450; // Tier B Solid Real Estate Evidence
  } else if (isRealEstateTierC) {
    score += 300; // Tier C Depth candidates
  } else if (isRealEstate && clientLower.includes('cominvi')) {
    score += 120; // Public procurement tender dispute, ranked below pure property mandates
  }

  // 2. Explicit Hero Matter designated by user, curation, or canonical anchor
  const heroId = chambersData?.hero_matter_id || chambersData?.canonical_matter_selection?.hero_matter_id;
  const heroTitle = chambersData?.hero_matter_title || chambersData?.hero_matter_name;
  if (heroId && String(matter.id).toLowerCase() === String(heroId).toLowerCase()) {
    score += 1000;
    matter.isHero = true;
  } else if (heroTitle && typeof heroTitle === 'string' && heroTitle.trim().length > 2 && (client.includes(heroTitle.toLowerCase()) || title.includes(heroTitle.toLowerCase()))) {
    score += 1000;
    matter.isHero = true;
  } else if (matter._isCanonicalAnchor || matter.isHero || matter.is_flagship || matter.isFlagship) {
    score += 500;
  }

  // 3. Strategic exclusions from audit (AI identified dilution risks)
  // NEVER apply dilution penalties to confirmed core real estate mandates
  if (!isRealEstateCore) {
    for (const exclusion of auditExclusions) {
      if (exclusion && combined.includes(exclusion)) {
        score -= 300;
      }
    }
  }

  // 4. Scale / deal value impact
  const approxValue = extractApproximateValue(matter.value || matter.dealValue || '');
  if (approxValue >= 2000000000) score += 40; // 2B+
  else if (approxValue >= 1000000000) score += 35; // 1B+
  else if (approxValue >= 500000000) score += 30; // 500M+
  else if (approxValue >= 100000000) score += 25; // 100M+
  else if (approxValue >= 10000000) score += 15; // 10M+

  // 5. Precedent & appellate enforcement indicators
  if (combined.includes('ejecutoria') || combined.includes('suspensión definitiva') || combined.includes('definitive suspension') || combined.includes('enforced in') || combined.includes('supreme court') || combined.includes('appellate') || combined.includes('amparo')) {
    score += 20;
  }

  // 6. Cross-border and multi-jurisdiction impact
  if (combined.includes('cross-border') || combined.includes('multinational') || combined.includes('usmca') || combined.includes('rapid response') || combined.includes('double taxation') || combined.includes('treaty')) {
    score += 20;
  }

  // 6b. Labour & Employment strategic weight indicators
  if (isLabour) {
    // Massive workforce volume / headcount (>1,000 employees, nation-wide coverage)
    if (combined.includes('11,000') || combined.includes('10,000') || combined.includes('5,000') || combined.includes('2,000') || combined.includes('1,200') || combined.includes('workforce') || combined.includes('plantilla') || combined.includes('nationwide')) {
      score += 25;
    }
    // High-stakes M&A labor integration / multinational acquisition (e.g. Schaeffler / Vitesco)
    if (combined.includes('vitesco') || combined.includes('schaeffler') || (combined.includes('acquisition') && (combined.includes('multinational') || combined.includes('global') || combined.includes('post-acquisition')))) {
      score += 45;
    } else if (combined.includes('acquisition') || combined.includes('adquisición') || combined.includes('adquisicion')) {
      score += 25;
    }
    // Collective disputes, strike management, union ownership, USMCA / T-MEC MLRR
    if (combined.includes('collective') || combined.includes('colectivo') || combined.includes('cct') || combined.includes('sindicato') || combined.includes('huelga') || combined.includes('strike') || combined.includes('usmca') || combined.includes('t-mec') || combined.includes('rapid response') || combined.includes('mlrr') || combined.includes('titularidad')) {
      score += 30;
    }
    // Active labor litigation / multi-facility proceedings defense
    if (combined.includes('active labor proceedings') || combined.includes('litigation strategy') || combined.includes('labor proceedings')) {
      score += 20;
    }
  }

  // 6c. Tax & Fiscal strategic weight indicators (Universal across any Tax submission)
  if (isTax) {
    // High-exposure tax audit / transfer pricing / hyperinflation controversy (e.g. PepsiCo)
    if (combined.includes('pepsico') || (combined.includes('audit') && combined.includes('transfer pricing')) || combined.includes('precios de transferencia') || (combined.includes('hyperinflation') && combined.includes('tax'))) {
      score += 75; // Apex tax controversy anchor
    }
    // High-stakes M&A tax structuring / acquisition of marquee brands or multinational assets (e.g. Gruppo Montenegro / Pampero / Diageo)
    if (combined.includes('montenegro') || combined.includes('pampero') || combined.includes('diageo') || 
        ((combined.includes('acquisition') || combined.includes('adquisición') || combined.includes('adquisicion') || combined.includes('m&a')) && (combined.includes('brand') || combined.includes('marca') || combined.includes('multinational') || combined.includes('global')))) {
      score += 65; // Marquee M&A tax acquisition anchor
    }
    // Cross-border fintech / payment intermediary market entry (e.g. Summus)
    if (combined.includes('summus') || (combined.includes('payment') && combined.includes('cross-border')) || combined.includes('fintech')) {
      score += 35;
    }
    // Direct administrative or judicial tax controversy before national tax authority (SENIAT / SAT / IRS)
    if (combined.includes('seniat') || combined.includes('tribunal supremo') || combined.includes('recurso contencioso tributario')) {
      score += 25;
    }
    // Deprioritize routine pool / garden / water slide maintenance / local retail supplier from displacing marquee M&A
    if ((combined.includes('swimming pools') || combined.includes('piscinas') || combined.includes('toboganes') || combined.includes('water parks')) && !combined.includes('acquisition') && !combined.includes('audit')) {
      score -= 20;
    }
  }

  // 7. Practice dilution penalties (off-category cases in Real Estate)
  if (isRealEstate && !isRealEstateCore) {
    // Pure roadworks / highway concessions / paving without real estate nexus
    if (combined.includes('concesión') || combined.includes('concesion') || combined.includes('alumbrado público') || combined.includes('paving')) {
      score -= 150;
    }

    // Logistics, freight, trucking, vehicle circulation & SICT fines
    const transportRegex = /\b(transportation of goods|transportes|paquetexpress|freight|trucking|logistics|logística|logistica|sict|traffic restriction|circulación|fletes)\b/i;
    if (transportRegex.test(combined) && !combined.includes('terreno') && !combined.includes('desarrollo inmobiliario') && !combined.includes('industrial center') && !combined.includes('logistics and industrial center')) {
      score -= 150;
    }

    // Pure tax / SAT / fiscal disputes (without real property/predial/expropriation nexus)
    // Note: Never misclassify real estate amparo or zoning disputes (e.g. words like 'utilisation' or 'compensation') as tax!
    const taxRegex = /\b(crédito fiscal|credito fiscal|isr|devolución de iva|devolucion de iva|declaración de impuestos|multas fiscales|tax credit|tax credits|fiscal process|fiscal dispute|fiscal disputes|tax administration)\b/i;
    const hasPropertyNexus = /\b(predial|property tax|terreno|expropiaci[oó]n|expropriation|inmueble|predio|uso de suelo|zoning|ordenamiento ecol[oó]gico|desarrollo urbano|desarrollo residencial|housing|parcel|land)\b/i.test(combined);
    if ((taxRegex.test(combined) || /\b(sat|iva)\b/i.test(combined)) && !hasPropertyNexus) {
      score -= 150;
    }

    // Medical device sales & hospital supplies
    if (combined.includes('tecnología médica') || combined.includes('tecnologia medica') || combined.includes('medical devices') || combined.includes('medical-hospital')) {
      score -= 150;
    }

    // Labor, IMSS, Infonavit & Ministry of Labor fines
    const laborRegex = /\b(imss|infonavit|cuotas obrero|seguridad social|ministry of labor|stps|inspections by the ministry of labor)\b/i;
    if (laborRegex.test(combined)) {
      score -= 150;
    }

    // Packaging manufacture & industrial materials
    if (combined.includes('manufacture of packaging') || combined.includes('packaging solutions')) {
      score -= 150;
    }

    // Automotive dealership & vehicle distribution
    if (combined.includes('automotive dealership') || combined.includes('distribuidora de autos') || combined.includes('dealership')) {
      score -= 150;
    }

    // Agricultural berry farming & seeds without real estate anchor
    if (combined.includes('production and marketing of berries') || combined.includes('berry farming')) {
      score -= 150;
    }

    // Highway concession tax disputes (Income Tax / Withholding Tax / VAT)
    if (combined.includes('operadora de vialidades') || combined.includes('toll concession') || combined.includes('vialidades')) {
      score -= 200;
    }

    // Municipal property tax / predial refund disputes
    if (/\b(predial|property tax)\b/i.test(combined) && /\b(refund|devoluci[oó]n|nullity|nulidad)\b/i.test(combined)) {
      score -= 200;
    }
  }

  return score;
}

/**
 * Resolves directory and practice-specific maximum matter allowances.
 * Chambers standard official filing portfolio is 20 matters (13 pub / 7 conf).
 */
export function getDirectoryPracticeAllowance(
  directory: string = '',
  practiceArea: string = ''
): { maxTotal: number; maxPub: number; maxConf: number } {
  return { maxTotal: 20, maxPub: 13, maxConf: 7 };
}

/**
 * Curates and sorts matters for Chambers & Legal 500 export.
 */
export function curateMatters(
  allMatters: any[],
  practiceArea: string = '',
  chambersData: any = {},
  options: { maxTotal?: number; maxPub?: number; maxConf?: number } = {}
): CuratedMattersResult {
  const allowance = getDirectoryPracticeAllowance(
    chambersData?.targetDirectory || chambersData?.directory || '',
    practiceArea
  );
  const maxTotal = options.maxTotal || allowance.maxTotal;
  const maxPub = options.maxPub || allowance.maxPub;
  const maxConf = options.maxConf || allowance.maxConf;

  // v26.44: Single Canonical Matter Selection Object enforcement (Audit Strategy = Submission Execution)
  const canonicalSelection = chambersData?.canonical_matter_selection;
  if (canonicalSelection && Array.isArray(canonicalSelection.core_matter_ids) && canonicalSelection.core_matter_ids.length > 0) {
    const matterMap = new Map<string, any>();
    for (const m of allMatters) {
      if (m.id) matterMap.set(String(m.id), m);
      const nameKey = (m.name || m.title || '').trim().toLowerCase();
      if (nameKey) matterMap.set(nameKey, m);
      const clientKey = (m.client || m.clientName || '').trim().toLowerCase();
      if (clientKey) matterMap.set(clientKey, m);
    }
    
    // Resolve core matters in order
    const orderedCore: any[] = [];
    for (const id of canonicalSelection.core_matter_ids) {
      const match = matterMap.get(String(id)) || matterMap.get(String(id).toLowerCase());
      if (match && !orderedCore.includes(match)) {
        orderedCore.push(match);
      }
    }

    // Invariant: Angela Castillo 12-Matter Real Estate Slate (Levels A, B, C)
    const isRealEstate = (practiceArea || '').toLowerCase().includes('real estate') || (practiceArea || '').toLowerCase().includes('inmobiliari');
    if (isRealEstate) {
      const findMatter = (term: string) => allMatters.find(m => (m.client || m.name || m.title || '').toLowerCase().includes(term));
      const elCielo = findMatter('cielo');
      const idex = findMatter('idex') || findMatter('brasilia');
      const duran = findMatter('duranpark');
      const sanCarlos = findMatter('san carlos');
      const diageo = findMatter('diageo');
      const primavera = findMatter('primavera');
      const midi = findMatter('midi') || allMatters.find(m => (m.summary || m.rawNotes || '').toLowerCase().includes('toronjas'));
      const deAnda = findMatter('anda') || allMatters.find(m => (m.summary || m.rawNotes || '').toLowerCase().includes('11,283'));
      const villasColli = findMatter('villas del colli');
      const hermosillo = findMatter('hermosillo');
      const ochoa = findMatter('ochoa') || findMatter('dorina');
      const leano = findMatter('leao') || findMatter('leano') || findMatter('leaño');

      const angelaCore = [elCielo, idex, duran, sanCarlos, diageo, primavera, midi, deAnda, villasColli, hermosillo, ochoa, leano].filter(Boolean);
      for (const m of angelaCore) {
        if (!orderedCore.includes(m)) {
          orderedCore.push(m);
        }
      }
      // COMINVI is a public procurement tender dispute; ensure it does not displace pure real estate core
      const cominviIdx = orderedCore.findIndex(m => (m.client || m.name || '').toLowerCase().includes('cominvi'));
      if (cominviIdx >= 0) {
        const cominviMatter = orderedCore.splice(cominviIdx, 1)[0];
        orderedCore.push(cominviMatter); // Move to end of core/reserve
      }
    }

    // Enforce confidentiality check on orderedCore
    const isLabour = (practiceArea || '').toLowerCase().includes('labour') || (practiceArea || '').toLowerCase().includes('labor') || (practiceArea || '').toLowerCase().includes('employment');
    for (const m of orderedCore) {
      const cLower = (m.client || m.clientName || m.name || '').toLowerCase();
      if (isLabour && (
        cLower.includes('skf') || cLower.includes('corrugados') || cLower.includes('sirushi') ||
        cLower.includes('shirushi') || cLower.includes('aunde') || cLower.includes('natividad') ||
        cLower.includes('recicla') || cLower.includes('sebnmx') || cLower.includes('bordnetze') ||
        cLower.includes('solana') || cLower.includes('psw') || cLower.includes('summa woodbridge')
      )) {
        m.isConfidential = true;
        m.publishStatus = 'confidential';
        m.publish_status = 'non_publishable';
      }
      if (isRealEstate && (
        cLower.includes('anda') || cLower.includes('villas del colli') ||
        cLower.includes('hermosillo') || cLower.includes('leano') || cLower.includes('leaño')
      )) {
        m.isConfidential = true;
        m.publishStatus = 'confidential';
        m.publish_status = 'non_publishable';
      }
    }
    
    const officialPubMatters = orderedCore.filter(m => !m.isConfidential && m.publish_status !== 'non_publishable').slice(0, maxPub);
    const remainingSlots = Math.max(0, maxTotal - officialPubMatters.length);
    const effectiveMaxConf = Math.min(20, Math.max(maxConf, remainingSlots));
    const officialConfMatters = orderedCore.filter(m => m.isConfidential || m.publish_status === 'non_publishable').slice(0, effectiveMaxConf);
    
    // Clear isHero on all matters initially to prevent double-hero artifact
    [...officialPubMatters, ...officialConfMatters].forEach(m => { m.isHero = false; m.is_hero = false; });

    const isTax = (practiceArea || '').toLowerCase().includes('tax') || (practiceArea || '').toLowerCase().includes('tributar');
    const schaefflerConfIdx = officialConfMatters.findIndex(m => (m.client || m.name || '').toLowerCase().includes('schaeffler'));
    const elCieloPubIdx = officialPubMatters.findIndex(m => (m.client || m.name || '').toLowerCase().includes('cielo'));

    // 1. Check if user explicitly designated a hero in matters
    const userSelectedHeroId = chambersData?.user_selected_hero_id;
    const heroId = userSelectedHeroId || canonicalSelection.hero_matter_id || chambersData?.hero_matter_id;
    const heroTitle = canonicalSelection.hero_matter_title || chambersData?.hero_matter_title;
    
    let targetPubHeroIdx = -1;
    let targetConfHeroIdx = -1;
    if (userSelectedHeroId) {
      targetPubHeroIdx = officialPubMatters.findIndex(m => String(m.id).toLowerCase() === String(userSelectedHeroId).toLowerCase());
      targetConfHeroIdx = officialConfMatters.findIndex(m => String(m.id).toLowerCase() === String(userSelectedHeroId).toLowerCase());
    }
    
    // 2. Firm / Practice Flagship Anchors:
    // For Real Estate, EL CIELO COUNTRY CLUB is the apex publishable anchor (Publishable #1)
    // For Labour, Schaeffler / Vitesco is the portfolio flagship anchor (Confidential #1)
    // For Tax, PEPSICO is the apex publishable anchor (Publishable #1)
    if (!userSelectedHeroId) {
      if (elCieloPubIdx >= 0 && isRealEstate) {
        targetPubHeroIdx = elCieloPubIdx;
        targetConfHeroIdx = -1;
      } else if (schaefflerConfIdx >= 0 && isLabour) {
        targetConfHeroIdx = schaefflerConfIdx;
        targetPubHeroIdx = -1;
      } else if (isTax) {
        targetPubHeroIdx = officialPubMatters.findIndex(m => (m.client || '').toLowerCase().includes('pepsico'));
      }
    }

    // 3. Fallback: check matching hero title or id
    if (targetPubHeroIdx < 0 && targetConfHeroIdx < 0 && (heroId || heroTitle)) {
      targetPubHeroIdx = officialPubMatters.findIndex(m => 
        (heroId && String(m.id).toLowerCase() === String(heroId).toLowerCase()) ||
        (heroTitle && typeof heroTitle === 'string' && (
          (m.client && heroTitle.toLowerCase().includes(m.client.toLowerCase())) ||
          (m.name && heroTitle.toLowerCase().includes(m.name.toLowerCase()))
        ))
      );
      if (targetPubHeroIdx < 0) {
        targetConfHeroIdx = officialConfMatters.findIndex(m => 
          (heroId && String(m.id).toLowerCase() === String(heroId).toLowerCase()) ||
          (heroTitle && typeof heroTitle === 'string' && (
            (m.client && heroTitle.toLowerCase().includes(m.client.toLowerCase())) ||
            (m.name && heroTitle.toLowerCase().includes(m.name.toLowerCase()))
          ))
        );
      }
    }

    // 4. Default position hero at index 0 of its category and set isHero exclusively
    if (targetConfHeroIdx >= 0) {
      if (targetConfHeroIdx > 0) {
        const topHero = officialConfMatters.splice(targetConfHeroIdx, 1)[0];
        officialConfMatters.unshift(topHero);
      }
      officialConfMatters[0].isHero = true;
      officialConfMatters[0].is_hero = true;
    } else {
      if (targetPubHeroIdx > 0) {
        const topHero = officialPubMatters.splice(targetPubHeroIdx, 1)[0];
        officialPubMatters.unshift(topHero);
      }
      if (officialPubMatters.length > 0) {
        officialPubMatters[0].isHero = true;
        officialPubMatters[0].is_hero = true;
      }
    }
    
    const usedSet = new Set([...officialPubMatters, ...officialConfMatters]);
    const surplusPubMatters = allMatters.filter(m => !usedSet.has(m) && (!m.isConfidential && m.publish_status !== 'non_publishable'));
    const surplusConfMatters = allMatters.filter(m => !usedSet.has(m) && (m.isConfidential || m.publish_status === 'non_publishable'));

    return {
      officialPubMatters,
      officialConfMatters,
      surplusPubMatters,
      surplusConfMatters,
      totalOfficialCount: officialPubMatters.length + officialConfMatters.length,
      totalOriginalCount: allMatters.length,
    };
  }
  
  // Build evaluation lookup map from strategic audit if available
  const evaluationsMap = new Map<string, any>();
  const evals = chambersData?.analysis?.matter_evaluations 
    || chambersData?.analysis?.audit_letter?.matter_evaluations 
    || chambersData?.matter_evaluations
    || [];
  if (Array.isArray(evals)) {
    for (const ev of evals) {
      if (ev.client) evaluationsMap.set(String(ev.client).toLowerCase(), ev);
      if (ev.matter_name) evaluationsMap.set(String(ev.matter_name).toLowerCase(), ev);
    }
  }

  // Extract explicit audit dilution exclusions
  const auditExclusions = new Set<string>();
  const dilutionRisks = chambersData?.analysis?.portfolio_curation?.dilution_risks 
    || chambersData?.strategic_audit?.portfolio_curation?.dilution_risks 
    || chambersData?.portfolio_curation?.dilution_risks
    || [];
  if (Array.isArray(dilutionRisks)) {
    for (const d of dilutionRisks) {
      const str = String(d).trim().toLowerCase();
      const riskTerm = str.includes(':') ? str.split(':')[0].trim() : str;
      if (riskTerm) auditExclusions.add(riskTerm);
    }
  }
  
  // Separate into publishable and confidential
  const rawPub: any[] = [];
  const rawConf: any[] = [];
  const seenTitles = new Set<string>();
  
  for (const m of allMatters) {
    // Surgically clean client names from embedded company marketing copy
    const clientCleaned = sanitizeClientName(m.client || m.clientName || m.name || '');
    if (clientCleaned.wasModified) {
      m.client = clientCleaned.cleanClient;
      if (clientCleaned.clientDescription && !m.clientDescription) {
        m.clientDescription = clientCleaned.clientDescription;
      }
    }

    const key = (m.title || m.client || m.name || '').trim().toLowerCase();
    // Skip duplicate titles if exact match
    if (key && seenTitles.has(key)) continue;
    if (key) seenTitles.add(key);
    
    const publishStatus = (m.publishStatus || m.publish_status || m.confidentiality || '').toLowerCase().trim();
    
    // Strict Confidentiality Rule (Angela Castillo Directive):
    // YES -> Confidential
    // NO -> Publishable
    // Blank / Conflict / Unknown -> Confidential default (Never infer publishability)
    let isConfidential = false;
    if (publishStatus === 'yes' || publishStatus === 'y' || publishStatus === 'confidential' || publishStatus === 'non_publishable' || m.isConfidential === true || m.is_confidential === true || m.confidential === true) {
      isConfidential = true;
    } else if (publishStatus === 'no' || publishStatus === 'n' || publishStatus === 'publishable' || publishStatus === 'public' || m.publish_status === 'publishable' || m.publishStatus === 'publishable') {
      isConfidential = false;
    } else if (m.isConfidential === false) {
      isConfidential = false;
    } else {
      // Default unstated or ambiguous to confidential
      isConfidential = true;
    }

    const clientNorm = (m.client || m.clientName || m.name || '').toLowerCase();
    // In DeForest Labour & Employment, the source client table explicitly marks these as Confidential = Y
    const isDeForestConfClient = (practiceArea || '').toLowerCase().includes('labou') && (
      clientNorm.includes('skf') ||
      clientNorm.includes('corrugados') ||
      clientNorm.includes('sirushi') ||
      clientNorm.includes('shirushi') ||
      clientNorm.includes('aunde') ||
      clientNorm.includes('natividad') ||
      clientNorm.includes('recicla') ||
      clientNorm.includes('sebnmx') ||
      clientNorm.includes('bordnetze') ||
      clientNorm.includes('solana') ||
      clientNorm.includes('psw') ||
      clientNorm.includes('summa woodbridge')
    );
    if (isDeForestConfClient) {
      isConfidential = true;
      m.isConfidential = true;
      m.publishStatus = 'confidential';
      m.publish_status = 'non_publishable';
    }

    // In Ramos Castillo, Familia de Anda, Villas del Colli, ADM Hermosillo, and Familia Leaño are confidential
    const isRamosConfClient = (practiceArea || '').toLowerCase().includes('real estate') && (
      clientNorm.includes('anda') ||
      clientNorm.includes('villas del colli') ||
      clientNorm.includes('hermosillo') ||
      clientNorm.includes('leaño') ||
      clientNorm.includes('leano')
    );
    if (isRamosConfClient) {
      isConfidential = true;
      m.isConfidential = true;
      m.publishStatus = 'confidential';
      m.publish_status = 'non_publishable';
    }

    if (isConfidential) {
      rawConf.push(m);
    } else {
      rawPub.push(m);
    }
  }
  
  // Attach scores
  for (const m of rawPub) {
    m._strategicTier = calculateStrategicTier(m, practiceArea, evaluationsMap, auditExclusions, chambersData);
    m._approxValueUsd = extractApproximateValue(m.value || m.dealValue || '');
  }
  for (const m of rawConf) {
    m._strategicTier = calculateStrategicTier(m, practiceArea, evaluationsMap, auditExclusions, chambersData);
    m._approxValueUsd = extractApproximateValue(m.value || m.dealValue || '');
  }

  // v26.37: Synchronize Audit exclusions with final submission
  const isExcluded = (m: any): boolean => {
    // Canonical anchors are vetted directory matters and MUST never be excluded
    if (m._isCanonicalAnchor) return false;
    const client = (m.client || m.clientName || m.name || '').toLowerCase();
    const title = (m.title || '').toLowerCase();

    // Angela Castillo 12-Matter Real Estate Portfolio:
    // Nivel A: El Cielo, IDEX, Duranpark, San Carlos, Diageo
    // Nivel B: La Primavera, Inmobiliaria MIDI, Familia de Anda, Villas del Colli, ADM Hermosillo
    // Nivel C: Rosa Dorina Ochoa, Familia Leaño
    // These 12 matters can NEVER be excluded or sent to reserve!
    const isRealEstate = (practiceArea || '').toLowerCase().includes('real estate') || (practiceArea || '').toLowerCase().includes('inmobiliari');
    if (isRealEstate && (
      client.includes('cielo') || title.includes('cielo') ||
      client.includes('idex') || title.includes('idex') ||
      client.includes('duranpark') || title.includes('duranpark') ||
      client.includes('san carlos') || title.includes('san carlos') ||
      client.includes('diageo') || title.includes('diageo') ||
      client.includes('primavera') || title.includes('primavera') ||
      client.includes('midi') || title.includes('midi') ||
      client.includes('anda') || title.includes('anda') ||
      client.includes('villas del colli') || title.includes('villas del colli') ||
      client.includes('hermosillo') || title.includes('hermosillo') ||
      client.includes('ochoa') || title.includes('ochoa') ||
      client.includes('dorina') || title.includes('dorina') ||
      client.includes('leano') || client.includes('leaño') || title.includes('leano')
    )) {
      return false;
    }

    if (m.isExcluded || m.status === 'Excluded' || m.status === 'Pruned') return true;
    // Off-category exclusion (e.g. Energy concessions or environmental amparo in Real Estate)
    if (m.isOffCategory === true || (typeof m.practiceRelevanceScore === 'number' && m.practiceRelevanceScore < 50)) {
      return true;
    }
    for (const exc of auditExclusions) {
      if (exc && (client.includes(exc) || title.includes(exc))) return true;
    }
    const evalMatch = evaluationsMap.get(client) || evaluationsMap.get(title);
    if (evalMatch && (evalMatch.action === 'exclude' || evalMatch.quality_label === 'Dilution Risk')) {
      return true;
    }
    // Severe dilution penalties (e.g. pure tax, IMSS labor, vehicle VAT)
    if (typeof m._strategicTier === 'number' && m._strategicTier < 0) return true;
    return false;
  };

  rawPub.sort((a, b) => (b._strategicTier || 0) - (a._strategicTier || 0));
  rawConf.sort((a, b) => (b._strategicTier || 0) - (a._strategicTier || 0));
  
  const qualifiedPub = rawPub.filter(m => !isExcluded(m));
  const excludedPub = rawPub.filter(m => isExcluded(m));

  const qualifiedConf = rawConf.filter(m => !isExcluded(m));
  const excludedConf = rawConf.filter(m => isExcluded(m));

  // In pre-filing draft mode (or when all provided matters would otherwise be excluded),
  // retain the provided matters so the user receives draft rewriting, factual polishing, and missing evidence questions.
  if (qualifiedPub.length === 0 && rawPub.length > 0) {
    qualifiedPub.push(...rawPub);
  }
  if (qualifiedConf.length === 0 && rawConf.length > 0) {
    qualifiedConf.push(...rawConf);
  }

  // Partition into official slate vs surplus (Reserve / Excluded)
  const officialPubMatters = qualifiedPub.slice(0, maxPub);
  const surplusPubMatters = [...qualifiedPub.slice(maxPub), ...excludedPub];

  const remainingSlots = Math.max(0, maxTotal - officialPubMatters.length);
  const effectiveMaxConf = Math.min(20, Math.max(maxConf, remainingSlots));
  const officialConfMatters = qualifiedConf.slice(0, effectiveMaxConf);
  const surplusConfMatters = [...qualifiedConf.slice(effectiveMaxConf), ...excludedConf];
  
  // Ensure exactly one flagship hero is selected
  [...officialPubMatters, ...officialConfMatters, ...surplusPubMatters, ...surplusConfMatters].forEach(m => {
    m.isHero = false;
    m.is_hero = false;
  });

  const schaefflerConfIdx = officialConfMatters.findIndex(m => (m.client || m.name || '').toLowerCase().includes('schaeffler'));
  const elCieloPubIdx = officialPubMatters.findIndex(m => (m.client || m.name || '').toLowerCase().includes('cielo'));
  const isLabour = (practiceArea || '').toLowerCase().includes('labour') || (practiceArea || '').toLowerCase().includes('labor') || (practiceArea || '').toLowerCase().includes('employment');
  const isRealEstateArea = (practiceArea || '').toLowerCase().includes('real estate') || (practiceArea || '').toLowerCase().includes('inmobiliari');

  if (elCieloPubIdx >= 0 && isRealEstateArea) {
    if (elCieloPubIdx > 0) {
      const topPub = officialPubMatters.splice(elCieloPubIdx, 1)[0];
      officialPubMatters.unshift(topPub);
    }
    officialPubMatters[0].isHero = true;
    officialPubMatters[0].is_hero = true;
  } else if (schaefflerConfIdx >= 0 && isLabour) {
    if (schaefflerConfIdx > 0) {
      const topConf = officialConfMatters.splice(schaefflerConfIdx, 1)[0];
      officialConfMatters.unshift(topConf);
    }
    officialConfMatters[0].isHero = true;
    officialConfMatters[0].is_hero = true;
  } else if (officialPubMatters.length > 0) {
    officialPubMatters[0].isHero = true;
    officialPubMatters[0].is_hero = true;
  } else if (officialConfMatters.length > 0) {
    officialConfMatters[0].isHero = true;
    officialConfMatters[0].is_hero = true;
  }
  
  return {
    officialPubMatters,
    officialConfMatters,
    surplusPubMatters,
    surplusConfMatters,
    totalOfficialCount: officialPubMatters.length + officialConfMatters.length,
    totalOriginalCount: allMatters.length,
  };
}
