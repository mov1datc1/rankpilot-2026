/** Audit recommendations are navigation, never delivery gates or evidence of completion. */
export type AuditActionKind = 'period' | 'filing' | 'lawyers' | 'matters' | 'references';
export type AuditAction = {id:string;message:string;kind:AuditActionKind;cta:string};
const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function auditActions(letter:any):AuditAction[] {
  const structured=Array.isArray(letter?.next_actions) ? letter.next_actions : null;
  const blocks=structured ? structured.map((a:any)=>String(a.message || '')) : String(letter?.next_steps || '').split(/\n\s*\n|\n(?=\d+[.)]\s)|(?<=\.)\s+(?=\d+[.)]\s)/);
  return blocks.map((s:string)=>s.trim()).filter(Boolean).map((message:string)=>{
    const text=normal(message);
    const proposed=structured?.find((a:any)=>a.message?.trim()===message)?.kind;
    const kind:AuditActionKind=['period','filing','lawyers','matters','references'].includes(proposed)?proposed:/referenc(?:ias|es)|referees|testimon/.test(text)?'references':/ventana|periodo|research window/.test(text)?'period':/contacto|departamento|headcount|filing|numero de socios/.test(text)?'filing':/categoria|candidat|abogado|socio|partner|cargo/.test(text)?'lawyers':'matters';
    // Full text is the identity: no accidental collisions or positional completion.
    return {id:message,message,kind,cta:{period:'Completar periodo',filing:'Completar datos de presentación',lawyers:'Revisar candidatura',matters:'Completar evidencia del asunto',references:'Añadir referencias de clientes'}[kind]};
  });
}
function signature(data:any,kind:AuditActionKind) {
  const value=kind==='period'?data.research_period:kind==='filing'?[data.contacts,data.departmentName,data.numPartners,data.numLawyers,data.departmentHeads,data.target_band]:kind==='references'?data.audit_referee_notes:kind==='lawyers'?data.lawyers:[data.matters,data.lawyers];
  return JSON.stringify(value ?? null);
}
export function recordAuditAction(before:any,after:any,id:string|undefined,userId:string) {
  const existing=before.audit_action_responses || [];
  if(!id)return existing;
  const action=auditActions(before.editorial_review?.letter).find(a=>a.id===id);
  if(!action)throw new Error('Esta recomendación cambió. Vuelve al Audit actualizado.');
  if(signature(before,action.kind)===signature(after,action.kind))return existing;
  return [...existing.filter((r:any)=>r.id!==id),{id,kind:action.kind,signature:signature(after,action.kind),savedAt:new Date().toISOString(),savedBy:userId,revision:after.draft_revision}];
}
export function auditActionHasResponse(data:any,action:AuditAction) {
  return (data.audit_action_responses || []).some((r:any)=>r.id===action.id && r.signature===signature(data,action.kind));
}
export function normalizeRefereeNotes(value:unknown) {
  if(typeof value!=='string' || value.trim().length>8000)throw new Error('Las referencias deben tener como máximo 8.000 caracteres.');
  return value.trim();
}

/** Keep the uploaded extract intact while making attributed additions usable as source evidence. */
export function supplementMatter(matter:any,previous:any,userId:string) {
  if(matter.additionalEvidence===undefined)return matter;
  if(!previous)throw new Error('Añade evidencia a un asunto existente del expediente.');
  const text=normalizeRefereeNotes(matter.additionalEvidence);
  const source=normalizeRefereeNotes(matter.additionalEvidenceSource || '');
  if(text && !source)throw new Error('Indica la fuente o procedencia de la información adicional.');
  const original=previous.sourceNotesBeforeAddition ?? previous.rawNotes ?? previous.summary ?? '';
  const unchanged=text===(previous.additionalEvidence || '') && source===(previous.additionalEvidenceSource || '');
  return {...matter,sourceNotesBeforeAddition:original,additionalEvidence:text,additionalEvidenceSource:source,
    additionalEvidenceSavedAt:unchanged?previous.additionalEvidenceSavedAt:new Date().toISOString(),additionalEvidenceSavedBy:unchanged?previous.additionalEvidenceSavedBy:userId,
    rawNotes:original+(text?`\n\nInformación adicional aportada por la firma. Fuente: ${source}\n${text}`:''),
    ...(!unchanged?{optimizedText:'',optimized_text:'',status:'Draft'}:{})};
}
