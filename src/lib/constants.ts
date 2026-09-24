/**
 * RankPilot — Shared Dropdown Options
 * Single source of truth for all filter values across Builder and Matter Assistant.
 */

export const DIRECTORIES = [
  'Chambers & Partners',
  'Legal 500',
  'IFLR1000',
  'Leaders League',
  "Who's Who Legal",
  'Benchmark Litigation',
  'Latin Lawyer',
  'Best Lawyers',
] as const;

export const REGIONS = [
  'Latin America',
  'Global',
  'Europe',
  'Asia Pacific',
  'North America',
  'Middle East & Africa',
  'Central America & Caribbean',
] as const;

export const PRACTICE_AREAS = [
  'Banking & Finance',
  'Capital Markets',
  'Competition / Antitrust',
  'Construction',
  'Corporate / M&A',
  'Data Protection & Privacy',
  'Dispute Resolution',
  'Labour & Employment',
  'Energy & Natural Resources',
  'Environment',
  'FinTech',
  'Insurance',
  'Intellectual Property',
  'International Arbitration',
  'International Trade',
  'Investment Funds',
  'Life Sciences / Healthcare',
  'Private Equity',
  'Projects & Infrastructure',
  'Real Estate',
  'Regulatory / Public Law',
  'Restructuring & Insolvency',
  'Shipping & Maritime',
  'Tax',
  'Technology, Media & Telecommunications',
  'White Collar Crime',
] as const;

export const JURISDICTIONS = [
  'Argentina',
  'Bolivia',
  'Brazil',
  'Chile',
  'Colombia',
  'Costa Rica',
  'Cuba',
  'Dominican Republic',
  'Ecuador',
  'El Salvador',
  'Global',
  'Guatemala',
  'Honduras',
  'Mexico',
  'Nicaragua',
  'Panama',
  'Paraguay',
  'Peru',
  'Puerto Rico',
  'Spain',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Venezuela',
] as const;

export const BANDS = [
  'Unranked',
  'Band 1',
  'Band 2',
  'Band 3',
  'Band 4',
  'Band 5',
  'Band 6',
  'Tier 1',
  'Tier 2',
  'Tier 3',
  'Tier 4',
  'Tier 5',
  'Star Individual',
  'Senior Statesperson',
  'Up and Coming',
  'Associates to Watch',
] as const;

export const SUBMISSION_OBJECTIVES = [
  'First-time recognition',
  'Maintain current ranking',
  'Move up one band/tier',
  'Move up multiple bands/tiers',
  'Improve individual lawyer recognition',
  'Correct market perception',
  'Consolidate sector specialization',
  'Demonstrate institutional depth',
  'Support a new office or jurisdiction',
  'Defend against possible ranking decline',
] as const;

/**
 * Normalizes any practice area string (handling British vs American spelling,
 * Spanish synonyms, conjunctions, and formatting) to its canonical directory form.
 */
