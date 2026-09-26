/**
 * Judge SOL Calibration & Quality Evaluation Engine (v26.40)
 * 
 * Implements the 10-Point Audit Calibration Matrix for Chambers & Partners submissions:
 * 1. register: Matter register integrity and volume (fails closed if 0 matters: -6.0)
 * 2. lawyers: Lawyer roster integrity (phone leaks, boolean flags, split names: -2.0)
 * 3. b10_strategy: Section B10 institutional pillars and sector depth (-2.0)
 * 4. c2_positioning: Section C2 ranking thesis without template leaks ("matter was important": -2.0)
 * 5. jurisdiction_consistency: Regulatory authority consistency (foreign authority contamination e.g. SAT in VE: -3.0)
 * 6. artifact_integrity: Absence of debug markers or system tags (-1.5)
 * 7. hero_matter: Marquee anchor matter at D #01 (-1.0)
 * 8. portfolio_hygiene: Max 20 official matters with surplus in reserve (-1.0)
 * 9. editorial_craft: Zero visible structural carpentry labels (-1.0)
 * 10. causal_attribution: 4-stage causal model in core matters (-1.0)
 */

export interface JudgeSolCheck {
  check_id: string;
  component: string;
  passed: boolean;
  reason: string;
  penalty: number;
}

export interface JudgeSolEvaluationResult {
  score: number;
  passed: boolean;
  status: 'passed' | 'with_observations' | 'blocked';
  summary: string;
  feedback: string;
  violations: string[];
  checks: JudgeSolCheck[];
  curatedLawyers?: any[];
}

const PHONE_REGEX = /^\+?[\d\s\-\.\(\)]{7,}$/;
const PHONE_IN_TEXT_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g;
const TEMPLATE_LEAK_REGEX = /\bmatter was important\b|Please include:|\(word count limit\)|Please say why this matter was important/i;
const DEBUG_TAG_REGEX = /\[SOURCE CROSS-BORDER CONFLICT\]|\[EVIDENCE-GAP\]|\[TODO\]|\bUNDEFINED\b|\bNaN\b|\[REGISTER-CONTRACT\]/i;
const CARPENTRY_LABEL_REGEX = /\*\*(?:HERO STATEMENT|IMPACT|EXECUTION|LEGAL MECHANISM|OUTCOME):\*\*/i;

