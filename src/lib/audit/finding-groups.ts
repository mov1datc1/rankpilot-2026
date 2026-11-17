/** One card per real problem: findings that cite the same field and source passage are merged,
 * and the generic "acceptance incomplete" summary is hidden when concrete findings explain it. */
export type Finding = {message:string;field_path?:string;source_quote?:string;artifact_quote?:string;[k:string]:any};
const norm=(value:any)=>String(value || '').replace(/\s+/g,' ').trim().toLowerCase();
const GENERIC=/^La aceptación editorial no está completa:/;

export function groupFindings(findings:Finding[]):(Finding & {related:string[]})[] {
  const concrete=findings.filter(f=>!(GENERIC.test(String(f.message || '')) && !f.source_quote && !f.artifact_quote));
  const list=concrete.length ? concrete : findings;
  const groups=new Map<string,Finding & {related:string[]}>();
  for(const finding of list) {
    const key=finding.source_quote ? `${norm(finding.field_path)}|${norm(finding.source_quote)}` : `msg|${norm(finding.message)}`;
    const existing=groups.get(key);
    if(existing) {if(norm(finding.message)!==norm(existing.message)) existing.related.push(finding.message);}
    else groups.set(key,{...finding,related:[]});
  }
  return [...groups.values()];
}
