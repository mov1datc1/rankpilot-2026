/** Selected scope is user input; detected scope remains source evidence. Never merge them. */
export type AnalysisScope = {directory:string;practice_area:string;jurisdiction:string;guide_region?:string};
const labels:Record<keyof AnalysisScope,string>={directory:'directorio',practice_area:'práctica',jurisdiction:'jurisdicción',guide_region:'guía/región'};
const aliases:Record<string,string>={
 'chambers partners':'chambers','chambers and partners':'chambers',
 'the legal 500':'legal 500','legal500':'legal 500',
 'labor employment':'labour employment','labor and employment':'labour employment','labour and employment':'labour employment','laboral':'labour employment','derecho laboral':'labour employment',
 'fiscal':'tax','derecho fiscal':'tax','tributario':'tax',
 'united states of america':'united states','usa':'united states','estados unidos':'united states','reino unido':'united kingdom','uk':'united kingdom',
};
function canonical(value:unknown,field:keyof AnalysisScope) {
 let text=String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 if(field==='jurisdiction') text=text.split('—').at(-1)!.trim();
 text=text.replace(/&/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
 return aliases[text] || text;
}
export function selectedScope(input:any):AnalysisScope {
 return {directory:input.targetDirectory ?? input.directory ?? '',practice_area:input.practiceArea ?? input.practice_area ?? input.practice ?? '',jurisdiction:input.guideRegion ?? input.jurisdiction ?? '',guide_region:input.guide_region ?? input.chambersData?.guideRegion ?? input.chambersData?.analysis_scope?.guide_region};
}
export function scopeIssues(scope:AnalysisScope,reports:any[]=[]) {
 const issues:{code:string;field:keyof AnalysisScope;selected:string;detected:string;source:string;quote:string;message:string}[]=[];
 for(const field of Object.keys(labels) as (keyof AnalysisScope)[]) {
  if(field==='guide_region' && scope[field]===undefined) continue; // Legacy scope has no asserted guide; never invent one.
  if(!canonical(scope[field],field) || ['general','general practice','n a','unknown','seleccionar'].includes(canonical(scope[field],field)))
   issues.push({code:'SCOPE_REQUIRED',field,selected:scope[field] || '',detected:'',source:'',quote:'',message:`Selecciona ${labels[field]} antes de continuar.`});
 }
 for(const report of reports) for(const field of Object.keys(labels) as (keyof AnalysisScope)[]) {
  const evidence=report.source_scope?.[field];
  if(!evidence?.value || !evidence?.quote || !scope[field]) continue;
  if(canonical(scope[field],field)!==canonical(evidence.value,field)) issues.push({code:'SCOPE_CONFLICT',field,selected:scope[field] || '',detected:evidence.value,source:report.source || '',quote:evidence.quote,message:`${report.source || 'El documento'}: elegiste ${labels[field]} «${scope[field]}», pero la fuente indica «${evidence.value}». Corrige el filtro o aporta la fuente correspondiente antes de analizar.`});
 }
 return issues;
}
