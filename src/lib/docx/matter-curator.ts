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
  evaluationsMap: Map<string, any> = new Map()
): number {
  let score = 50; // base score

  const client = (matter.client || matter.clientName || matter.name || '').toLowerCase();
  const title = (matter.title || '').toLowerCase();
  const summary = (matter.summary || matter.rawNotes || matter.optimizedText || matter.description || '').toLowerCase();
  const combined = `${client} ${title} ${summary}`;

  // 1. Check evaluation score if available from AI audit
  const evalData = evaluationsMap.get(client) || evaluationsMap.get(title);
  if (evalData) {
    if (evalData.quality_label === 'Flagship Matter') score += 30;
    if (typeof evalData.score === 'number') score += evalData.score * 0.1;
  }

  // 2. High-profile landmark anchors (Real Estate flagships from Angela's specification)
  let isRealEstateAnchor = false;
  if (combined.includes('el cielo') || combined.includes('cielo country club')) { score += 160; isRealEstateAnchor = true; }
  if (combined.includes('duranpark')) { score += 140; isRealEstateAnchor = true; }
  if (combined.includes('idex') || combined.includes('brasilia')) { score += 135; isRealEstateAnchor = true; }
  if (combined.includes('diageo')) { score += 130; isRealEstateAnchor = true; }
  if (combined.includes('san carlos') || combined.includes('edificaciones')) { score += 120; isRealEstateAnchor = true; }
  if (combined.includes('la primavera')) { score += 115; isRealEstateAnchor = true; }
  if (combined.includes('inmobiliaria midi') || combined.includes('midi')) { score += 110; isRealEstateAnchor = true; }
  if (combined.includes('holcim')) { score += 105; isRealEstateAnchor = true; }
  if (combined.includes('ochoa gamboa') || combined.includes('dorina')) { score += 95; isRealEstateAnchor = true; }
  if (combined.includes('smb promotora') || combined.includes('smb')) { score += 90; isRealEstateAnchor = true; }
  if (combined.includes('balken')) { score += 85; isRealEstateAnchor = true; }

  // Confidential landmark anchors
  if (combined.includes('villas del colli')) { score += 130; isRealEstateAnchor = true; }
  if (combined.includes('familia de anda') || combined.includes('de anda')) { score += 125; isRealEstateAnchor = true; }
  if (combined.includes('hermosillo') || combined.includes('nom-247')) { score += 120; isRealEstateAnchor = true; }
  if (combined.includes('familia leaño') || combined.includes('leaño')) { score += 100; isRealEstateAnchor = true; }

  // 3. Scale / deal value impact (after normalized extraction)
  const approxValue = extractApproximateValue(matter.value || matter.dealValue || '');
  if (approxValue >= 2000000000) score += 35; // 2B+
  else if (approxValue >= 1000000000) score += 30; // 1B+
  else if (approxValue >= 500000000) score += 25; // 500M+
  else if (approxValue >= 100000000) score += 20; // 100M+
  else if (approxValue >= 10000000) score += 10; // 10M+

  // 4. Precedent & appellate enforcement indicators
  if (combined.includes('enforced in july 2024') || combined.includes('ejecutoria') || combined.includes('suspensión definitiva') || combined.includes('definitive suspension')) {
    score += 15;
  }

  // 5. Practice dilution penalties (off-category cases in Real Estate)
  const safePractice = typeof practiceArea === 'string' ? practiceArea : '';
  const isRealEstate = safePractice.toLowerCase().includes('real estate') || safePractice.toLowerCase().includes('inmobiliario');
  if (isRealEstate && !isRealEstateAnchor) {
    // A. Public procurement / infrastructure / lighting concession / underground mining
    if (
      combined.includes('grupo r') ||
      combined.includes('concesión') ||
      combined.includes('concesion') ||
      combined.includes('alumbrado público') ||
      combined.includes('cominvi') ||
      combined.includes('isseg') ||
      combined.includes('licitación') ||
      combined.includes('licitacion') ||
      combined.includes('mining')
    ) {
      score -= 150;
    }

    // B. Pure roadworks / highway concessions / paving
    if (
      combined.includes('elar constructora') ||
      combined.includes('operadora de vialidades') ||
      combined.includes('vialidades en los altos')
    ) {
      score -= 150;
    }

    // C. Logistics, freight, trucking, vehicle circulation & SICT fines
    const transportRegex = /\b(transportation of goods|transportes|paquetexpress|baruma|logmine|freight|trucking|logistics|logística|logistica|sict|traffic restriction|circulación|fletes)\b/i;
    if (transportRegex.test(combined) && !combined.includes('terreno') && !combined.includes('desarrollo inmobiliario')) {
      score -= 150;
    }

    // D. Pure tax / SAT / fiscal disputes / tax credits (without real property/predial/expropriation nexus)
    const taxRegex = /\b(sat|iva|crédito fiscal|credito fiscal|isr|devolución de iva|devolucion de iva|declaración de impuestos|multas fiscales|tax credit|tax credits|fiscal process|fiscal dispute|fiscal disputes|tax administration)\b/i;
    if (taxRegex.test(combined) && !combined.includes('predial') && !combined.includes('property tax') && !combined.includes('terreno') && !combined.includes('expropiación') && !combined.includes('expropriation')) {
      score -= 150;
    }

    // E. Medical device sales & hospital supplies
    if (
      combined.includes('tecnología médica') ||
      combined.includes('tecnologia medica') ||
      combined.includes('medical devices') ||
      combined.includes('medical-hospital')
    ) {
      score -= 150;
    }

    // F. Labor, IMSS, Infonavit & Ministry of Labor fines
    const laborRegex = /\b(imss|infonavit|cuotas obrero|seguridad social|ministry of labor|stps|inspections by the ministry of labor)\b/i;
    if (laborRegex.test(combined)) {
      score -= 150;
    }

    // G. Packaging manufacture & industrial materials
    if (
      combined.includes('manufacture of packaging') ||
      combined.includes('packaging solutions') ||
      combined.includes('bemis packaging')
    ) {
      score -= 150;
    }

    // H. Automotive dealership & vehicle distribution
    if (
      combined.includes('motormexa') ||
      combined.includes('automotive dealership') ||
      combined.includes('distribuidora de autos') ||
      combined.includes('dealership')
    ) {
      score -= 150;
    }

    // I. Agricultural berry farming & seeds without real estate anchor
    if (
      combined.includes('hortifrut') ||
      combined.includes('production and marketing of berries') ||
      combined.includes('semillas agroproductos') ||
      combined.includes('monsanto')
    ) {
      score -= 150;
    }

    // J. Empty or deficient narrative
    if (combined.includes('devangary')) {
      score -= 150;
    }
  }

  return score;
}

