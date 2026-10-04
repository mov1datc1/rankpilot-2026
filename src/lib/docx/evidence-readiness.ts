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
  insufficientMattersCount: number;
  mattersNeedingAttention: MatterCompletenessStatus[];
  practiceDiscrepancy?: any;
  actionableChecklist: {
    id: string;
    label: string;
    done: boolean;
    impact: string;
    guidance: string;
  }[];
}

/** Field-presence guidance, not editorial quality or a directory ranking prediction. */
export function calculateEvidenceReadiness(matters:any[]=[],lawyers:any[]=[],b10Text='',options?:{practiceArea?:string;calibratedPracticeArea?:string}):EvidenceReadinessResult {
  const blockers:string[]=[],warnings:string[]=[];
  const matterStatuses=matters.map((m,idx)=>{
    const text=String(m.source_excerpt || m.rawNotes || m.summary || m.notes || '');
    const hasClient=Boolean(String(m.client || '').trim());
    const hasValue=Boolean(String(m.value || m.matter_value || '').trim());
    const hasLeadPartner=Boolean(String(m.leadPartner || m.lead_partner || '').trim());
    const hasOutcome=Boolean(m.completionDate || m.completion_date) || /\b(pending|ongoing|closed|completed|settled|dismissed|won|obtained|approved|award|pendiente|en curso|concluido|cerrado|sentencia|obtuvo)\b/i.test(text);
    const missingFields=[...(!hasClient?['Cliente o descripción autorizada']:[]),...(!text.trim()?['Trabajo realizado y fuente']:[]),...(!hasOutcome?['Estado actual o resultado documentado']:[]),...(!hasLeadPartner?['Responsable del trabajo']:[])];
    return {id:m.id || `m-${idx}`,name:m.name || m.title || m.client || `Asunto ${idx+1}`,hasClient,hasValue,hasOutcome,hasLeadPartner,isComplete:missingFields.length===0,missingFields,statusBadge:missingFields.length?{label:'Datos por completar',color:'#B45309',bgColor:'#FEF3C7'}:{label:'Datos básicos presentes',color:'#15803D',bgColor:'#DCFCE7'}};
  });
  const count=(key:'hasClient'|'hasValue'|'hasOutcome'|'hasLeadPartner')=>matterStatuses.filter(m=>!m[key]).length;
  const missingElements={totalMatters:matters.length,mattersWithoutClient:count('hasClient'),mattersWithoutValue:count('hasValue'),mattersWithoutOutcome:count('hasOutcome'),mattersWithoutLeadPartner:count('hasLeadPartner'),missingLawyers:!lawyers.length,missingB10:!b10Text.trim()};
  if(!matters.length)blockers.push('Añade al menos un asunto con su fuente antes de redactar.');
  if(missingElements.missingB10)blockers.push('Completa la descripción del departamento con información de origen.');
  if(matters.length && matters.every(m=>!String(m.source_excerpt || m.rawNotes || m.summary || '').trim()))blockers.push('Falta describir el trabajo realizado en las fuentes de los asuntos.');
  if(missingElements.mattersWithoutClient)warnings.push(`${missingElements.mattersWithoutClient} asunto(s) requieren identificar al cliente o su descripción autorizada.`);
  if(missingElements.mattersWithoutOutcome)warnings.push(`${missingElements.mattersWithoutOutcome} asunto(s) no indican su estado actual. Si siguen pendientes, indícalo; no necesitas inventar un resultado.`);
  if(missingElements.mattersWithoutLeadPartner)warnings.push(`${missingElements.mattersWithoutLeadPartner} asunto(s) no atribuyen el trabajo a una persona responsable.`);
  if(missingElements.mattersWithoutValue)warnings.push(`${missingElements.mattersWithoutValue} asunto(s) no indican valor económico. Añádelo solo si aplica y existe una cifra respaldada; conserva su moneda.`);
  if(missingElements.missingLawyers)warnings.push('Revisa los nombres y funciones del equipo antes de la entrega.');
  const totalFields=matters.length*4+1;
  const presentFields=matterStatuses.reduce((n,m)=>n+Number(m.hasClient)+Number(m.hasOutcome)+Number(m.hasLeadPartner)+Number(!m.missingFields.includes('Trabajo realizado y fuente')),0)+Number(!missingElements.missingB10);
  const score=Math.round(presentFields/totalFields*100);
  const level=blockers.length?'critical':warnings.length?'warning':'optimal';
  const color=level==='critical'?'#EF4444':level==='warning'?'#D97706':'#15803D';
  const bgColor=level==='critical'?'#FEF2F2':level==='warning'?'#FFFBEB':'#F0FDF4';
  const actionableChecklist=[
    {id:'source-matters',label:'Asuntos con hechos de origen',done:matters.length>0 && !blockers.some(b=>b.includes('fuentes de los asuntos')),impact:'Permite redactar sin inventar.',guidance:'Describe cliente, encargo, trabajo realizado y situación actual.'},
    {id:'department',label:'Descripción del departamento',done:!missingElements.missingB10,impact:'Sustenta la narrativa institucional.',guidance:'Añade únicamente capacidades y responsables respaldados por la fuente.'},
    {id:'client-names',label:'Identidad de clientes y permisos',done:!missingElements.mattersWithoutClient && matters.length>0,impact:'La identidad y la autorización de publicación se revisan por separado.',guidance:'Confirma el estado público o confidencial de cada asunto.'},
    {id:'outcomes',label:'Estado actual o resultado documentado',done:!missingElements.mattersWithoutOutcome && matters.length>0,impact:'Evita presentar trabajo pendiente como un éxito obtenido.',guidance:'Incluye fecha, etapa y resultado solo cuando estén acreditados.'},
    {id:'team-lawyers',label:'Atribución del trabajo',done:!missingElements.mattersWithoutLeadPartner && matters.length>0,impact:'Distingue quién realizó y quién dirigió el trabajo.',guidance:'No deduzcas cargo, liderazgo o ranking de una mera mención.'}
  ];
  return {score,level,color,bgColor,label:level==='critical'?'Falta contenido de origen':level==='warning'?'Datos por completar':'Datos básicos presentes',summary:'Este indicador muestra campos presentes; no certifica calidad editorial, elegibilidad ni ranking. La entrega depende de la revisión de fuentes y del documento final.',canOptimize:!blockers.length,canOptimizeWithWarnings:!blockers.length && warnings.length>0,blockers,warnings,missingElements,matterStatuses,insufficientMattersCount:matters.length?0:1,mattersNeedingAttention:matterStatuses.filter(m=>!m.isComplete),practiceDiscrepancy:null,actionableChecklist};
}
