/**
 * Judge SOL Extraction Auditor & Surgical Healer (v26.46)
 * =======================================================
 * Performs an automated editorial review of raw extracted matters immediately
 * following document parsing.
 * 
 * Capabilities:
 * 1. Surgical Client Name Separation:
 *    Detects when firms place long descriptive company marketing profiles inside
 *    the "Client Name" field (e.g. "EL CIELO COUNTRY CLUB. A first class development located in the Bugambilias hill...").
 *    Surgically isolates the clean entity name ("EL CIELO COUNTRY CLUB") while safely
 *    migrating the descriptive profile to matter background/summary so zero evidence is lost.
 * 
 * 2. Fail-Safe Confidentiality Guardrail (Angela Directive):
 *    Rule: "blank confidentiality !== publishable". If confidentiality is unstated,
 *    empty, or ambiguous, it is defaulted to confidential until human confirmation.
 * 
 * 3. Matter Practice Relevance & Dilution Detection:
 *    Calculates per-matter practice relevance (Matter Strength != Practice Relevance).
 *    Flags off-category instructions (e.g. energy generation concessions, pure environmental
 *    litigation, or freight transport fines in a Real Estate submission).
 * 
 * 4. Extraction Confidence & Surgical Review Log:
 *    Provides clear diagnostic notes and surgical modification logs for the user.
 */

import { classifyMatterPractice, MatterPracticeClassification } from './practice-area-classifier';

export interface CleanedClientResult {
  cleanClient: string;
  cleanName: string;
  clientDescription: string;
  wasModified: boolean;
}

/**
 * Surgically separates clean entity name from descriptive marketing text.
 */
export function sanitizeClientName(rawClient: string): CleanedClientResult {
  if (!rawClient) return { cleanClient: '', cleanName: '', clientDescription: '', wasModified: false };

  let s = String(rawClient).trim();

  // Strip leading headers like "Publishable Matter 1 -" or "Confidential Matter 2:"
  s = s.replace(/^(?:publishable|confidential)\s+matter\s+\d+\s*[-—:]\s*/gi, '').trim();

  // Pattern A: Period, dash, or comma followed by typical corporate descriptors
  const descPattern = /(?:\.|\s+[-–—]\s+|,\s*)(?:\s*(?:is an?|it is an?|it is dedicated to|is dedicated to|a first class|company dedicated to|company specializing in|specializing in|with more than \d+|leader in the|individual private owner|wealthy family|empresa dedicada|sociedad dedicada|dedicada a|con más de \d+|propietario individual|reconocida regionalmente)\b|\s*\((?:wealthy family|private owner|empresa|familia|promoter)[^\)]*\))/i;

  const match = s.match(descPattern);
  if (match && match.index !== undefined && match.index > 2) {
    const nameEnd = match.index + (s[match.index] === '.' && /(?:\b[A-Z]\.[A-Z]|\bInc|\bLtd|\bCorp)$/i.test(s.substring(0, match.index)) ? 1 : 0);
    const cleanClient = s.substring(0, nameEnd).replace(/[,\s]+$/, '').trim();
    const clientDescription = s.substring(match.index).replace(/^[,.\s\-–—]+/, '').trim();
    return { cleanClient, cleanName: cleanClient, clientDescription, wasModified: true };
  }

  // A period alone is not evidence of a description: legal suffixes and
  // personal initials contain periods too. Preserve ambiguous names verbatim.

  return { cleanClient: s, cleanName: s, clientDescription: '', wasModified: false };
}

/** Recover only the exact suffix displaced by the former period splitter.
 * This projection does not overwrite a saved record or infer an entity name.
 */
export function recoverClientLegalName(matter: any): string {
  const client = String(matter.client || matter.clientName || '');
  const suffix = String(matter.clientDescription || '').trim();
  if (!/\b[A-Z]$/i.test(client) || !/^(?:(?:de|del)\s+|[A-Z]\.?\s*)+$/i.test(suffix)) return client;
  const reconstructed = `${client}. ${suffix}`;
  const declarations = String(matter.source_excerpt || '').split(/\r?\n/)
    .map(line => line.match(/^\s*(?:Client|Cliente)\s*:\s*(.+?)\s*$/i)?.[1])
    .filter(Boolean);
  return declarations.length === 1 && declarations[0] === reconstructed ? reconstructed : client;
}

export interface JudgeSolExtractionAuditResult {
  healedMatters: any[];
  reviewAudit: {
    extractionConfidence: number; // 0 - 100
    surgicalModificationsCount: number;
    surgicalModifications: string[];
    practiceAlertsCount: number;
    practiceAlerts: string[];
    confidentialityAdjustmentsCount: number;
    confidentialityAdjustments: string[];
    summary: string;
    offCategoryMatterIds: string[];
  };
}

/**
 * Runs the Judge SOL Extraction Audit over all extracted matters.
 */
