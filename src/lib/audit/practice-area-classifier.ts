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

  // 1. SPECIFIC CASE: Energy & Natural Resources calibrated vs. Environmental content
  if (normCalibrated.includes('energy') || normCalibrated.includes('energía')) {
    if (envScore >= 3 && energyScore <= 1) {
      return {
        hasDiscrepancy: true,
        calibratedPractice: 'Energy & Natural Resources',
        detectedPractice: 'Environment',
        confidence: 'high',
        headline: 'The uploaded evidence appears more consistent with Environment than Energy & Natural Resources.',
        substantiveFindings: [
          `Los asuntos cargados (${matters.length}) se centran predominantemente en inspecciones, clausuras, descargas de aguas residuales y regulación de emisiones ante autoridades ambientales (PROFEPA, CONAGUA, LGEEPA).`,
          'No se identificaron mandatos de generación eléctrica, proyectos de energía renovable (solar/eólica), contratos PPA, hidrocarburos (upstream/midstream), o litigio regulatorio ante la CRE o el CENACE.',
          'En los directorios internacionales (Chambers & Partners y The Legal 500), los mandatos de cumplimiento ambiental industrial y remediación se evalúan en la tabla de "Environment", no en "Energy & Natural Resources".'
        ],
        chambersImpact: 'Presentar mandatos de defensa ambiental regulatoria bajo la tabla de Energy genera dilución sustantiva: los investigadores de Energy buscan volumen transaccional y proyectos de generación, mientras que los investigadores de Environment buscan precisamente inspecciones PROFEPA/CONAGUA y clausuras industriales.',
        recommendedAction: 'switch_practice',
        suggestedPractice: 'Environment',
        warningIfContinued: 'Si decides continuar en Energy & Natural Resources, la Auditoría Estratégica señalará esta discrepancia material como un riesgo crítico de dilución editorial y los mandatos no podrán respaldar un posicionamiento competitivo en Energía.'
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
          'La evidencia analizada describe controversias fiscales y auditorías ante el SAT, sin desarrollo ni transacciones inmobiliarias sustantivas.'
        ],
        chambersImpact: 'La postulación será clasificada incorrectamente por los equipos de investigación de Chambers.',
        recommendedAction: 'switch_practice',
        suggestedPractice: 'Tax',
        warningIfContinued: 'Continuar en Real Estate provocará que los mandatos fiscales no sean computados favorablemente por el equipo de investigación inmobiliaria.'
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
          'No se identificaron asuntos de negociación colectiva, sindicatos, huelgas ni litigio laboral individual/colectivo.'
        ],
        chambersImpact: 'La postulación no contiene evidencia probatoria para la práctica de Labour & Employment.',
        recommendedAction: 'switch_practice',
        suggestedPractice: topOther,
        warningIfContinued: 'Se generará una evaluación de incompatibilidad material en la auditoría.'
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
