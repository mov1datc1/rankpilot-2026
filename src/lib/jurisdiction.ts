/**
 * Jurisdiction Resolution Utilities
 * Resolves country-level jurisdiction from firm names, matters, and submission metadata.
 * Differentiates between Directory Guide/Region (e.g. "Latin America") and Country Jurisdiction (e.g. "Mexico").
 */

export function resolveCountryJurisdiction(
  firmName?: string,
  practiceArea?: string,
  chambersData?: any,
  submission?: any
): string {
  const firmLower = (firmName || chambersData?.firm_name || chambersData?.firmName || '').toLowerCase();
  const rawLoc = (chambersData?.analysis?.location || chambersData?.detectedJurisdiction || submission?.guideRegion || chambersData?.jurisdiction || '').trim();
  const rawLocLower = rawLoc.toLowerCase();

  // 1. Explicit firm-to-country mapping
  if (
    firmLower.includes('ramos') || 
    firmLower.includes('castillo') || 
    firmLower.includes('deforest') ||
    firmLower.includes('gonzalez araujo') ||
    firmLower.includes('gonzález araujo')
  ) {
    return 'Mexico';
  }
  if (firmLower.includes('araque') || firmLower.includes('reyna')) {
    return 'Venezuela';
  }

  // 2. If already a country (and not a generic continental region)
  const genericRegions = ['latin america', 'europe', 'asia', 'global', 'africa', 'middle east', 'north america', 'caribbean'];
  if (rawLoc && !genericRegions.includes(rawLocLower)) {
    return rawLoc;
  }

  // 3. Inspect matter descriptions and client details
  const matters = submission?.matters || chambersData?.matters || [];
  let mexicoScore = 0;
  let vzlaScore = 0;
  for (const m of matters) {
    const text = JSON.stringify(m).toLowerCase();
    if (
      text.includes('mxn') || 
      text.includes('jalisco') || 
      text.includes('guadalajara') || 
      text.includes('durango') || 
      text.includes('mexico') || 
      text.includes('méxico') || 
      text.includes('guanajuato') || 
      text.includes('amparo') ||
      text.includes('cdmx') ||
      text.includes('monterrey') ||
      text.includes('sat')
    ) {
      mexicoScore++;
    }
    if (
      text.includes('sudeban') || 
      text.includes('caracas') || 
      text.includes('venezuela') || 
      text.includes('veb') || 
      text.includes('bcv')
    ) {
      vzlaScore++;
    }
  }

  if (mexicoScore > vzlaScore && mexicoScore > 0) return 'Mexico';
  if (vzlaScore > mexicoScore && vzlaScore > 0) return 'Venezuela';

  if (rawLocLower.includes('latin')) return 'Mexico';

  return rawLoc || 'Mexico';
}

/**
 * Sanitizes legacy text that might contain "Latin America" in place of the specific jurisdiction.
 */
export function sanitizeJurisdictionText(text: any, countryJurisdiction: string): any {
  if (!text || typeof text !== 'string' || !countryJurisdiction || countryJurisdiction.toLowerCase() === 'latin america') {
    return text;
  }
  return text
    .replace(/\bacross Latin America\b/gi, `across ${countryJurisdiction}`)
    .replace(/\bin Latin America\b/gi, `in ${countryJurisdiction}`)
    .replace(/\bthroughout Latin America\b/gi, `throughout ${countryJurisdiction}`);
}
