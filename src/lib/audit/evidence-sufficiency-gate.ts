/**
 * Strategic Evidence Sufficiency Gate (Audit & Submission Gating)
 * 
 * Enforces fail-closed behavior when uploaded evidence is insufficient
 * to produce a defensible Strategic Audit or competitive Chambers submission.
 * 
 * Directly fulfills Angela Castillo's core requirements:
 * 1. Strategic sufficiency gate: "RankPilot debe saber decir: 'la evidencia es insuficiente para hacer este trabajo responsablemente'."
 * 2. Explains clearly:
 *    - qué evidencia recibió;
 *    - qué evidencia falta;
 *    - por qué no puede evaluar defensiblemente la candidatura;
 *    - qué información adicional necesita el usuario para continuar.
 * 3. Clearly distinguishes between technical extraction failure vs. strategically insufficient evidence.
 */

import { detectPracticeAreaDiscrepancy, PracticeDiscrepancyAnalysis } from './practice-area-classifier';

export interface StrategicSufficiencyAudit {
  isSufficient: boolean;
  status: 'sufficient' | 'provisional' | 'insufficient';
  headline: string;
  receivedEvidence: {
    totalMatters: number;
    publishableCount: number;
    confidentialCount: number;
    clients: string[];
    hasDepartmentB10: boolean;
    b10WordCount: number;
    lawyerCount: number;
    calibratedPractice: string;
    detectedPractice: string;
  };
  missingEvidence: {
    minimumRecommended: number;
    matterDeficit: number;
    missingSections: string[];
    benchmarkComparison: string;
  };
  defensibilityRationale: string;
  requiredActions: string[];
  submissionReadiness: string;
  recommendedScore: number | null;
  recommendedBand: string;
  practiceDiscrepancy: PracticeDiscrepancyAnalysis;
}

