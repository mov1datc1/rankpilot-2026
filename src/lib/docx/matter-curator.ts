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

  // 2. High-profile landmark anchors (Real Estate flagships from Strategic Audit & Angela's specification)
  // Publishable 13 Core Anchors (Dominant score hierarchy to guarantee 100% deterministic order)
  if (combined.includes('el cielo') || combined.includes('cielo country club')) {
    matter._isCanonicalAnchor = true;
    return 1000;
  }
  if (combined.includes('duranpark')) {
    matter._isCanonicalAnchor = true;
    return 990;
  }
  if (combined.includes('diageo')) {
    matter._isCanonicalAnchor = true;
    return 980;
  }
  if (combined.includes('idex') || combined.includes('brasilia')) {
    matter._isCanonicalAnchor = true;
    return 970;
  }
  if (combined.includes('san carlos') || combined.includes('edificaciones')) {
    matter._isCanonicalAnchor = true;
    return 960;
  }
  if (combined.includes('inmobiliaria midi') || combined.includes('midi')) {
    matter._isCanonicalAnchor = true;
    return 950;
  }
  if (combined.includes('la primavera') || combined.includes('desarrollo la primavera')) {
    matter._isCanonicalAnchor = true;
    return 940;
  }
  // COMINVI (ISSEG Bicentenario Offices Silao, Gto - MXN 1.059B): Angela explicitly confirmed in 2nd half of publishable matters
  if (combined.includes('cominvi') || (combined.includes('isseg') && (combined.includes('edificio') || combined.includes('bicentenario') || combined.includes('silao')))) {
    matter._isCanonicalAnchor = true;
    return 930;
  }
  if (combined.includes('holcim')) {
    matter._isCanonicalAnchor = true;
    return 920;
  }
  if (combined.includes('ochoa gamboa') || combined.includes('dorina')) {
    matter._isCanonicalAnchor = true;
    return 910;
  }
  if (combined.includes('smb promotora') || combined.includes('smb')) {
    matter._isCanonicalAnchor = true;
    return 900;
  }
  if (combined.includes('vialidades en los altos') || combined.includes('red vía corta') || combined.includes('red via corta') || combined.includes('operadora de vialidades')) {
    matter._isCanonicalAnchor = true;
    return 890;
  }
  if (combined.includes('devangary') || combined.includes('conciencia ambiental')) {
    matter._isCanonicalAnchor = true;
    return 880;
  }

  // Confidential 7 Core Anchors
  if (combined.includes('familia de anda') || combined.includes('de anda')) {
    matter._isCanonicalAnchor = true;
    return 1000;
  }
  if (combined.includes('villas del colli')) {
    matter._isCanonicalAnchor = true;
    return 990;
  }
  if (combined.includes('hermosillo') || combined.includes('nom-247')) {
    matter._isCanonicalAnchor = true;
    return 980;
  }
  if (combined.includes('familia leaño') || combined.includes('leaño')) {
    matter._isCanonicalAnchor = true;
    return 970;
  }
  if (combined.includes('sict') || (combined.includes('transportation of goods') && combined.includes('guadalajara') && !combined.includes('potosinos'))) {
    matter._isCanonicalAnchor = true;
    return 960;
  }
  if (combined.includes('gas pipeline') || combined.includes('pipeline') || combined.includes('confidential matter 13') || (matter.name === 'Confidential Matter 13')) {
    matter._isCanonicalAnchor = true;
    return 950;
  }
  if (combined.includes('monsanto') || combined.includes('semillas agroproductos')) {
    matter._isCanonicalAnchor = true;
    return 940;
  }

  // 3. Scale / deal value impact (for non-anchor candidate matters)
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
  if (isRealEstate) {
    // A. Public procurement / infrastructure / lighting concession / underground mining
    if (
      combined.includes('grupo r') ||
      combined.includes('concesión') ||
      combined.includes('concesion') ||
      combined.includes('alumbrado público') ||
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
      combined.includes('production and marketing of berries')
    ) {
      score -= 150;
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
    let isConfidential = m.isConfidential || m.is_confidential || m.confidential || (publishStatus === 'confidential' || publishStatus === 'non_publishable');
    
    // Canonical overrides for known practice anchors to ensure strict partition
    const combinedKey = `${m.client || ''} ${m.title || ''} ${m.name || ''} ${m.summary || ''}`.toLowerCase();
    if (
      combinedKey.includes('de anda') ||
      combinedKey.includes('villas del colli') ||
      combinedKey.includes('adm hermosillo') ||
      combinedKey.includes('hermosillo') ||
      combinedKey.includes('leaño') ||
      combinedKey.includes('monsanto') ||
      (combinedKey.includes('gas pipeline') || (combinedKey.includes('pipeline') && combinedKey.includes('right of way'))) ||
      (combinedKey.includes('sict') && !combinedKey.includes('potosinos'))
    ) {
      isConfidential = true;
    } else if (
      combinedKey.includes('el cielo') ||
      combinedKey.includes('duranpark') ||
      combinedKey.includes('diageo') ||
      combinedKey.includes('idex') ||
      combinedKey.includes('san carlos') ||
      combinedKey.includes('midi') ||
      combinedKey.includes('la primavera') ||
      combinedKey.includes('cominvi') ||
      (combinedKey.includes('isseg') && (combinedKey.includes('silao') || combinedKey.includes('bicentenario') || combinedKey.includes('edificio'))) ||
      combinedKey.includes('holcim') ||
      combinedKey.includes('dorina') ||
      combinedKey.includes('smb promotora') ||
      combinedKey.includes('devangary') ||
      combinedKey.includes('vialidades en los altos')
    ) {
      isConfidential = false;
    }

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