/**
 * Resolves directory and practice-specific maximum matter allowances.
 * Chambers allows up to 30 matters in Real Estate and Dispute Resolution/Litigation.
 * Most other practices follow a 20-matter ceiling (e.g. 13 pub / 7 conf).
 */
export function getDirectoryPracticeAllowance(
  directory: string = '',
  practiceArea: string = ''
): { maxTotal: number; maxPub: number; maxConf: number } {
  const p = (practiceArea || '').toLowerCase();
  const d = (directory || '').toLowerCase();
  const isChambers = !d.includes('500') && !d.includes('legal');

  if (
    isChambers &&
    (p.includes('real estate') ||
      p.includes('inmobiliario') ||
      p.includes('dispute') ||
      p.includes('litig') ||
      p.includes('arbitr'))
  ) {
    return { maxTotal: 30, maxPub: 20, maxConf: 10 };
  }
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
      const match = String(d).match(/^([^:]+):/);
      if (match) auditExclusions.add(match[1].trim().toLowerCase());
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
    const isConfidential = m.isConfidential || m.is_confidential || m.confidential || (publishStatus === 'confidential' || publishStatus === 'non_publishable');
    
    if (isConfidential) {
      rawConf.push(m);
    } else {
      rawPub.push(m);
    }
  }
  
  // Attach scores
  for (const m of rawPub) {
    m._strategicTier = calculateStrategicTier(m, practiceArea, evaluationsMap);
    m._approxValueUsd = extractApproximateValue(m.value || m.dealValue || '');
  }
  for (const m of rawConf) {
    m._strategicTier = calculateStrategicTier(m, practiceArea, evaluationsMap);
    m._approxValueUsd = extractApproximateValue(m.value || m.dealValue || '');
  }

  // v26.37: Synchronize Audit exclusions with final submission
  const isExcluded = (m: any): boolean => {
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
