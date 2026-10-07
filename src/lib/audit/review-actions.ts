export type ReviewDestination = 'period' | 'lawyers' | 'wizard' | 'ranking' | 'review' | 'retry-selection';
export type FocusedReviewScope = { lawyerNames: string[]; matterIds: string[]; message: string };

const reviewName = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const mentions = (text: unknown, name: unknown) => {
  const normalized=reviewName(name);
  return normalized.length >= 4 && ` ${reviewName(text)} `.includes(` ${normalized} `);
};

/** Navigation only: match supplied identities; never infer or change a role. */
export function focusedReviewScope(message: string, lawyers: any[], matters: any[]): FocusedReviewScope {
  const lawyerNames=lawyers.map(l=>l.name || l.fullName || '').filter(name=>mentions(message,name));
  const matterIds=matters.filter(m=>mentions(message,m.client) || mentions(message,m.name || m.title) || lawyerNames.some(name=>mentions(m.leadPartner || m.lead_partner,name) || mentions(m.teamMembers || m.team_members,name))).map(m=>m.id);
  return {lawyerNames,matterIds,message};
}
export function describeReviewIssue(message: string) {
  if (/Strategy does not reconcile|conciliar la selección|vincular una cita de la selección|Core exceeds configured|No source-backed matter|Hero must belong/i.test(message)) return {title:'RankPilot debe rehacer la selección de asuntos',owner:'RankPilot',action:'La selección generada no pasó la comprobación de fuentes. Reintenta esta etapa: se conservan tus documentos, datos y redacciones. No necesitas corregir las fuentes por este error.',destination:'retry-selection' as ReviewDestination};
  if (/renderizador|registro canónico|basándose aparentemente|identidades obtenidas/i.test(message)) return {title:'Corregir los perfiles añadidos al Word',owner:'RankPilot',action:'El Word debe usar solo los abogados registrados y no inferir cargos desde los asuntos.',destination:'review' as ReviewDestination};
  if (/research_period|per[ií]odo (?:de investigaci[oó]n|aplicable)|elegibilidad temporal|fechas de/i.test(message)) return {title:'Confirmar el periodo y las fechas de los asuntos',owner:'Tu confirmación',action:'Indica las fechas de investigación y comprueba la actividad de cada asunto seleccionado dentro de ese intervalo.',destination:'period' as ReviewDestination};
  if (/Associate to Watch|categoría propuesta/i.test(message)) return {title:'Revisar la candidatura individual',owner:'Tu confirmación',action:'Confirma el cargo y corrige o retira la categoría propuesta. No se exportan candidaturas de asociado para un socio declarado.',destination:'lawyers' as ReviewDestination};
  if (/rankings individuales no verificados|Current ranking|Ranked.*N/i.test(message)) return {title:'Retirar afirmaciones de ranking sin verificar',owner:'RankPilot',action:'El Word deja el ranking sin afirmar cuando no existe verificación individual. Una consulta fallida no significa «Unranked».',destination:'review' as ReviewDestination};
  if (/\brol\b|cargo|seniority|lead partner/i.test(message)) return {title:'Resolver el cargo y la responsabilidad del abogado',owner:'Tu confirmación',action:'Confirma el cargo con fuente y fecha; revisa también quién debe figurar como socio responsable en los asuntos afectados.',destination:'lawyers' as ReviewDestination};
  if (/importe|moneda|monetario|valor|monto/i.test(message)) return {title:'Aclarar el importe y qué representa',owner:'Tu confirmación',action:'Indica importe, moneda y concepto con su fuente. Distingue valor del asunto, exposición y resultado.',destination:'wizard' as ReviewDestination};
  if (/ranking|posición declarada/i.test(message)) return {title:'Revisar la declaración de ranking',owner:'Revisión de fuente',action:'Comprueba persona o firma, práctica, país y edición. Conserva sin afirmar lo que la fuente no acredita.',destination:'ranking' as ReviewDestination};
  return {title:message.length>140 ? `${message.slice(0,137)}…` : message,owner:'Revisión pendiente',action:'Consulta el hallazgo completo y corrige los datos o el texto afectados antes de revisar la entrega.',destination:'review' as ReviewDestination};
}

/** Keep individual judge findings rather than the concatenated legacy error. */
export function reviewIsStale(data:any) {
  return !!data?.final_artifact_review && (data.final_review_stale === true ||
    (data.release_verdict?.errors || []).some((message:string)=>/^(Draft edited; validation required\.|Borrador editado; requiere nueva revisión\.)$/.test(message)));
}

export function reviewIssues(data:any, errors:string[]) {
  const defects = data?.final_artifact_review?.judge?.defects || [];
  const stale = reviewIsStale(data);
  const messages = stale ? [] : defects.filter((d:any)=>d.severity==='critical').map((d:any)=>String(d.message));
  for (const error of errors) {
    if (stale && (/^(Draft edited;|Borrador editado;|Genera y revisa|Reintenta la revisión editorial)/.test(error) || defects.some((d:any)=>d.message===error))) continue;
    if (messages.length && (/^El documento no superó la validación final:/.test(error) || error === 'Genera y revisa el archivo final antes de descargar.')) continue;
    messages.push(error);
  }
  const issues=[...new Set<string>(messages)].map(message=>{
    const defect=defects.find((d:any)=>d.message===message);
    const presentation=describeReviewIssue(message);
    if(defect?.owner==='rankpilot') return {message,...presentation,owner:'RankPilot',action:'La comprobación o reparación automática no resolvió este hallazgo. Corresponde a RankPilot revisar la propuesta; no cambies tus fuentes para hacerla pasar.',destination:'review' as ReviewDestination};
    return {message,...presentation};
  });
  if (stale) issues.unshift({message:'Tus respuestas están guardadas. Los hallazgos anteriores aún no se han comprobado contra estos cambios.',title:'Cambios guardados · revisión pendiente',owner:'RankPilot',action:'Pulsa «Preparar Submission y Audit» para revisar la versión guardada. No necesitas capturar otra vez las respuestas que ya confirmaste.',destination:'review' as ReviewDestination});
  const selection=issues.filter(issue=>issue.destination==='retry-selection');
  return selection.length ? [{...selection[0],message:selection.map(issue=>issue.message).join('\n')},...issues.filter(issue=>issue.destination!=='retry-selection' && issue.message!=='Genera y revisa el archivo final antes de descargar.')] : issues;
}
