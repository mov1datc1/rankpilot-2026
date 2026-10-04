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

/** Default draft allowance. Publication policy must be verified before final release. */
export function getDirectoryPracticeAllowance(directory: string = '', practiceArea: string = '') {
  return { maxTotal: 20, maxPub: 20, maxConf: 20 };
}

/** Projection of the canonical selection, never a second strategy engine. */
export function curateMatters(allMatters: any[], practiceArea: string = '', chambersData: any = {}, options: {maxTotal?: number; maxPub?: number; maxConf?: number} = {}): CuratedMattersResult {
  const limits = getDirectoryPracticeAllowance(chambersData.directory, practiceArea);
  const maxTotal = options.maxTotal ?? limits.maxTotal;
  const maxPub = options.maxPub ?? limits.maxPub;
  const maxConf = options.maxConf ?? limits.maxConf;
  const unique = new Map<string, any>();
  allMatters.forEach((m, i) => {
    const key = m.id ? String(m.id) : `source-${i}`;
    if (!unique.has(key)) unique.set(key, {...m});
  });
  const matters = [...unique.values()];
  const selection = chambersData.canonical_matter_selection;
  const hasSelection = Array.isArray(selection?.core_matter_ids);
  const byId = new Map(matters.map(m => [String(m.id), m]));
  const candidates = hasSelection
    ? [...new Set<string>(selection.core_matter_ids.map(String))].map(id => byId.get(id)).filter(Boolean)
    : matters.filter(m => !m.isExcluded && !['Excluded', 'Pruned'].includes(m.status));
  const restricted = (m: any) => m.isConfidential === true || m.confidential === true || m.is_confidential === true || m.confidentialityConfirmed === false || ['confirmation_required', 'non_publishable', 'confidential'].includes(m.publish_status || m.confidentialityStatus || m.publishStatus);
  const officialPubMatters: any[] = [], officialConfMatters: any[] = [];
  const selected = new Set<any>();
  for (const m of candidates) {
    const target = restricted(m) ? officialConfMatters : officialPubMatters;
    const cap = restricted(m) ? maxConf : maxPub;
    if (selected.size < maxTotal && target.length < cap) { target.push(m); selected.add(m); }
  }
  const heroId = selection?.hero_matter_id || chambersData.hero_matter_id;
  for (const m of matters) {
    m.isHero = selected.has(m) && !!heroId && String(m.id) === String(heroId);
    m.is_hero = m.isHero;
  }
  const surplus = matters.filter(m => !selected.has(m));
  return {officialPubMatters, officialConfMatters, surplusPubMatters: surplus.filter(m => !restricted(m)), surplusConfMatters: surplus.filter(restricted), totalOfficialCount: selected.size, totalOriginalCount: matters.length};
}
