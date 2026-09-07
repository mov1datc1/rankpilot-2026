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
  const str = String(valueStr).toLowerCase().replace(/,/g, '');
  
  // Look for billion/billion dollars/millones
  const numMatch = str.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!numMatch) return 0;
  let baseNum = parseFloat(numMatch[1]);
  
  if (str.includes('billion') || str.includes('billón') || str.includes('000000000')) {
    if (baseNum < 1000) baseNum *= 1000000000;
  } else if (str.includes('million') || str.includes('millón') || str.includes('millones') || str.includes('000000')) {
    if (baseNum < 1000000) baseNum *= 1000000;
  }
  
  // USD conversion multiplier estimate (x17) if primarily USD
  if (str.includes('usd') && !str.includes('mxn')) {
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
  
  const client = (matter.client || matter.name || '').toLowerCase();
  const title = (matter.title || '').toLowerCase();
  const summary = (matter.summary || matter.rawNotes || matter.optimizedText || '').toLowerCase();
  const combined = `${client} ${title} ${summary}`;
  
  // 1. Check evaluation score if available from AI audit
  const evalData = evaluationsMap.get(client) || evaluationsMap.get(title);
  if (evalData) {
    if (evalData.quality_label === 'Flagship Matter') score += 40;
    if (typeof evalData.score === 'number') score += evalData.score * 0.2;
  }
  
  // 2. High-profile landmark anchors (Real Estate flagships from Angela's specification)
  if (combined.includes('el cielo') || combined.includes('cielo country club')) score += 100;
  if (combined.includes('duranpark')) score += 95;
  if (combined.includes('idex') || combined.includes('brasilia')) score += 90;
  if (combined.includes('diageo')) score += 85;
  if (combined.includes('san carlos') || combined.includes('edificaciones')) score += 75;
  if (combined.includes('la primavera')) score += 70;
  if (combined.includes('familia de anda') || combined.includes('de anda')) score += 80;
  if (combined.includes('villas del colli')) score += 75;
  if (combined.includes('hermosillo') || combined.includes('nom-247')) score += 70;
  if (combined.includes('familia leaño') || combined.includes('leaño')) score += 65;
  
  // 3. Scale / deal value impact
  const approxValue = extractApproximateValue(matter.value || matter.dealValue || '');
  if (approxValue >= 1000000000) score += 30; // 1B+
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
    // Pure vehicle/transport VAT refunds
    if (combined.includes('baruma') || combined.includes('transportes ejecutivos')) score -= 45;
    // Pure SAT / tax disputes without land/property element
    if ((combined.includes('sat') || combined.includes('iva') || combined.includes('vat refund')) && !combined.includes('property tax') && !combined.includes('predial')) {
      score -= 35;
    }
    // Pure IMSS / INFONAVIT worker labor disputes
    if (combined.includes('imss') || combined.includes('infonavit') || combined.includes('cuotas obrero')) {
      score -= 30;
    }
  }
  
  return score;
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
  const maxTotal = options.maxTotal || 20;
  const maxPub = options.maxPub || 13;
  const maxConf = options.maxConf || 7;
  
  // Build evaluation lookup map from strategic audit if available
  const evaluationsMap = new Map<string, any>();
  const evals = chambersData?.analysis?.matter_evaluations 
    || chambersData?.analysis?.audit_letter?.matter_evaluations 
    || [];
  if (Array.isArray(evals)) {
    for (const ev of evals) {
      if (ev.client) evaluationsMap.set(String(ev.client).toLowerCase(), ev);
      if (ev.matter_name) evaluationsMap.set(String(ev.matter_name).toLowerCase(), ev);
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
  
  // Attach scores and sort both arrays by strategic tier descending
  for (const m of rawPub) {
    m._strategicTier = calculateStrategicTier(m, practiceArea, evaluationsMap);
    m._approxValueUsd = extractApproximateValue(m.value || m.dealValue || '');
  }
  for (const m of rawConf) {
    m._strategicTier = calculateStrategicTier(m, practiceArea, evaluationsMap);
    m._approxValueUsd = extractApproximateValue(m.value || m.dealValue || '');
  }

  rawPub.sort((a, b) => (b._strategicTier || 0) - (a._strategicTier || 0));
  rawConf.sort((a, b) => (b._strategicTier || 0) - (a._strategicTier || 0));
  
  // Partition into official slate vs surplus
  const officialPubMatters = rawPub.slice(0, maxPub);
  const surplusPubMatters = rawPub.slice(maxPub);
  
  const officialConfMatters = rawConf.slice(0, maxConf);
  const surplusConfMatters = rawConf.slice(maxConf);
  
  return {
    officialPubMatters,
    officialConfMatters,
    surplusPubMatters,
    surplusConfMatters,
    totalOfficialCount: officialPubMatters.length + officialConfMatters.length,
    totalOriginalCount: allMatters.length,
  };
}
