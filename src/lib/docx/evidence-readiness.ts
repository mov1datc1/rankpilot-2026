/**
 * Evidence Readiness Engine (v27.0)
 * Evaluates the substantive quality, completeness, and defensibility of submission data
 * before optimization to prevent the generation of hollow or fabricated directory submissions.
 */

export interface MatterCompletenessStatus {
  id: string;
  name: string;
  hasClient: boolean;
  hasValue: boolean;
  hasOutcome: boolean;
  hasLeadPartner: boolean;
  isComplete: boolean;
  statusBadge: {
    label: string;
    color: string;
    bgColor: string;
  };
  missingFields: string[];
}

export interface EvidenceReadinessResult {
  score: number; // 0 - 100
  level: 'critical' | 'warning' | 'optimal';
  color: string; // '#EF4444' | '#F59E0B' | '#10B981'
  bgColor: string;
  label: string; // 'Insuficiente' | 'Incompleto' | 'Listo'
  summary: string;
  canOptimize: boolean;
  canOptimizeWithWarnings: boolean;
  blockers: string[];
  warnings: string[];
  missingElements: {
    totalMatters: number;
    mattersWithoutClient: number;
    mattersWithoutValue: number;
    mattersWithoutOutcome: number;
    mattersWithoutLeadPartner: number;
    missingLawyers: boolean;
    missingB10: boolean;
  };
  matterStatuses: MatterCompletenessStatus[];
  actionableChecklist: {
    id: string;
    label: string;
    done: boolean;
    impact: string;
    guidance: string;
  }[];
}

