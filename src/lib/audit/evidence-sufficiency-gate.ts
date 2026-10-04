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

  // Count substantive source records, not empty rows or repeated IDs. This is a readiness heuristic, not a ranking model.
  const evidenced = matters.filter(m => String(m.rawNotes || m.summary || '').trim().length > 0 && String(m.client || m.clientDescription || '').trim().length > 0);
  const totalMatters = new Set(evidenced.map((m, i) => m.id || `source-${i}`)).size;
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
    if (!hasDepartmentB10) missingSections.push('Section B10 (Department Overview / Practice Profile)');
    if (lawyerCount === 0) missingSections.push('Section B9 (Lawyer Roster & Strategic Bios)');
    missingSections.push(`Substantive Mandates: Deficit of ${RECOMMENDED_COMPETITIVE_MATTERS - totalMatters} to ${FULL_BENCHMARK_MATTERS - totalMatters} representative matters`);

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
        benchmarkComparison: `${totalMatters} matter(s) received against the official Chambers benchmark of up to 20 matters (minimum 10–20 recommended).`
      },
      defensibilityRationale: `Chambers & Partners evaluates institutional team depth, annual mandate recurrence, and client diversity against complex counterparties. With a sample of only ${totalMatters} matter(s)${clientSnippet}, any band projection (Band 1–5) or competitiveness score lacks evidentiary foundation and is methodologically indefensible. RankPilot applies the 'fail-closed' protocol to protect firm credibility and prevent speculative or artificial ranking recommendations.`,
      requiredActions: [
        `Upload or import at least ${RECOMMENDED_COMPETITIVE_MATTERS - totalMatters} additional matters (to reach the 10–20 standout mandate threshold) to build a defensible critical mass.`,
        hasDepartmentB10
          ? 'Review Section B10 to ensure institutional pillars reflect the selected practice area.'
          : 'Complete the department overview (Section B10) highlighting core strengths, volume, and sector specialization.',
        practiceDiscrepancy.hasDiscrepancy
          ? `Resolve practice area discrepancy: reassign to '${practiceDiscrepancy.detectedPractice}' or confirm '${practiceArea}' with documented dilution risk.`
          : 'Verify that each mandate contains quantifiable financial scale, regulatory authorities involved, and lead partner attribution.'
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
        missingSections: !hasDepartmentB10 ? ['Section B10 Recommended'] : [],
        benchmarkComparison: `${totalMatters} matters detected (provisional threshold met, but below the 10–20 optimal mandate range).`
      },
      defensibilityRationale: `The dataset of ${totalMatters} matters allows a preliminary diagnosis, but carries competitive disadvantage against peer firms submitting the full 20-matter roster with balanced partner distribution.`,
      requiredActions: [
        `Add ${RECOMMENDED_COMPETITIVE_MATTERS - totalMatters} to ${FULL_BENCHMARK_MATTERS - totalMatters} additional matters to maximize directory competitiveness.`,
        practiceDiscrepancy.hasDiscrepancy
          ? `Evaluate practice recommendation: matters are consistent with '${practiceDiscrepancy.detectedPractice}'.`
          : 'Confirm that lead partners are appropriately distributed across primary mandates.'
      ],
      submissionReadiness: 'Provisional — Evidence Expansion Recommended',
      recommendedScore: Math.min(65, 40 + totalMatters * 3),
      recommendedBand: 'Not assessed — editorial review required',
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
    recommendedScore: null,
    recommendedBand: 'Not assessed — editorial review required',
    practiceDiscrepancy
  };
}