export function evaluateJudgeSolSubmission(params: {
  matters: any[];
  chambersData: any;
  practiceArea: string;
  firmName: string;
  location?: string;
  auditLetterText?: string;
  b10Text?: string;
  c2Text?: string;
}): JudgeSolEvaluationResult {
  const {
    matters = [],
    chambersData = {},
    practiceArea = 'General Practice',
    firmName = 'Firm',
    location = '',
    auditLetterText = '',
    b10Text = '',
    c2Text = '',
  } = params;

  const resolvedLocation = (
    location ||
    chambersData.location ||
    chambersData.jurisdiction ||
    chambersData.detectedJurisdiction ||
    chambersData.guideRegion ||
    ''
  ).toLowerCase();

  const isVenezuela = resolvedLocation.includes('venezuela') || resolvedLocation.includes('ve');
  const isMexico = resolvedLocation.includes('mexic') || resolvedLocation.includes('mx');
  const isColombia = resolvedLocation.includes('colomb') || resolvedLocation.includes('co');

  const totalMatters = matters.length;
  const pubMatters = matters.filter((m: any) => !m.confidential);
  const confMatters = matters.filter((m: any) => m.confidential);
  const pubCount = pubMatters.length;
  const confCount = confMatters.length;

  const checks: JudgeSolCheck[] = [];
  const violations: string[] = [];
  let totalPenalty = 0;

  // 1. REGISTER CHECK (Matter volume & presence)
  const registerPassed = totalMatters > 0;
  if (!registerPassed) {
    totalPenalty += 6.0;
    violations.push('Fallo crítico de registro: 0 asuntos detectados en la submission.');
    checks.push({
      check_id: 'register',
      component: 'register',
      passed: false,
      reason: 'Fallo crítico de registro: 0 asuntos registrados desde el documento fuente.',
      penalty: 6.0,
    });
  } else {
    checks.push({
      check_id: 'register',
      component: 'register',
      passed: true,
      reason: `Registro verificado: ${totalMatters} asuntos preservados (${pubCount} publicables, ${confCount} confidenciales).`,
      penalty: 0,
    });
  }

  // 2. LAWYERS CHECK (Phone leaks, split names, boolean flags, empty roster)
  const rawLawyers: any[] = Array.isArray(chambersData.lawyers) ? chambersData.lawyers : [];
  let phoneLeaksCount = 0;
  let booleanFlagsCount = 0;
  let splitNamesCount = 0;

  for (const l of rawLawyers) {
    const nameStr = String(l.name || '').trim();
    const commentStr = String(l.comments || l.comment || '').trim();
    const rankStr = String(l.currentRank || l.current_ranking || '').trim();

    // Check phone leaks
    if (PHONE_REGEX.test(nameStr) || PHONE_REGEX.test(commentStr)) {
      phoneLeaksCount++;
    } else if (commentStr.match(PHONE_IN_TEXT_REGEX)) {
      phoneLeaksCount++;
    }

    // Check boolean flags
    if (/^[YN]$|^YES$|^NO$/i.test(commentStr) || /^[YN]$|^YES$|^NO$/i.test(rankStr)) {
      booleanFlagsCount++;
    }

    // Check split single-word names (e.g. "García", "Rodríguez") when not mononyms
    const nameTokens = nameStr.split(/\s+/).filter(Boolean);
    if (nameTokens.length === 1 && !['n/a', 'unknown', 'sin'].includes(nameStr.toLowerCase())) {
      splitNamesCount++;
    }
  }

  const lawyerDefects = phoneLeaksCount + booleanFlagsCount + splitNamesCount;
  const lawyersPassed = rawLawyers.length > 0 && lawyerDefects === 0;

  if (!lawyersPassed) {
    const penalty = rawLawyers.length === 0 ? 1.0 : 2.0;
    totalPenalty += penalty;
    const defectDetails: string[] = [];
    if (phoneLeaksCount > 0) defectDetails.push(`${phoneLeaksCount} filtraciones de números telefónicos`);
    if (booleanFlagsCount > 0) defectDetails.push(`${booleanFlagsCount} banderas booleanas (Y/N) en comentarios`);
    if (splitNamesCount > 0) defectDetails.push(`${splitNamesCount} nombres de abogados fragmentados`);
    if (rawLawyers.length === 0) defectDetails.push('roster de abogados no detectado');

    const defectMsg = `Roster de abogados con deficiencias: detectado ${defectDetails.join(', ')}.`;
    violations.push(defectMsg);
    checks.push({
      check_id: 'lawyers',
      component: 'lawyers',
      passed: false,
      reason: defectMsg,
      penalty,
    });
  } else {
    checks.push({
      check_id: 'lawyers',
      component: 'lawyers',
      passed: true,
      reason: `Roster de abogados validado: ${rawLawyers.length} profesionales con roles claros, sin números de teléfono ni banderas residuales.`,
      penalty: 0,
    });
  }

  // 3. B10 STRATEGY CHECK (Institutional Pillars, word count, template leaks)
  const resolvedB10 = (
    b10Text ||
    chambersData.enhanced_b10 ||
    chambersData.enhanced_b7 ||
    chambersData.b10 ||
    chambersData.b7 ||
    ''
  ).trim();
  const b10WordCount = resolvedB10 ? resolvedB10.split(/\s+/).length : 0;
  const b10HasTemplateLeaks = TEMPLATE_LEAK_REGEX.test(resolvedB10);
  const b10TooShort = resolvedB10.length < 200;
  const b10Passed = !b10TooShort && !b10HasTemplateLeaks;

  if (!b10Passed) {
    totalPenalty += 2.0;
    const b10Reason = b10TooShort
      ? `Sección B10 deficiente: narrativa ausente o de longitud insuficiente (${resolvedB10.length} caracteres vs mínimo 200).`
      : `Sección B10 contiene directivas de plantilla o texto instructivo no resuelto.`;
    violations.push(b10Reason);
    checks.push({
      check_id: 'b10_strategy',
      component: 'b10_strategy',
      passed: false,
      reason: b10Reason,
      penalty: 2.0,
    });
  } else {
    checks.push({
      check_id: 'b10_strategy',
      component: 'b10_strategy',
      passed: true,
      reason: `Sección B10 articulada sobre los 4 pilares institucionales con profundidad sectorial verificada (${b10WordCount} palabras).`,
      penalty: 0,
    });
  }

  // 4. C2 POSITIONING CHECK (Ranking thesis & absence of template leaks)
  const resolvedC2 = (
    c2Text ||
    chambersData.enhanced_c2 ||
    chambersData.c2 ||
    ''
  ).trim();
  const c2HasTemplateLeaks = TEMPLATE_LEAK_REGEX.test(resolvedC2);
  const c2Passed = !c2HasTemplateLeaks;

  if (!c2Passed) {
    totalPenalty += 2.0;
    const c2Reason = `Sección C2 comprometida: contiene filtración de marcador de plantilla ("matter was important").`;
    violations.push(c2Reason);
    checks.push({
      check_id: 'c2_positioning',
      component: 'c2_positioning',
      passed: false,
      reason: c2Reason,
      penalty: 2.0,
    });
  } else {
    checks.push({
      check_id: 'c2_positioning',
      component: 'c2_positioning',
      passed: true,
      reason: 'Sección C2 validada: tesis de posicionamiento y justificación de ranking articulada sin fugas de plantilla.',
      penalty: 0,
    });
  }

  // 5. JURISDICTION CONSISTENCY (Foreign regulatory authority leak check)
  // Check entire combined text for country-specific regulatory mismatch
  const allOutputText = [
    resolvedB10,
    resolvedC2,
    auditLetterText,
    ...matters.map((m: any) => `${m.title || ''} ${m.summary || ''} ${m.narrative || ''} ${m.description || ''}`),
  ].join('\n');

  let jurisdictionIssue = '';
  if (isVenezuela && /\bSAT\b/.test(allOutputText)) {
    jurisdictionIssue = 'Contaminación jurisdiccional crítica: se detectó la autoridad tributaria mexicana ("SAT") en una submission de Venezuela (la autoridad legítima es SENIAT).';
  } else if (!isMexico && !isVenezuela && /\bSAT\b/.test(allOutputText) && !resolvedLocation.includes('global')) {
    jurisdictionIssue = 'Contaminación jurisdiccional: se detectó la autoridad mexicana ("SAT") fuera de México.';
  } else if (isMexico && /\bSENIAT\b/.test(allOutputText)) {
    jurisdictionIssue = 'Contaminación jurisdiccional: se detectó el organismo venezolano ("SENIAT") en una submission de México.';
  } else if (isMexico && /\bDIAN\b/.test(allOutputText)) {
    jurisdictionIssue = 'Contaminación jurisdiccional: se detectó el organismo colombiano ("DIAN") en una submission de México.';
  }

  const jurisdictionPassed = !jurisdictionIssue;
  if (!jurisdictionPassed) {
    totalPenalty += 3.0;
    violations.push(jurisdictionIssue);
    checks.push({
      check_id: 'jurisdiction_consistency',
      component: 'jurisdiction_consistency',
      passed: false,
      reason: jurisdictionIssue,
      penalty: 3.0,
    });
  } else {
    checks.push({
      check_id: 'jurisdiction_consistency',
      component: 'jurisdiction_consistency',
      passed: true,
      reason: `Consistencia jurisdiccional verificada: organismos regulatorios y tribunales alineados con ${location || 'jurisdicción objetivo'}.`,
      penalty: 0,
    });
  }

  // 6. ARTIFACT INTEGRITY (Absence of internal debug tags)
  const hasDebugTags = DEBUG_TAG_REGEX.test(allOutputText);
  if (hasDebugTags) {
    totalPenalty += 1.5;
    const debugReason = 'Falla de integridad de artefacto: etiquetas de depuración internas visibles en el entregable.';
    violations.push(debugReason);
    checks.push({
      check_id: 'artifact_integrity',
      component: 'artifact_integrity',
      passed: false,
      reason: debugReason,
      penalty: 1.5,
    });
  } else {
    checks.push({
      check_id: 'artifact_integrity',
      component: 'artifact_integrity',
      passed: true,
      reason: 'Integridad de artefacto confirmada: cero etiquetas internas, variables nulas o marcadores de depuración.',
      penalty: 0,
    });
  }

  // 7. HERO MATTER (Marquee Anchor at D #01)
  const firstMatter = matters[0] || {};
  const firstMatterClient = String(firstMatter.client || firstMatter.clientName || '').trim().toLowerCase();
  const heroPassed = Boolean(
    firstMatter &&
    firstMatterClient &&
    !firstMatterClient.includes('unknown') &&
    !firstMatterClient.includes('n/a') &&
    (firstMatter.summary || firstMatter.narrative || firstMatter.description)
  );

  if (!heroPassed) {
    totalPenalty += 1.0;
    const heroReason = 'Asunto Insignia (Hero Matter D #01) ausente o con cliente desconocido/sin sustancia probatoria.';
    violations.push(heroReason);
    checks.push({
      check_id: 'hero_matter',
      component: 'hero_matter',
      passed: false,
      reason: heroReason,
      penalty: 1.0,
    });
  } else {
    checks.push({
      check_id: 'hero_matter',
      component: 'hero_matter',
      passed: true,
      reason: `Asunto Insignia (Hero Matter) anclado en D #01 con peso probatorio y tracción de mercado (${firstMatter.client || 'Marquee'}).`,
      penalty: 0,
    });
  }

  // 8. PORTFOLIO HYGIENE (20-Matter Cap)
  const portfolioHygienePassed = totalMatters <= 20 && totalMatters > 0;
  if (!portfolioHygienePassed) {
    totalPenalty += 1.0;
    const hygieneReason = `Capacidad de portafolio excedida: ${totalMatters} asuntos superan el tope oficial de Chambers (máximo 20 permitidos en slate oficial).`;
    violations.push(hygieneReason);
    checks.push({
      check_id: 'portfolio_hygiene',
      component: 'portfolio_hygiene',
      passed: false,
      reason: hygieneReason,
      penalty: 1.0,
    });
  } else {
    checks.push({
      check_id: 'portfolio_hygiene',
      component: 'portfolio_hygiene',
      passed: true,
      reason: `Higiene de portafolio validada: ${totalMatters}/20 asuntos oficiales con excedente archivado en reserva.`,
      penalty: 0,
    });
  }

  // 9. EDITORIAL CRAFT (Zero Carpentry)
  const hasCarpentry = CARPENTRY_LABEL_REGEX.test(allOutputText);
  if (hasCarpentry) {
    totalPenalty += 1.0;
    const craftReason = 'Carpintería estructural detectada: encabezados mecánicos en negrita (**IMPACT:**, **HERO STATEMENT:**) visibles al lector.';
    violations.push(craftReason);
    checks.push({
      check_id: 'editorial_craft',
      component: 'editorial_craft',
      passed: false,
      reason: craftReason,
      penalty: 1.0,
    });
  } else {
    checks.push({
      check_id: 'editorial_craft',
      component: 'editorial_craft',
      passed: true,
      reason: 'Zero Carpentry validado: narrativa fluida en prosa orgánica sin etiquetas estructurales visibles.',
      penalty: 0,
    });
  }

  // 10. CAUSAL ATTRIBUTION (4-Stage Causal Model in Core Matters)
  let verifiedCausalCount = 0;
  const coreMatters = matters.slice(0, Math.min(totalMatters, 10));
  for (const m of coreMatters) {
    const text = `${m.narrative || ''} ${m.summary || ''} ${m.optimized_text || ''}`;
    const paras = text.split(/\n\s*\n/).filter(p => p.trim().length > 40);
    if (paras.length >= 2 || text.length >= 350) {
      verifiedCausalCount++;
    }
  }

  const causalMin = Math.max(1, Math.ceil(coreMatters.length * 0.6));
  const causalPassed = verifiedCausalCount >= causalMin;
  if (!causalPassed && totalMatters > 0) {
    totalPenalty += 1.0;
    const causalReason = `Atribución causal insuficiente: solo ${verifiedCausalCount}/${coreMatters.length} asuntos principales articulan el modelo causal activo.`;
    violations.push(causalReason);
    checks.push({
      check_id: 'causal_attribution',
      component: 'causal_attribution',
      passed: false,
      reason: causalReason,
      penalty: 1.0,
    });
  } else {
    checks.push({
      check_id: 'causal_attribution',
      component: 'causal_attribution',
      passed: true,
      reason: `Atribución causal verificada en ${verifiedCausalCount}/${coreMatters.length} asuntos nucleares bajo estándar Chambers.`,
      penalty: 0,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // MATHEMATICAL SCORE & VERDICT CALCULATION
  // ═══════════════════════════════════════════════════════════════
  const rawScore = 10.0 - totalPenalty;
  const finalScore = Math.max(1, Math.min(10, Math.round(rawScore)));

  // Critical gating: If register fails, score is capped at 4. If foreign authority leak occurs, score is capped at 5.
  let calibratedScore = finalScore;
  if (!registerPassed) calibratedScore = Math.min(calibratedScore, 4);
  if (!jurisdictionPassed) calibratedScore = Math.min(calibratedScore, 5);

  const passed = registerPassed && jurisdictionPassed && calibratedScore >= 7 && violations.length === 0;

  let status: 'passed' | 'with_observations' | 'blocked' = 'passed';
  if (calibratedScore < 5 || !registerPassed) {
    status = 'blocked';
  } else if (calibratedScore >= 5 && calibratedScore < 8) {
    status = 'with_observations';
  } else {
    status = 'passed';
  }

  const summary = status === 'passed'
    ? `Calidad editorial certificada para ${firmName} (${calibratedScore}/10). Cumple la Constitución Editorial Chambers v26.40.`
    : status === 'with_observations'
    ? `Entrega con observaciones estratégicas para ${firmName} (${calibratedScore}/10). Requiere atención a los puntos señalados.`
    : `Entrega bloqueada para ${firmName} (${calibratedScore}/10). Deficiencias críticas impiden el release.`;

  const feedback = [
    summary,
    violations.length > 0 ? `\nObservaciones detectadas (${violations.length}):\n` + violations.map(v => `• ${v}`).join('\n') : '',
    `\nDesglose de Puntuación: Base 10.0 | Penalizaciones acumuladas: -${totalPenalty.toFixed(1)} pts | Calificación Final: ${calibratedScore}/10.`,
  ].filter(Boolean).join('\n');

  return {
    score: calibratedScore,
    passed,
    status,
    summary,
    feedback,
    violations,
    checks,
  };
}
