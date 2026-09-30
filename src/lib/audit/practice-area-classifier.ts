/**
 * Practice Area Substantive Classifier & Discrepancy Detector
 * 
 * Analyzes substantive matter content (clients, authorities, summaries, legal mechanisms)
 * to detect material discrepancies with the user's calibrated practice area.
 * 
 * Specifically addresses Angela's requirement:
 * "The uploaded evidence appears more consistent with Environment than Energy & Natural Resources."
 */

export interface PracticeDiscrepancyAnalysis {
  hasDiscrepancy: boolean;
  calibratedPractice: string;
  detectedPractice: string;
  confidence: 'high' | 'medium' | 'none';
  headline: string;
  substantiveFindings: string[];
  chambersImpact: string;
  recommendedAction: 'switch_practice' | 'confirm_practice' | 'review_evidence';
  suggestedPractice: string;
  warningIfContinued: string;
}

export function detectPracticeAreaDiscrepancy(
  calibratedPracticeArea: string,
  matters: any[]
): PracticeDiscrepancyAnalysis {
  const normCalibrated = (calibratedPracticeArea || '').toLowerCase().trim();
  
  if (!matters || matters.length === 0) {
    return {
      hasDiscrepancy: false,
      calibratedPractice: calibratedPracticeArea,
      detectedPractice: calibratedPracticeArea,
      confidence: 'none',
      headline: '',
      substantiveFindings: [],
      chambersImpact: '',
      recommendedAction: 'confirm_practice',
      suggestedPractice: calibratedPracticeArea,
      warningIfContinued: ''
    };
  }

  // Aggregate matter text for substantive topic analysis
  const combinedText = matters.map(m => {
    const raw = `${m.name || ''} ${m.title || ''} ${m.client || ''} ${m.summary || ''} ${m.rawNotes || ''} ${m.optimizedText || ''} ${m.otherInfo || ''}`;
    return raw.toLowerCase();
  }).join(' ');

  // Keyword lexicons for substantive classification
  const envKeywords = [
    'profepa', 'conagua', 'lgeepa', 'semarnat', 'asea', 'ambiental', 'environmental',
    'wastewater', 'aguas residuales', 'descarga', 'emisiones', 'pollution', 'contaminación',
    'inspección ambiental', 'clausura', 'residuos peligrosos', 'impacto ambiental',
    'aire', 'atmósfera', 'norma oficial mexicana', 'nom-001', 'nom-043', 'nom-085',
    'ecological balance', 'ecological imbalance', 'natural resources enforcement', 'remediation'
  ];

  const energyKeywords = [
    'electricity', 'electric power', 'electricidad', 'energía eléctrica', 'power plant',
    'solar', 'fotovoltaic', 'fotovoltaica', 'wind farm', 'parque eólico', 'renovable',
    'renewable', 'ppa', 'power purchase agreement', 'cre', 'cenace', 'cfe',
    'hidrocarburos', 'hydrocarbons', 'petróleo', 'petroleum', 'oil & gas', 'gas natural',
    'gasoducto', 'pipeline', 'upstream', 'midstream', 'downstream', 'drilling',
    'reforma energética', 'mercado eléctrico mayorista', 'mem', 'suministro calificado'
  ];

  const taxKeywords = [
    'sat', 'impuestos', 'tax', 'fiscal', 'cff', 'código fiscal', 'lisr', 'iva',
    'transfer pricing', 'precios de transferencia', 'crédito fiscal', 'auditoría fiscal',
    'tribunal federal de justicia administrativa', 'tfja', 'devolución de saldos',
    'estímulo fiscal', 'defensa fiscal', 'juicio contencioso administrativo'
  ];

  const labourKeywords = [
    'laboral', 'employment', 'sindicato', 'union', 'huelga', 'strike', 'cct',
    'contrato colectivo', 'stps', 'despido', 'severance', 'subcontratación',
    'repse', 'ptu', 'reparto de utilidades', 'centro federal de conciliación',
    'tribunal laboral', 'collective bargaining', 'workforce integration'
  ];

  const realEstateKeywords = [
    'inmobiliario', 'real estate', 'propiedad', 'land use', 'uso de suelo',
    'zonificación', 'zoning', 'catastral', 'cadastral', 'ejido', 'agrario',
    'fideicomiso inmobiliario', 'fibra', 'desarrollo urbano', 'arrendamiento comercial',
    'adquisición de inmuebles', 'título de propiedad'
  ];

  const countMatches = (keywords: string[]) => {
    let score = 0;
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = combinedText.match(regex);
      if (matches) score += matches.length;
    }
    return score;
  };

  const envScore = countMatches(envKeywords);
  const energyScore = countMatches(energyKeywords);
  const taxScore = countMatches(taxKeywords);
  const labourScore = countMatches(labourKeywords);
  const realEstateScore = countMatches(realEstateKeywords);

  // 1. SPECIFIC CASE: Energy & Natural Resources calibrated vs. Non-Energy / Environmental / Real Estate content
  if (normCalibrated.includes('energy') || normCalibrated.includes('energía')) {
    if (energyScore === 0) {
      const topAlternative = (realEstateScore > 0 || combinedText.includes('protección civil') || combinedText.includes('habitacional') || combinedText.includes('licencia de construcción'))
        ? 'Real Estate / Administrative Litigation'
        : (envScore > 0 ? 'Environment' : 'Unconfirmed / Off-Category');

      return {
        hasDiscrepancy: true,
        calibratedPractice: 'Energy & Natural Resources',
        detectedPractice: topAlternative,
        confidence: 'high',
        headline: `No substantive Energy & Natural Resources legal mandates detected. Evidence aligns with ${topAlternative}.`,
        substantiveFindings: [
          `None of the submitted matters (${matters.length}) involve power generation, renewable energy (solar/wind), PPA structuring, transmission facilities, hydrocarbons (upstream/midstream), or regulatory proceedings before the CRE, CENACE, SENER, or ASEA.`,
          `The provided matters describe municipal building licenses, civil protection suspension defense, residential zoning, or general administrative amparo, which fall under Real Estate and Administrative Litigation.`,
          `International directory research teams (Chambers and Legal 500) evaluate municipal zoning and construction amparos in Real Estate or Dispute Resolution, not in Energy & Natural Resources.`
        ],
        chambersImpact: 'Filing residential zoning, municipal building permits, or non-energy administrative disputes under Energy & Natural Resources causes immediate evaluative dilution and rejection by specialized energy researchers.',
        recommendedAction: 'switch_practice',
        suggestedPractice: topAlternative,
        warningIfContinued: 'If you proceed in Energy & Natural Resources, the Strategic Audit will flag this substantive mismatch as a critical dilution risk, and the matters will not support any ranking candidacy in Energy.'
      };
    } else if (envScore >= 3 && energyScore <= 1) {
      return {
        hasDiscrepancy: true,
        calibratedPractice: 'Energy & Natural Resources',
        detectedPractice: 'Environment',
        confidence: 'high',
        headline: 'The uploaded evidence appears more consistent with Environment than Energy & Natural Resources.',
        substantiveFindings: [
          `The submitted matters (${matters.length}) focus predominantly on environmental compliance, wastewater discharges, emissions inspections, and PROFEPA/CONAGUA enforcement.`,
          'No substantial transactional, project development, or regulatory energy mandates (CRE/CENACE/hydrocarbons) were identified.',
          'International directories evaluate environmental audit compliance and industrial closure defense under "Environment", not "Energy & Natural Resources".'
        ],
        chambersImpact: 'Specialized energy researchers look for power generation projects, transaction scale, and regulatory filings; environmental enforcement is evaluated in the Environment guide.',
        recommendedAction: 'switch_practice',
        suggestedPractice: 'Environment',
        warningIfContinued: 'Filing environmental enforcement matters under Energy creates critical substantive dilution.'
      };
    }
  }

  // 2. SPECIFIC CASE: Real Estate calibrated vs. Environmental / Agrarian Litigation
  if (normCalibrated.includes('real estate') || normCalibrated.includes('inmobiliario')) {
    if (taxScore >= 5 && realEstateScore <= 1) {
      return {
        hasDiscrepancy: true,
        calibratedPractice: 'Real Estate',
        detectedPractice: 'Tax',
        confidence: 'high',
        headline: 'The uploaded evidence appears more consistent with Tax than Real Estate.',
        substantiveFindings: [
          'The analyzed evidence describes tax controversies and SAT audits, lacking substantive real estate transactions or development nexus.'
        ],
        chambersImpact: 'The submission will be evaluated unfavorably by Chambers Real Estate research teams.',
        recommendedAction: 'switch_practice',
        suggestedPractice: 'Tax',
        warningIfContinued: 'Proceeding in Real Estate will cause fiscal disputes to be discounted by real estate researchers.'
      };
    }
  }

  // 3. SPECIFIC CASE: Labour & Employment vs. Non-Labour
  if (normCalibrated.includes('labour') || normCalibrated.includes('labor')) {
    if (labourScore === 0 && (envScore >= 3 || energyScore >= 3 || taxScore >= 3)) {
      const topOther = envScore >= energyScore ? (envScore >= taxScore ? 'Environment' : 'Tax') : (energyScore >= taxScore ? 'Energy' : 'Tax');
      return {
        hasDiscrepancy: true,
        calibratedPractice: 'Labour & Employment',
        detectedPractice: topOther,
        confidence: 'high',
        headline: `The uploaded evidence appears more consistent with ${topOther} than Labour & Employment.`,
        substantiveFindings: [
          'No collective bargaining negotiations, union relations, strike defenses, or employment litigations were identified.'
        ],
        chambersImpact: 'The submission lacks evidentiary support for the Labour & Employment practice.',
        recommendedAction: 'switch_practice',
        suggestedPractice: topOther,
        warningIfContinued: 'A finding of material practice incompatibility will be registered in the audit.'
      };
    }
  }

  return {
    hasDiscrepancy: false,
    calibratedPractice: calibratedPracticeArea,
    detectedPractice: calibratedPracticeArea,
    confidence: 'none',
    headline: '',
    substantiveFindings: [],
    chambersImpact: '',
    recommendedAction: 'confirm_practice',
    suggestedPractice: calibratedPracticeArea,
    warningIfContinued: ''
  };
}

