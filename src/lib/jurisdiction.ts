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

  // Known institutional firm jurisdiction anchors
  if (firmLower.includes('araquereyna') || firmLower.includes('araque reyna')) {
    return 'Venezuela';
  }
  if (firmLower.includes('deforest')) {
    return 'Mexico';
  }

  // 1. Check matters linguistic and institutional indicators first
  const matters = submission?.matters || chambersData?.matters || [];
  const scores: Record<string, number> = {
    'Mexico': 0,
    'Venezuela': 0,
    'Colombia': 0,
    'Peru': 0,
    'Chile': 0,
    'Spain': 0,
    'Brazil': 0,
    'United States': 0,
    'United Kingdom': 0,
    'Argentina': 0
  };

  for (const m of matters) {
    const text = JSON.stringify(m).toLowerCase();
    
    // Mexico indicators
    if (/\b(mxn|pesos mexicanos|jalisco|guadalajara|durango|mexico|méxico|guanajuato|amparo|cdmx|monterrey|sat|stps|cfcrl|repse|infonavit|imss|anade)\b/i.test(text)) {
      scores['Mexico'] += 2;
    }
    // Venezuela indicators
    if (/\b(sudeban|caracas|maracaibo|valencia|venezuela|veb|bcv|seniat|tsj|contencioso tributario|minpptrass|avdt)\b/i.test(text)) {
      scores['Venezuela'] += 2;
    }
    // Colombia indicators
    if (/\b(cop|pesos colombianos|bogot[aá]|medell[ií]n|colombia|dian|supersociedades|superfinanciera)\b/i.test(text)) {
      scores['Colombia'] += 2;
    }
    // Peru indicators
    if (/\b(pen|soles|lima|per[uú]|sunat|indecopi)\b/i.test(text)) {
      scores['Peru'] += 2;
    }
    // Chile indicators
    if (/\b(clp|santiago|chile|sii|cmf)\b/i.test(text)) {
      scores['Chile'] += 2;
    }
    // Spain indicators
    if (/\b(madrid|barcelona|españa|spain|aeat|audiencia nacional)\b/i.test(text)) {
      scores['Spain'] += 2;
    }
    // Brazil indicators
    if (/\b(brl|reais|s[aã]o paulo|rio de janeiro|brasil|brazil|receita federal)\b/i.test(text)) {
      scores['Brazil'] += 2;
    }
  }

  let bestMatterCountry = '';
  let maxMatterScore = 0;
  for (const [country, score] of Object.entries(scores)) {
    if (score > maxMatterScore) {
      maxMatterScore = score;
      bestMatterCountry = country;
    }
  }

  // If matter evidence is decisive (e.g. >= 4 points and distinctly higher), let matter evidence rule!
  if (bestMatterCountry && maxMatterScore >= 4) {
    return bestMatterCountry;
  }

  // 2. Direct explicit country / jurisdiction metadata (clean out region prefixes)
  const cleanCountryString = (val: string): string => {
    if (!val) return '';
    let s = val.trim();
    // Strip "Latin America — ", "Chambers Latin America — ", etc.
    s = s.replace(/^(?:chambers\s+)?latin\s+america\s*[-—–]\s*/i, '').trim();
    s = s.replace(/^(?:chambers\s+)?global\s*[-—–]\s*/i, '').trim();
    s = s.replace(/^(?:chambers\s+)?europe\s*[-—–]\s*/i, '').trim();
    s = s.replace(/^(?:chambers\s+)?asia\s*[-—–]\s*/i, '').trim();
    return s;
  };

  const rawExplicit = (
    chambersData?.country ||
    chambersData?.jurisdiction ||
    submission?.country ||
    chambersData?.analysis?.country ||
    chambersData?.analysis?.jurisdiction ||
    ''
  ).trim();

  const explicitCountry = cleanCountryString(rawExplicit);
  const genericRegions = ['latin america', 'europe', 'asia', 'global', 'africa', 'middle east', 'north america', 'caribbean'];

  if (explicitCountry && !genericRegions.includes(explicitCountry.toLowerCase())) {
    return explicitCountry;
  }

  const rawLoc = cleanCountryString(
    (chambersData?.analysis?.location || chambersData?.detectedJurisdiction || submission?.guideRegion || chambersData?.jurisdiction || '').trim()
  );
  const rawLocLower = rawLoc.toLowerCase();

  if (rawLoc && !genericRegions.includes(rawLocLower)) {
    return rawLoc;
  }

  if (bestMatterCountry && maxMatterScore >= 2) {
    return bestMatterCountry;
  }

  return 'Mexico'; // Default directory regional fallback if completely undetermined
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

/**
 * Resolves the primary national and municipal tax authorities for a given country jurisdiction.
 * Prevents Mexican SAT or other local authorities from leaking into other jurisdictions.
 */
export function resolveTaxAuthority(country: string): string {
  const c = (country || '').toLowerCase().trim();
  if (c.includes('venezuela')) return 'SENIAT and Municipal Tax Administrations';
  if (c.includes('mexic')) return 'SAT and local treasury authorities';
  if (c.includes('colombia')) return 'DIAN (Dirección de Impuestos y Aduanas Nacionales)';
  if (c.includes('peru') || c.includes('perú')) return 'SUNAT';
  if (c.includes('chile')) return 'Servicio de Impuestos Internos (SII)';
  if (c.includes('argentina')) return 'AFIP / ARCA';
  if (c.includes('spain') || c.includes('españa')) return 'Agencia Tributaria (AEAT)';
  if (c.includes('brazil') || c.includes('brasil')) return 'Receita Federal';
  if (c.includes('united states') || c.includes('usa') || c.includes('us')) return 'IRS and state revenue departments';
  if (c.includes('united kingdom') || c.includes('uk')) return 'HMRC';
  return 'national and municipal tax administrations';
}

/**
 * Resolves the appropriate labor and banking authorities by jurisdiction.
 */
export function resolveRegulatoryAuthority(country: string, practiceArea: string): string {
  const c = (country || '').toLowerCase().trim();
  const p = (practiceArea || '').toLowerCase().trim();

  if (p.includes('tax') || p.includes('fiscal') || p.includes('tributar')) {
    return resolveTaxAuthority(country);
  }
  if (p.includes('labour') || p.includes('labor') || p.includes('employment')) {
    if (c.includes('mexic')) return 'STPS and Federal/Local Labor Courts (CFCRL)';
    if (c.includes('venezuela')) return 'Ministry of Labour (MINPPTRASS) and Labour Courts';
    if (c.includes('colombia')) return 'Ministry of Labour';
    return 'national labour authorities and courts';
  }
  if (p.includes('banking') || p.includes('finance') || p.includes('financ')) {
    if (c.includes('mexic')) return 'CNBV and Banco de México';
    if (c.includes('venezuela')) return 'SUDEBAN and Banco Central de Venezuela (BCV)';
    if (c.includes('colombia')) return 'Superintendencia Financiera de Colombia';
    return 'central banking and financial superintendencies';
  }
  return 'national regulatory authorities';
}