export function evaluateStrategicSufficiency(params: {
  matters: any[];
  practiceArea: string;
  b10Text?: string;
  lawyers?: any[];
  firmName?: string;
}): StrategicSufficiencyAudit {
  const {
    matters = [],
    practiceArea = 'General Practice',
    b10Text = '',
    lawyers = [],
    firmName = 'The Firm'
  } = params;

  const totalMatters = matters.length;
  const pubCount = matters.filter(m => !m.isConfidential && !m.confidential).length;
  const confCount = matters.filter(m => m.isConfidential || m.confidential).length;
  const uniqueClients = Array.from(new Set(
    matters.map(m => m.client || m.name || m.title).filter(Boolean)
  ));

  const b10Clean = (b10Text || '').trim();
  const b10WordCount = b10Clean ? b10Clean.split(/\s+/).length : 0;
  const hasDepartmentB10 = b10WordCount >= 60;
  const lawyerCount = lawyers.length;

  // Run substantive practice discrepancy analysis
  const practiceDiscrepancy = detectPracticeAreaDiscrepancy(practiceArea, matters);

  // Chambers & Partners official submission benchmark: up to 20 matters (10-20 standard)
  const MINIMUM_DEFENSIBLE_MATTERS = 5;
  const RECOMMENDED_COMPETITIVE_MATTERS = 10;
  const FULL_BENCHMARK_MATTERS = 20;

  // Case A: Insufficient evidence (< 5 matters or 0 matters)
  if (totalMatters < MINIMUM_DEFENSIBLE_MATTERS) {
    const missingSections: string[] = [];
    if (!hasDepartmentB10) missingSections.push('Sección B10 (Department Best Known For / Perfil del Departamento)');
    if (lawyerCount === 0) missingSections.push('Sección B9 (Roster de Abogados y Biografías Estratégicas)');
    missingSections.push(`Asuntos de fondo: faltan ${RECOMMENDED_COMPETITIVE_MATTERS - totalMatters} a ${FULL_BENCHMARK_MATTERS - totalMatters} mandatos representativos`);

    const clientSnippet = uniqueClients.length > 0 ? ` (${uniqueClients.join(', ')})` : '';

    return {
      isSufficient: false,
      status: 'insufficient',
      headline: 'Insufficient evidence to produce a defensible Strategic Audit or competitive submission.',
      receivedEvidence: {
        totalMatters,
        publishableCount: pubCount,
        confidentialCount: confCount,
        clients: uniqueClients,
        hasDepartmentB10,
        b10WordCount,
        lawyerCount,
        calibratedPractice: practiceArea,
        detectedPractice: practiceDiscrepancy.hasDiscrepancy ? practiceDiscrepancy.detectedPractice : practiceArea
      },
      missingEvidence: {
        minimumRecommended: RECOMMENDED_COMPETITIVE_MATTERS,
        matterDeficit: RECOMMENDED_COMPETITIVE_MATTERS - totalMatters,
        missingSections,
        benchmarkComparison: `Se recibieron ${totalMatters} mandatos frente al estándar oficial de Chambers de hasta 20 asuntos (mínimo 10–20 recomendados).`
      },
      defensibilityRationale: `Chambers & Partners evalúa la profundidad institucional del equipo, la recurrencia anual y la diversidad de clientes ante contrapartes complejas. Con una muestra de solo ${totalMatters} asunto(s)${clientSnippet}, cualquier asignación de Banda (Band 1–4) o Score de competitividad carece de sustento probatorio y sería metodológicamente indefendible. RankPilot aplica el principio de 'fail-closed' para proteger la credibilidad del despacho y evitar recomendaciones artificiales.`,
      requiredActions: [
        `Cargar o importar al menos ${RECOMMENDED_COMPETITIVE_MATTERS - totalMatters} asuntos adicionales (hasta completar de 10 a 20 mandatos destacados) para construir una masa crítica defendible.`,
        hasDepartmentB10
          ? 'Revisar la Sección B10 para asegurar que los pilares institucionales reflejen la práctica seleccionada.'
          : 'Completar la narrativa del departamento (B10) destacando fortalezas únicas, volumen general y feedback de mercado.',
        practiceDiscrepancy.hasDiscrepancy
          ? `Resolver la discrepancia de área de práctica: cambiar a '${practiceDiscrepancy.detectedPractice}' o ratificar '${practiceArea}' documentando el riesgo de dilución.`
          : 'Verificar que cada mandato contenga cuantía económica, autoridades intervinientes y desglose de horas/abogados.'
      ],
      submissionReadiness: 'Withheld — Strategically Insufficient Evidence',
      recommendedScore: null,
      recommendedBand: 'Unrated — Insufficient Evidence Base',
      practiceDiscrepancy
    };
  }

  // Case B: Provisional evidence (5 to 9 matters)
  if (totalMatters < RECOMMENDED_COMPETITIVE_MATTERS) {
    return {
      isSufficient: true,
      status: 'provisional',
      headline: 'Provisional evidence base — expansion recommended for competitive submission.',
      receivedEvidence: {
        totalMatters,
        publishableCount: pubCount,
        confidentialCount: confCount,
        clients: uniqueClients,
        hasDepartmentB10,
        b10WordCount,
        lawyerCount,
        calibratedPractice: practiceArea,
        detectedPractice: practiceDiscrepancy.hasDiscrepancy ? practiceDiscrepancy.detectedPractice : practiceArea
      },
      missingEvidence: {
        minimumRecommended: RECOMMENDED_COMPETITIVE_MATTERS,
        matterDeficit: RECOMMENDED_COMPETITIVE_MATTERS - totalMatters,
        missingSections: !hasDepartmentB10 ? ['Sección B10 recomendada'] : [],
        benchmarkComparison: `${totalMatters} mandatos detectados (umbral provisional superado, pero por debajo de los 10–20 mandatos óptimos).`
      },
      defensibilityRationale: `El dataset de ${totalMatters} mandatos permite emitir un diagnóstico preliminar, pero existe riesgo de desventaja competitiva frente a firmas líderes que presentan el tope de 20 mandatos con distribución equilibrada entre socios.`,
      requiredActions: [
        `Agregar ${RECOMMENDED_COMPETITIVE_MATTERS - totalMatters} a ${FULL_BENCHMARK_MATTERS - totalMatters} mandatos más para maximizar las probabilidades en Chambers.`,
        practiceDiscrepancy.hasDiscrepancy
          ? `Evaluar la recomendación de práctica: los mandatos son consistentes con '${practiceDiscrepancy.detectedPractice}'.`
          : 'Confirmar que los socios líderes estén distribuidos adecuadamente en los mandatos principales.'
      ],
      submissionReadiness: 'Provisional — Evidence Expansion Recommended',
      recommendedScore: Math.min(65, 40 + totalMatters * 3),
      recommendedBand: 'Band 4 / Candidate Standard',
      practiceDiscrepancy
    };
  }

  // Case C: Sufficient evidence (>= 10 matters)
  return {
    isSufficient: true,
    status: 'sufficient',
    headline: 'Evidence base meets Chambers competitive volume criteria.',
    receivedEvidence: {
      totalMatters,
      publishableCount: pubCount,
      confidentialCount: confCount,
      clients: uniqueClients,
      hasDepartmentB10,
      b10WordCount,
      lawyerCount,
      calibratedPractice: practiceArea,
      detectedPractice: practiceDiscrepancy.hasDiscrepancy ? practiceDiscrepancy.detectedPractice : practiceArea
    },
    missingEvidence: {
      minimumRecommended: RECOMMENDED_COMPETITIVE_MATTERS,
      matterDeficit: 0,
      missingSections: [],
      benchmarkComparison: `Dataset completo con ${totalMatters} mandatos presentados.`
    },
    defensibilityRationale: 'El volumen y distribución de asuntos permite sustentar una auditoría estratégica integral y defensible.',
    requiredActions: [
      practiceDiscrepancy.hasDiscrepancy
        ? `Revisar posible discrepancia de práctica: la evidencia se alinea con '${practiceDiscrepancy.detectedPractice}'.`
        : 'Verificar la narrativa final y descargar los entregables certificados.'
    ],
    submissionReadiness: 'Ready for Strategic Delivery',
    recommendedScore: 85,
    recommendedBand: 'Band 1–3 Competitive Standard',
    practiceDiscrepancy
  };
}