export function getCanonicalPracticeArea(raw?: string): string {
  if (!raw) return '';
  let s = raw.toLowerCase().trim();
  // Normalize punctuation and conjunctions
  s = s.replace(/[\/&+\-]/g, ' and ');
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  // British vs American substitutions
  s = s.replace(/\blabour\b/g, 'labor');
  s = s.replace(/\bdefence\b/g, 'defense');

  // Specific canonical clusters
  // 1. Labour & Employment
  if (s.includes('labor') || s.includes('employment') || s.includes('laboral') || s.includes('empleo') || s.includes('trabajo')) {
    return 'Labour & Employment';
  }
  // 2. Tax / Taxation / Fiscal / Tributario
  if (s.includes('tax') || s.includes('fiscal') || s.includes('tributar')) {
    return 'Tax';
  }
  // 3. Corporate / M&A
  if (s.includes('corporate') || s.includes('m and a') || s.includes('mergers') || s.includes('acquisitions') || s.includes('societario') || s.includes('corporativo')) {
    return 'Corporate / M&A';
  }
  // 4. Dispute Resolution / Litigation / Arbitration
  if (s.includes('dispute') || s.includes('litig') || s.includes('arbitr') || s.includes('contencioso')) {
    return 'Dispute Resolution';
  }
  // 5. Real Estate
  if (s.includes('real estate') || s.includes('inmobiliario') || s.includes('bienes raices') || s.includes('bienes raíces')) {
    return 'Real Estate';
  }
  // 6. Banking & Finance
  if (s.includes('bank') || s.includes('financ') || s.includes('bancari')) {
    return 'Banking & Finance';
  }
  // 7. Intellectual Property
  if (s.includes('intellectual property') || s.includes('propiedad intelectual') || s.includes('patents') || s.includes('trademarks') || s === 'ip') {
    return 'Intellectual Property';
  }
  // 8. Energy & Natural Resources
  if (s.includes('energy') || s.includes('energia') || s.includes('energía') || s.includes('natural resources') || s.includes('recursos naturales') || s.includes('oil') || s.includes('gas') || s.includes('petrol')) {
    return 'Energy & Natural Resources';
  }
  // 9. Competition / Antitrust
  if (s.includes('competition') || s.includes('antitrust') || s.includes('competencia') || s.includes('antimonopolio')) {
    return 'Competition / Antitrust';
  }
  // 10. Capital Markets
  if (s.includes('capital market') || s.includes('mercado de valores') || s.includes('mercados de capitales')) {
    return 'Capital Markets';
  }
  // 11. Restructuring & Insolvency
  if (s.includes('restructur') || s.includes('insolven') || s.includes('quiebra') || s.includes('concurso mercantil')) {
    return 'Restructuring & Insolvency';
  }
  // 12. White Collar Crime
  if (s.includes('white collar') || s.includes('criminal') || s.includes('penal') || s.includes('delitos')) {
    return 'White Collar Crime';
  }
  // 13. Regulatory / Public Law
  if (s.includes('regulatory') || s.includes('public law') || s.includes('regulatorio') || s.includes('derecho publico') || s.includes('derecho público') || s.includes('administrativo')) {
    return 'Regulatory / Public Law';
  }
  // 14. Projects & Infrastructure
  if (s.includes('project') || s.includes('infraestruc') || s.includes('infrastruct')) {
    return 'Projects & Infrastructure';
  }
  // 15. Compliance
  if (s.includes('compliance') || s.includes('cumplimiento') || s.includes('anticorrup') || s.includes('anti-corrup')) {
    return 'Compliance';
  }
  // 16. Insurance
  if (s.includes('insurance') || s.includes('seguros') || s.includes('fianzas')) {
    return 'Insurance';
  }
  // 17. Environment
  if (s.includes('environment') || s.includes('ambiental') || s.includes('medio ambiente')) {
    return 'Environment';
  }
  // 18. TMT
  if (s.includes('telecom') || s.includes('technology') || s.includes('tecnologia') || s.includes('tmt') || s.includes('media')) {
    return 'Technology, Media & Telecommunications';
  }
  // 19. International Trade
  if (s.includes('trade') || s.includes('comercio exterior') || s.includes('aduanas') || s.includes('customs')) {
    return 'International Trade';
  }
  // 20. Life Sciences
  if (s.includes('life science') || s.includes('pharma') || s.includes('farmaceut') || s.includes('healthcare') || s.includes('salud')) {
    return 'Life Sciences / Healthcare';
  }

  // Fallback: check exact or fuzzy inclusion against PRACTICE_AREAS
  for (const pa of PRACTICE_AREAS) {
    const pClean = pa.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sClean = s.replace(/[^a-z0-9]/g, '');
    if (pClean === sClean || pClean.includes(sClean) || sClean.includes(pClean)) {
      return pa;
    }
  }

  return raw.trim();
}

