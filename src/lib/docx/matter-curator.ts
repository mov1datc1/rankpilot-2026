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
  for (const exclusion of auditExclusions) {
    if (exclusion && combined.includes(exclusion)) {
      score -= 300;
    }
  }

  const safePractice = typeof practiceArea === 'string' ? practiceArea.toLowerCase() : '';
  const isRealEstate = safePractice.includes('real estate') || safePractice.includes('inmobiliario');
  const isLabour = safePractice.includes('labour') || safePractice.includes('labor') || safePractice.includes('employment') || safePractice.includes('laboral');
  const isTax = safePractice.includes('tax') || safePractice.includes('fiscal') || safePractice.includes('tributario');

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

  // 7. Practice dilution penalties (off-category cases in Real Estate)
  if (isRealEstate) {
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
    const taxRegex = /\b(sat|iva|crédito fiscal|credito fiscal|isr|devolución de iva|devolucion de iva|declaración de impuestos|multas fiscales|tax credit|tax credits|fiscal process|fiscal dispute|fiscal disputes|tax administration)\b/i;
    if (taxRegex.test(combined) && !combined.includes('predial') && !combined.includes('property tax') && !combined.includes('terreno') && !combined.includes('expropiación') && !combined.includes('expropriation')) {
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
    
    const officialPubMatters = orderedCore.filter(m => !m.isConfidential && m.publish_status !== 'non_publishable').slice(0, maxPub);
    const officialConfMatters = orderedCore.filter(m => m.isConfidential || m.publish_status === 'non_publishable').slice(0, maxConf);
    
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
    const key = (m.title || m.client || m.name || '').trim().toLowerCase();
    // Skip duplicate titles if exact match
    if (key && seenTitles.has(key)) continue;
    if (key) seenTitles.add(key);
    
    const publishStatus = (m.publishStatus || m.publish_status || m.confidentiality || '').toLowerCase();
    const isConfidential = Boolean(m.isConfidential || m.is_confidential || m.confidential || (publishStatus === 'confidential' || publishStatus === 'non_publishable'));

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
    if (m.isExcluded || m.status === 'Excluded' || m.status === 'Pruned') return true;
    const client = (m.client || m.clientName || m.name || '').toLowerCase();
    const title = (m.title || '').toLowerCase();
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

  // Partition into official slate vs surplus (Reserve / Excluded)
  const officialPubMatters = qualifiedPub.slice(0, maxPub);
  const surplusPubMatters = [...qualifiedPub.slice(maxPub), ...excludedPub];

  const officialConfMatters = qualifiedConf.slice(0, maxConf);
  const surplusConfMatters = [...qualifiedConf.slice(maxConf), ...excludedConf];
  
  return {
    officialPubMatters,
    officialConfMatters,
    surplusPubMatters,
    surplusConfMatters,
    totalOfficialCount: officialPubMatters.length + officialConfMatters.length,
    totalOriginalCount: allMatters.length,
  };
}
