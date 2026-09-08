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
  if (combined.includes('el cielo') || combined.includes('cielo country club')) score += 160;
  if (combined.includes('duranpark')) score += 140;
  if (combined.includes('idex') || combined.includes('brasilia')) score += 135;
  if (combined.includes('diageo')) score += 130;
  if (combined.includes('san carlos') || combined.includes('edificaciones')) score += 120;
  if (combined.includes('la primavera')) score += 115;
  if (combined.includes('inmobiliaria midi') || combined.includes('midi')) score += 110;
  if (combined.includes('holcim')) score += 105;
  if (combined.includes('ochoa gamboa') || combined.includes('dorina')) score += 95;
  if (combined.includes('smb promotora') || combined.includes('smb')) score += 90;

  // Confidential landmark anchors
  if (combined.includes('villas del colli')) score += 130;
  if (combined.includes('familia de anda') || combined.includes('de anda')) score += 125;
  if (combined.includes('hermosillo') || combined.includes('nom-247')) score += 120;
  if (combined.includes('familia leaño') || combined.includes('leaño')) score += 100;

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
  if (isRealEstate) {
    // A. Public procurement / infrastructure / lighting concession (e.g. Grupo R, COMINVI)
    if (combined.includes('grupo r') || combined.includes('concesión') || combined.includes('concesion') || combined.includes('alumbrado público')) {
      score -= 130;
    }
    if (combined.includes('cominvi') || combined.includes('isseg') || combined.includes('licitación') || combined.includes('licitacion')) {
      score -= 120;
    }

    // B. Pure roadworks / general construction tax credits
    if (combined.includes('elar constructora') || combined.includes('operadora de vialidades')) {
      score -= 110;
    }

    // C. Logistics, freight & vehicle circulation (Paquetexpress, Baruma, Transportes Potosinos)
    if (combined.includes('paquetexpress') || combined.includes('baruma') || combined.includes('transportes ejecutivos') || combined.includes('transportes potosinos')) {
      score -= 110;
    }

    // D. Pure tax / SAT / ISR / IVA disputes without real property element
    const taxRegex = /\b(sat|iva|crédito fiscal|credito fiscal|isr|devolución de iva|devolucion de iva|declaración de impuestos|multas fiscales)\b/i;
    if (taxRegex.test(combined) && !combined.includes('predial') && !combined.includes('property tax') && !combined.includes('terreno') && !combined.includes('expropiación')) {
      score -= 110;
    }

    // E. Medical device sales tax credit (Integración de Tecnología Médica)
    if (combined.includes('tecnología médica') || combined.includes('tecnologia medica') || combined.includes('medical devices')) {
      score -= 110;
    }

    // F. Labor & IMSS / Infonavit (Bemis Packaging)
    const laborRegex = /\b(imss|infonavit|cuotas obrero|seguridad social)\b/i;
    if (laborRegex.test(combined)) {
      score -= 90;
    }

    // G. Trivial / Minor property tax disputes (Monsanto 2M)
    if (combined.includes('monsanto')) {
      score -= 60;
    }

    // H. Empty or deficient narrative
    if (combined.includes('devangary')) {
      score -= 80;
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