export function judgeSolExtractionAudit(params: {
  matters: any[];
  practiceArea: string;
  firmName?: string;
  sourceDocText?: string;
}): JudgeSolExtractionAuditResult {
  const { matters = [], practiceArea = '', firmName = '' } = params;

  const surgicalModifications: string[] = [];
  const practiceAlerts: string[] = [];
  const confidentialityAdjustments: string[] = [];
  const offCategoryMatterIds: string[] = [];

  let validMattersCount = 0;
  let wellFormedNamesCount = 0;

  const healedMatters = matters.map((m: any, idx: number) => {
    const matterCopy = { ...m };
    const num = idx + 1;
    const rawClient = matterCopy.client || matterCopy.clientName || matterCopy.name || '';

    // 1. Surgical Client Name Separation
    const { cleanClient, clientDescription, wasModified } = sanitizeClientName(rawClient);
    if (wasModified) {
      surgicalModifications.push(
        `[Asunto #${num}] Depurado quirúrgicamente el nombre de cliente: "${cleanClient}" (la descripción adjunta se preservó en antecedentes).`
      );
      matterCopy.client = cleanClient;
      if (clientDescription) {
        matterCopy.clientDescription = clientDescription;
        // Prepend to summary if not already present
        const currentSumm = String(matterCopy.summary || matterCopy.rawNotes || '');
        if (!currentSumm.includes(clientDescription)) {
          matterCopy.summary = `${clientDescription}\n\n${currentSumm}`.trim();
        }
      }
    } else {
      wellFormedNamesCount++;
    }

    // 2. Fail-Safe Confidentiality Guardrail (Blank != Publishable)
    const pubStatus = (matterCopy.publishStatus || matterCopy.publish_status || matterCopy.confidentiality || '').toLowerCase().trim();
    const isExplicitlyPub = pubStatus === 'publishable' || pubStatus === 'public' || pubStatus === 'no' || matterCopy.isConfidential === false;
    const isExplicitlyConf = pubStatus === 'confidential' || pubStatus === 'non_publishable' || pubStatus === 'yes' || matterCopy.isConfidential === true;

    const unconfirmed = matterCopy.confidentialityConfirmed === false || matterCopy.publish_status === 'confirmation_required' || matterCopy.confidentialityStatus === 'confirmation_required';
    if (unconfirmed || (!isExplicitlyPub && !isExplicitlyConf)) {
      matterCopy.confidentialityConfirmed = false;
      matterCopy.confidentialityStatus = 'confirmation_required';
      matterCopy.publish_status = 'confirmation_required';
      // Default to confidential until human verification
      matterCopy.isConfidential = true;
      matterCopy.confidentiality = 'confidential';
      matterCopy.publishStatus = 'confirmation_required';
      confidentialityAdjustments.push(
        `[Asunto #${num}] Estado de confidencialidad en blanco o ambiguo en fuente. Activado guardrail estricto: asignado como CONFIDENCIAL por defecto.`
      );
    } else if (isExplicitlyConf) {
      matterCopy.isConfidential = true;
    } else {
      matterCopy.isConfidential = false;
    }

    // 3. Matter Practice Relevance Scoring
    const classification: MatterPracticeClassification = classifyMatterPractice(matterCopy, practiceArea);
    matterCopy.practiceRelevanceScore = classification.relevanceScore;
    matterCopy.practiceClassification = classification.classification;
    matterCopy.primaryDetectedPractice = classification.primaryPractice;
    matterCopy.practiceRelevanceRationale = classification.relevanceRationale;

    if (classification.isOffCategory) {
      const mId = String(matterCopy.id || `matter-${idx}`);
      offCategoryMatterIds.push(mId);
      practiceAlerts.push(
        `[Asunto #${num} - ${matterCopy.client || 'Sin cliente'}] Alerta de relevancia práctica: Clasificado como ${classification.primaryPractice} (Relevancia ${classification.relevanceScore}%). ${classification.relevanceRationale}`
      );
    }

    validMattersCount++;
    return matterCopy;
  });

  // Calculate extraction confidence
  const total = healedMatters.length;
  let extractionConfidence = 95;
  if (total > 0) {
    const penaltyPerOffCategory = (offCategoryMatterIds.length / total) * 15;
    const penaltyPerMod = (surgicalModifications.length / total) * 5;
    extractionConfidence = Math.max(70, Math.round(98 - penaltyPerOffCategory - penaltyPerMod));
  }

  const summary = `Judge SOL analizó ${total} asuntos extraídos: ${surgicalModifications.length} nombres de cliente depurados quirúrgicamente, ${confidentialityAdjustments.length} asuntos protegidos bajo el guardrail de confidencialidad estricta, y ${practiceAlerts.length} asuntos señalados con baja relevancia temática frente a ${practiceArea || 'la práctica objetivo'}.`;

  return {
    healedMatters,
    reviewAudit: {
      extractionConfidence,
      surgicalModificationsCount: surgicalModifications.length,
      surgicalModifications,
      practiceAlertsCount: practiceAlerts.length,
      practiceAlerts,
      confidentialityAdjustmentsCount: confidentialityAdjustments.length,
      confidentialityAdjustments,
      summary,
      offCategoryMatterIds,
    }
  };
}