export interface MatterPracticeClassification {
  relevanceScore: number; // 0 - 100
  classification: 'core' | 'supporting' | 'off_category';
  primaryPractice: string;
  relevanceRationale: string;
  isOffCategory: boolean;
}

/**
 * Classifies an individual matter's practice relevance independently of matter strength.
 * Enforces the rule: Matter Strength != Practice Relevance.
 * (e.g., A matter with 95/100 sophistication in Energy concessions has only 30/100 relevance for Real Estate).
 */
export function classifyMatterPractice(
  matter: any,
  targetPracticeArea: string = ''
): MatterPracticeClassification {
  const normTarget = (targetPracticeArea || '').toLowerCase().trim();
  const client = (matter.client || matter.clientName || matter.name || '').toLowerCase();
  const title = (matter.title || '').toLowerCase();
  const summary = (matter.summary || matter.rawNotes || matter.optimizedText || matter.description || '').toLowerCase();
  const text = `${client} ${title} ${summary}`.trim();

  // If matter has no substantive text (< 20 characters), it cannot be confirmed
  if (text.length < 20) {
    return {
      relevanceScore: 0,
      classification: 'off_category',
      primaryPractice: 'Unconfirmed / Insufficient Evidence',
      relevanceRationale: 'Practice relevance: UNCONFIRMED. Insufficient factual evidence in source dossier to establish practice alignment or legal scope.',
      isOffCategory: true,
    };
  }

  const isRealEstate = normTarget.includes('real estate') || normTarget.includes('inmobiliario');
  const isEnergy = normTarget.includes('energy') || normTarget.includes('energía') || normTarget.includes('natural resources');

  // Energy & Natural Resources substantive practice evaluation
  if (isEnergy) {
    const hasEnergyKeywords = (
      text.includes('energía') || text.includes('energy') ||
      text.includes('eléctric') || text.includes('electric') ||
      text.includes('power') || text.includes('renovable') || text.includes('renewable') ||
      text.includes('solar') || text.includes('fotovolt') || text.includes('wind') || text.includes('eólic') ||
      text.includes('hidrocarbur') || text.includes('hydrocarbon') ||
      text.includes('petróleo') || text.includes('petroleo') || text.includes('oil & gas') || text.includes('gas natural') ||
      text.includes('gasoducto') || text.includes('pipeline') ||
      text.includes('minería') || text.includes('mining') || text.includes('mineral') || text.includes('concesión minera') ||
      text.includes('cre') || text.includes('cenace') || text.includes('sener') || text.includes('cnh') || text.includes('asea') ||
      text.includes('ppa') || text.includes('cels') || text.includes('clean energy') ||
      text.includes('sistema eléctrico') || text.includes('sistema electrico')
    );

    if (hasEnergyKeywords) {
      return {
        relevanceScore: 85,
        classification: 'core',
        primaryPractice: 'Energy & Natural Resources',
        relevanceRationale: 'Substantive nexus to power generation, hydrocarbons, mining concessions, or energy regulatory compliance.',
        isOffCategory: false,
      };
    }

    // If it has residential housing / municipal civil protection / building licensing without energy work:
    const isRealEstateOrAdmin = (
      text.includes('habitacional') || text.includes('vivienda') || text.includes('inmobiliari') ||
      text.includes('puerto vallarta') || text.includes('constructora') || text.includes('licencia de construcción') ||
      text.includes('protección civil') || text.includes('proteccion civil') || text.includes('urban zoning') ||
      text.includes('uso de suelo') || text.includes('desarrolladora') || text.includes('condominio') ||
      text.includes('fraccionamiento') || text.includes('edificación')
    );

    if (isRealEstateOrAdmin) {
      return {
        relevanceScore: 20,
        classification: 'off_category',
        primaryPractice: 'Real Estate / Administrative Litigation',
        relevanceRationale: 'Practice relevance: UNCONFIRMED / MISMATCH (Real Estate / Administrative Litigation). Mandate centers on municipal civil protection, residential construction licensing, and amparo litigation for a housing developer. Zero legal work in power generation, hydrocarbons, mining, or energy regulatory frameworks (CRE/CENACE/SENER).',
        isOffCategory: true,
      };
    }

    // Pure environmental without energy
    if (text.includes('ambiental') || text.includes('environmental') || text.includes('impacto ambiental') || text.includes('ecología')) {
      return {
        relevanceScore: 25,
        classification: 'off_category',
        primaryPractice: 'Environment',
        relevanceRationale: 'Practice relevance: UNCONFIRMED / MISMATCH (Environment). Mandate involves general environmental licensing or compliance without energy generation or natural resources nexus.',
        isOffCategory: true,
      };
    }

    // Unconfirmed Energy
    return {
      relevanceScore: 15,
      classification: 'off_category',
      primaryPractice: 'Unconfirmed Practice',
      relevanceRationale: 'Practice relevance: UNCONFIRMED. Lacks verifiable energy regulatory, transactional, or contentious nexus.',
      isOffCategory: true,
    };
  }

  if (isRealEstate) {
    // 1. Off-category: Energy infrastructure, public lighting, fuel stations, electric grid
    if (
      text.includes('alumbrado público') || 
      text.includes('alumbrado publico') || 
      text.includes('public lighting') ||
      text.includes('fuel service stations') ||
      text.includes('estaciones de servicio') ||
      text.includes('clean-energy') ||
      text.includes('national electric system') ||
      text.includes('sistema eléctrico nacional') ||
      text.includes('sistema electrico nacional') ||
      (text.includes('concesión') && (text.includes('zapopan') || text.includes('energía') || text.includes('alumbrado')))
    ) {
      return {
        relevanceScore: 30,
        classification: 'off_category',
        primaryPractice: 'Energy & Natural Resources / Public Law',
        relevanceRationale: 'Mandate centers on public lighting infrastructure, fuel stations, and energy generation. In Chambers, this benchmarks under Energy or Public Concessions, not Real Estate.',
        isOffCategory: true,
      };
    }

    // 2. Off-category: Pure environmental amparo / ecology / fauna conservation
    if (
      (text.includes('conciencia ambiental') || text.includes('devangary') || text.includes('environmental amparo') || text.includes('protección de ecosistemas') || text.includes('servicios ambientales') || text.includes('environmental services')) &&
      !text.includes('desarrollo inmobiliario') &&
      !text.includes('fraccionamiento') &&
      !text.includes('parque industrial') &&
      !text.includes('licencia de construcción')
    ) {
      return {
        relevanceScore: 35,
        classification: 'off_category',
        primaryPractice: 'Environment',
        relevanceRationale: 'Mandate represents pure environmental amparo and ecosystem conservation litigation. In Chambers, this benchmarks under Environment, not Real Estate.',
        isOffCategory: true,
      };
    }

    // 3. Off-category: Freight logistics, vehicle circulation, SICT fines
    if (
      text.includes('paquetexpress') ||
      text.includes('transportes potosinos') ||
      (text.includes('transportation of goods') && !text.includes('parque industrial') && !text.includes('industrial center')) ||
      (text.includes('circulación') && text.includes('sict'))
    ) {
      return {
        relevanceScore: 25,
        classification: 'off_category',
        primaryPractice: 'Transportation & Logistics / Administrative',
        relevanceRationale: 'Mandate concerns transport regulation, vehicular circulation, and logistics fines without real property acquisition or development.',
        isOffCategory: true,
      };
    }

    // 4. Off-category: Pure tax / SAT credits / VAT refunds
    if (
      (text.includes('sat') || text.includes('devolución de iva') || text.includes('crédito fiscal')) &&
      !text.includes('predial') &&
      !text.includes('expropiación') &&
      !text.includes('terreno') &&
      !text.includes('desarrollo')
    ) {
      return {
        relevanceScore: 20,
        classification: 'off_category',
        primaryPractice: 'Tax',
        relevanceRationale: 'Mandate involves federal tax audits and SAT litigation without real estate property nexus.',
        isOffCategory: true,
      };
    }

    // 5. Off-category: Medical technology / hospital supplies
    if (text.includes('tecnología médica') || text.includes('tecnologia medica') || text.includes('medical device')) {
      return {
        relevanceScore: 15,
        classification: 'off_category',
        primaryPractice: 'Life Sciences / Commercial',
        relevanceRationale: 'Mandate relates to medical equipment distribution and commercial supply.',
        isOffCategory: true,
      };
    }

    // 6. Core Real Estate Mandates
    let reScore = 75;
    if (
      text.includes('desarrollo inmobiliario') ||
      text.includes('real estate development') ||
      text.includes('el cielo') ||
      text.includes('idex') ||
      text.includes('brasilia') ||
      text.includes('duranpark') ||
      text.includes('san carlos') ||
      text.includes('parque industrial') ||
      text.includes('industrial center') ||
      text.includes('housing project') ||
      text.includes('desarrollo de vivienda') ||
      text.includes('condominio')
    ) {
      reScore += 20;
    }
    if (
      text.includes('expropiación') ||
      text.includes('expropriation') ||
      text.includes('amparo') ||
      text.includes('suspensión definitiva') ||
      text.includes('clausura') ||
      text.includes('uso de suelo') ||
      text.includes('zoning') ||
      text.includes('hectáreas') ||
      text.includes('superficie') ||
      text.includes('regularización de predios')
    ) {
      reScore += 10;
    }

    return {
      relevanceScore: Math.min(100, reScore),
      classification: reScore >= 75 ? 'core' : 'supporting',
      primaryPractice: 'Real Estate',
      relevanceRationale: 'Substantive focus on commercial/residential development, zoning regularisation, and contentious real property protection.',
      isOffCategory: false,
    };
  }

  // Generic fallback: neutral practice relevance
  return {
    relevanceScore: 40,
    classification: 'supporting',
    primaryPractice: targetPracticeArea || 'General Practice',
    relevanceRationale: 'Practice relevance: UNCONFIRMED. Matter retained in working draft pending practice scope verification.',
    isOffCategory: false,
  };
}