export function calculateEvidenceReadiness(
  matters: any[] = [],
  lawyers: any[] = [],
  b10Text: string = ''
): EvidenceReadinessResult {
  const totalMatters = matters.length;
  const blockers: string[] = [];
  const warnings: string[] = [];

  let mattersWithoutClient = 0;
  let mattersWithoutValue = 0;
  let mattersWithoutOutcome = 0;
  let mattersWithoutLeadPartner = 0;

  const matterStatuses: MatterCompletenessStatus[] = matters.map((m, idx) => {
    const name = m.name || m.title || `Matter #${idx + 1}`;
    const client = (m.client || '').trim();
    const value = (m.value || m.matter_value || '').trim();
    const leadPartner = (m.leadPartner || m.lead_partner || '').trim();
    const rawNotes = (m.rawNotes || m.summary || m.notes || '').trim();
    const optText = (m.optimizedText || '').trim();
    const combinedNotes = `${rawNotes} ${optText}`.toLowerCase();

    // Check client validity
    const hasClient = Boolean(
      client &&
      !client.toLowerCase().includes('client name') &&
      !client.toLowerCase().includes('general description')
    );
    if (!hasClient) mattersWithoutClient++;

    // Check value
    const hasValue = Boolean(
      value &&
      !value.toLowerCase().includes('not disclosed') &&
      !value.toLowerCase().includes('confidential') &&
      !value.toLowerCase().includes('currency and amount')
    );
    if (!hasValue) mattersWithoutValue++;

    // Check lead partner
    const hasLeadPartner = Boolean(leadPartner);
    if (!hasLeadPartner) mattersWithoutLeadPartner++;

    // Check substantive outcome (mentions decree, order, approval, closing, settlement, precedent, or length > 120 chars)
    const outcomeIndicators = [
      'won', 'obtained', 'secured', 'resolved', 'closed', 'dismissed', 'approved',
      'settled', 'favorable', 'decree', 'judgment', 'award', 'sentencia', 'amparo',
      'ganado', 'obtuvo', 'concedió', 'resolución', 'cierre', 'adquisición', 'completed',
      'expropriation', 'precautionary', 'suspension', 'protective'
    ];
    const hasOutcome = combinedNotes.length > 120 || outcomeIndicators.some(k => combinedNotes.includes(k));
    if (!hasOutcome) mattersWithoutOutcome++;

    const missingFields: string[] = [];
    if (!hasClient) missingFields.push('Cliente o Sector');
    if (!hasValue) missingFields.push('Monto/Valor Económico');
    if (!hasOutcome) missingFields.push('Resultado/Hito Concreto');
    if (!hasLeadPartner) missingFields.push('Socio Líder');

    let badge = { label: 'Completo', color: '#15803D', bgColor: '#DCFCE7' };
    if (!hasClient) {
      badge = { label: '✕ Sin Cliente', color: '#B91C1C', bgColor: '#FEE2E2' };
    } else if (!hasOutcome) {
      badge = { label: '⚠ Falta Resultado', color: '#B45309', bgColor: '#FEF3C7' };
    } else if (!hasValue) {
      badge = { label: '⚠ Falta Monto', color: '#B45309', bgColor: '#FEF3C7' };
    } else if (!hasLeadPartner) {
      badge = { label: '⚠ Sin Socio', color: '#4338CA', bgColor: '#EEF2FF' };
    }

    return {
      id: m.id || `m-${idx}`,
      name,
      hasClient,
      hasValue,
      hasOutcome,
      hasLeadPartner,
      isComplete: missingFields.length === 0,
      statusBadge: badge,
      missingFields,
    };
  });

  // Calculate Sub-scores (Total 100 points)
  // 1. Matter Count (Max 30 pts)
  let countScore = 0;
  if (totalMatters >= 10) {
    countScore = 30;
  } else if (totalMatters >= 5) {
    countScore = 15 + Math.round(((totalMatters - 5) / 5) * 15);
  } else if (totalMatters > 0) {
    countScore = Math.round((totalMatters / 5) * 15);
    blockers.push(`Se detectaron solo ${totalMatters} asuntos (Chambers exige un mínimo de 10 a 20 para evaluar la solidez del departamento).`);
  } else {
    countScore = 0;
    blockers.push('No hay asuntos cargados en el submission.');
  }

  // 2. Client Specificity (Max 20 pts)
  let clientScore = 0;
  if (totalMatters > 0) {
    const clientPct = (totalMatters - mattersWithoutClient) / totalMatters;
    clientScore = Math.round(clientPct * 20);
    if (mattersWithoutClient > 0) {
      warnings.push(`${mattersWithoutClient} asunto(s) no tienen cliente identificado o solo indican un texto genérico.`);
    }
  }

  // 3. Evidentiary Substance & Concrete Outcomes (Max 25 pts)
  let substanceScore = 0;
  if (totalMatters > 0) {
    const outcomePct = (totalMatters - mattersWithoutOutcome) / totalMatters;
    substanceScore = Math.round(outcomePct * 25);
    if (mattersWithoutOutcome > 0) {
      warnings.push(`${mattersWithoutOutcome} asunto(s) carecen de un resultado o hito verificable (resolución judicial, cierre de contrato o suspensión cautelar).`);
    }
  }

  // 4. Financial & Scale Metrics (Max 15 pts)
  let valueScore = 0;
  if (totalMatters > 0) {
    const valuePct = (totalMatters - mattersWithoutValue) / totalMatters;
    valueScore = Math.round(valuePct * 15);
    if (mattersWithoutValue > 0) {
      warnings.push(`${mattersWithoutValue} asunto(s) no indican monto en cifras ni escala cuantificada en USD/moneda local.`);
    }
  }

  // 5. Team Attribution & B10 Overview (Max 10 pts)
  let teamScore = 0;
  const hasLawyers = Array.isArray(lawyers) && lawyers.length > 0;
  const hasB10 = Boolean(b10Text && b10Text.trim().length > 60);

  if (hasLawyers) teamScore += 6;
  else {
    warnings.push('No se detectaron abogados nominados en la Sección B9. Se requiere al menos un socio responsable.');
  }

  if (hasB10) teamScore += 4;
  else {
    warnings.push('La Sección B10 (Reseña del Departamento) está vacía o incompleta.');
  }

  const rawScore = countScore + clientScore + substanceScore + valueScore + teamScore;
  const score = Math.min(100, Math.max(0, rawScore));

  let level: 'critical' | 'warning' | 'optimal' = 'optimal';
  let color = '#10B981';
  let bgColor = '#ECFDF5';
  let label = 'Óptima';
  let summary = 'La información recopilada cuenta con masa crítica, métricas y resultados suficientes para una postulación altamente competitiva.';

  if (score < 50 || totalMatters < 3) {
    level = 'critical';
    color = '#EF4444';
    bgColor = '#FEF2F2';
    label = 'Insuficiente';
    summary = 'La información actual es preliminar. Optimizar ahora generaría un borrador con severas lagunas editoriales ante el directorio.';
  } else if (score < 80) {
    level = 'warning';
    color = '#F59E0B';
    bgColor = '#FFFBEB';
    label = 'Incompleta';
    summary = 'Hay asuntos estructurados, pero faltan montos económicos clave, resultados concretos o socios líderes en varios expedientes.';
  }

  const actionableChecklist = [
    {
      id: 'matters-count',
      label: `Alcanzar mínimo 10 asuntos representativos (${totalMatters}/10 cargados)`,
      done: totalMatters >= 10,
      impact: 'Alto — Chambers desestima postulaciones de menos de 10-12 asuntos en bandas competitivas.',
      guidance: 'Agrega mandatos complementarios desde el Matter Assistant o mediante el formulario rápido.'
    },
    {
      id: 'client-names',
      label: `Identificar clientes corporativos (${totalMatters - mattersWithoutClient}/${totalMatters} completos)`,
      done: mattersWithoutClient === 0 && totalMatters > 0,
      impact: 'Alto — Los investigadores de Chambers validan la práctica contactando o auditando a los clientes.',
      guidance: 'Si el cliente exige confidencialidad estricta, indica su sector específico (ej. "Tier-1 Multinacional Automotriz") y marca la casilla Confidencial.'
    },
    {
      id: 'outcomes',
      label: `Especificar resultado o valor agregado (${totalMatters - mattersWithoutOutcome}/${totalMatters} con resultado)`,
      done: mattersWithoutOutcome === 0 && totalMatters > 0,
      impact: 'Crítico — Chambers no clasifica firmas por "asesorar", sino por el impacto concreto obtenido para el cliente.',
      guidance: 'Describe qué cambió para el cliente: ¿se evitó la huelga? ¿se obtuvo la suspensión definitiva? ¿se cerró la compraventa?'
    },
    {
      id: 'deal-values',
      label: `Cuantificar valor de los asuntos (${totalMatters - mattersWithoutValue}/${totalMatters} con cifras)`,
      done: mattersWithoutValue === 0 && totalMatters > 0,
      impact: 'Medio — Permite a Chambers calibrar el tamaño y relevancia del despacho frente a competidores.',
      guidance: 'Indica el monto aproximado de la contingencia, la inversión protegida o el valor del contrato en USD o moneda local.'
    },
    {
      id: 'team-lawyers',
      label: `Roster de abogados B9 (${lawyers.length} abogados detectados)`,
      done: hasLawyers,
      impact: 'Alto — Se requiere atribuir el trabajo a socios nominados para aspirar a rankings individuales.',
      guidance: 'Registra los nombres de los socios principales y asociados que lideraron cada mandato.'
    }
  ];

  return {
    score,
    level,
    color,
    bgColor,
    label,
    summary,
    canOptimize: level === 'optimal',
    canOptimizeWithWarnings: level === 'warning',
    blockers,
    warnings,
    missingElements: {
      totalMatters,
      mattersWithoutClient,
      mattersWithoutValue,
      mattersWithoutOutcome,
      mattersWithoutLeadPartner,
      missingLawyers: !hasLawyers,
      missingB10: !hasB10,
    },
    matterStatuses,
    actionableChecklist,
  };
}
