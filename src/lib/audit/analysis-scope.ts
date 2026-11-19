/** Selected scope is user input; detected scope remains source evidence. Never merge them. */
export type AnalysisScope = {directory:string;practice_area:string;jurisdiction:string;guide_region?:string;modality?:string};
const labels:Record<keyof AnalysisScope,string>={directory:'directorio',practice_area:'práctica',jurisdiction:'jurisdicción',guide_region:'guía/región',modality:'modalidad'};
const aliases:Record<string,string>={
 'chambers partners':'chambers','chambers and partners':'chambers',
 'the legal 500':'legal 500','legal500':'legal 500',
 'labor employment':'labour employment','labor and employment':'labour employment','labour and employment':'labour employment','laboral':'labour employment','derecho laboral':'labour employment',
 'fiscal':'tax','derecho fiscal':'tax','tributario':'tax',
 'united states of america':'united states','usa':'united states','estados unidos':'united states','reino unido':'united kingdom','uk':'united kingdom',
};
function canonical(value:unknown,field:keyof AnalysisScope) {
 let text=String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 if(field==='jurisdiction') {
  text=text.split('—').at(-1)!.trim();
  // Explicit locality, state, country is compatible with that country filter.
  const tail=text.split(',').at(-1)!.trim();
  if(['mexico','venezuela','chile','colombia','peru','argentina','brazil','brasil','united states','usa','united kingdom','spain','espana','canada','ecuador','uruguay','paraguay','bolivia','costa rica','panama'].includes(tail)) text=tail;
 }
 text=text.replace(/&/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
 return aliases[text] || text;
}
/** v1.0.106: the list entry a detected practice names, through the same
 * aliases as the scope check (e.g. «Derecho Fiscal» → «Tax»), or null. */
export function matchPracticeArea(detected:unknown,options:readonly string[]):string|null {
 const key=canonical(detected,'practice_area');
 return key ? options.find(option=>canonical(option,'practice_area')===key) ?? null : null;
}
export function selectedScope(input:any):AnalysisScope {
 return {
  directory:input.targetDirectory ?? input.directory ?? '',
  practice_area:input.practiceArea ?? input.practice_area ?? input.practice ?? '',
  jurisdiction:input.guideRegion ?? input.jurisdiction ?? '',
  guide_region:input.guide_region ?? input.chambersData?.guideRegion ?? input.chambersData?.analysis_scope?.guide_region,
  modality:input.modality ?? input.chambersData?.modality ?? input.context?.modality
 };
}
export function scopeIssues(scope:AnalysisScope,reports:any[]=[],modality?:string) {
 const rawModality = String(modality || scope.modality || '').trim().toLowerCase();
 const isScratch = rawModality === 'scratch' || rawModality === 'sources' || rawModality === 'b' || rawModality.startsWith('b') || rawModality.includes('scratch');
 const issues:{code:string;field:keyof AnalysisScope;selected:string;detected:string;source:string;quote:string;message:string}[]=[];
 if(canonical(scope.directory,'directory') && !['chambers','legal 500'].includes(canonical(scope.directory,'directory')))
  issues.push({code:'DIRECTORY_UNSUPPORTED',field:'directory',selected:scope.directory,detected:'',source:'',quote:'',message:'La preparación y revisión final están disponibles para Chambers & Partners y Legal 500. Selecciona uno como destino; en la opción B puedes usar originales de otros directorios.'});
 for(const field of Object.keys(labels) as (keyof AnalysisScope)[]) {
  if(field==='modality') continue;
  if(field==='guide_region' && scope[field]===undefined) continue; // Legacy scope has no asserted guide; never invent one.
  if(!canonical(scope[field],field) || ['general','general practice','n a','unknown','seleccionar'].includes(canonical(scope[field],field)))
   issues.push({code:'SCOPE_REQUIRED',field,selected:scope[field] || '',detected:'',source:'',quote:'',message:`Selecciona ${labels[field]} antes de continuar.`});
 }
 for(const report of reports) for(const field of Object.keys(labels) as (keyof AnalysisScope)[]) {
  if(field==='modality') continue;
  // In Modalidad B (scratch/dispersed), background sources from other directories (e.g. Leaders League, Legal 500)
  // are historical source documents to be adapted into the target directory, never a scope conflict.
  if(field==='directory' && isScratch) continue;
  const evidence=report.source_scope?.[field];
  if(!evidence?.value || !evidence?.quote || !scope[field]) continue;
  if(canonical(scope[field],field)!==canonical(evidence.value,field)) issues.push({code:'SCOPE_CONFLICT',field,selected:scope[field] || '',detected:evidence.value,source:report.source || '',quote:evidence.quote,message:`${report.source || 'El documento'}: elegiste ${labels[field]} «${scope[field]}», pero la fuente indica «${evidence.value}». Corrige el filtro o aporta la fuente correspondiente antes de analizar.`});
 }
 return issues;
}

export type ScopeIssue=ReturnType<typeof scopeIssues>[number];
export type ScopeConfirmation={field:string;selected:string;detected:string;source:string};
const CONFIRMABLE=new Set(['practice_area','jurisdiction','guide_region']);
const confirmationKey=(i:ScopeConfirmation)=>[i.field,canonical(i.selected,i.field as keyof AnalysisScope),canonical(i.detected,i.field as keyof AnalysisScope),i.source].join('|');

/** Issues the user has not yet answered. A confirmation answers only the exact
 * field, selected value, detected value and source it was given for. */
export function unconfirmedScopeIssues(issues:ScopeIssue[],confirmations:unknown):ScopeIssue[] {
 const given=new Set((Array.isArray(confirmations)?confirmations:[]).filter((c:any)=>c && typeof c==='object').map((c:any)=>confirmationKey({field:String(c.field||''),selected:String(c.selected||''),detected:String(c.detected||''),source:String(c.source||'')})));
 return issues.filter(i=>!(i.code==='SCOPE_CONFLICT' && CONFIRMABLE.has(i.field) && given.has(confirmationKey(i))));
}

/** Ángela 18-11: one template header ("A2 Practice Area: Energy & Natural
 * Resources") stopped an Environment case whose other five sources declared
 * nothing else. A declared practice/jurisdiction conflict becomes ONE question
 * before any paid call, with the recommendation given by the majority of
 * sources. Directory conflicts and missing scope still block. */
export function scopeQuestion(issues:ScopeIssue[],reports:any[]=[]) {
 const confirmable=issues.length>0 && issues.every(i=>i.code==='SCOPE_CONFLICT' && CONFIRMABLE.has(i.field));
 const total=Math.max(reports.length,1);
 const fields=[...new Set(issues.map(i=>i.field))];
 const items=fields.map(field=>{
  const own=issues.filter(i=>i.field===field);
  const conflicting=new Set(own.map(i=>i.source)).size;
  const detected=[...new Set(own.map(i=>i.detected))];
  const recommendation:'continue'|'change'=conflicting*2<=total || detected.length>1?'continue':'change';
  const names=[...new Set(own.map(i=>`«${i.source || 'un documento'}»`))].join(', ');
  const message=`${names} ${conflicting===1?'indica':'indican'} ${labels[field]} «${detected.join('», «')}», pero elegiste «${own[0].selected}». `
   +(recommendation==='continue'
     ?`${total-conflicting} de ${total} fuentes no indican otra ${labels[field]}; recomendamos continuar con «${own[0].selected}».`
     :`La mayoría de tus fuentes (${conflicting} de ${total}) indica «${detected[0]}»; revisa el filtro antes de continuar.`);
  return {field,selected:own[0].selected,detected,recommendation,message};
 });
 return {confirmable,items,
  confirmations:issues.filter(i=>i.code==='SCOPE_CONFLICT').map(i=>({field:i.field,selected:i.selected,detected:i.detected,source:i.source}))};
}

/** Scope check of a saved draft: conflicts the user confirmed at intake (stored
 * as chambersData.scope_confirmations) do not stop later stages. Changing the
 * selected scope invalidates the confirmation because its key includes it. */
export function savedScopeIssues(submission:any,data:any) {
 return unconfirmedScopeIssues(scopeIssues(selectedScope(submission),data?.source_reports || []),data?.scope_confirmations);
}
