/** The revision register owns source order, permissions and generated prose. */
export function studioMatters(data:any, databaseMatters:any[]=[]):any[] {
  const source=Array.isArray(data.matters) && data.matters.length ? data.matters:databaseMatters;
  return source.map((m:any,idx:number)=>({...m,id:m.id || m._id || `matter-${idx}-${String(m.client || m.name || m.title || 'item').replace(/[^a-zA-Z0-9]/g,'_').toLowerCase()}`}));
}
function canonical(value:any):any {
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
export function studioDraftChanged(data:any, databaseMatters:any[], matters:any[], b10:string):boolean {
  const savedB10=data.enhanced_b7 || data.enhanced_b10 || data.b7 || data.original_b10 || data.departmentDesc || '';
  return b10!==savedB10 || JSON.stringify(canonical(matters))!==JSON.stringify(canonical(studioMatters(data,databaseMatters)));
}
