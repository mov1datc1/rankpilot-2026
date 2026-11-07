/** Conservative output-only identity/additive binding, matching the engine.
 * It neither rewrites prose nor changes a source quotation or factual word. */
const norm=(value:any)=>String(value || '').normalize('NFC').replace(/\s+/gu,' ').trim();
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function canBindPublicQuote(quote:any,bio:any,name:any):boolean {
  const text=norm(bio),literal=norm(quote);
  if(!literal) return false;
  if(text.includes(literal)) return true;
  const stem=literal.replace(/\.$/u,'');
  if(stem.split(' ').length<4) return false;
  const variants=[stem],parts=norm(name).split(' ');
  for(let count=1;count<parts.length;count++) {
    const prefix=parts.slice(0,count).join(' ');
    if(new RegExp('^'+escape(prefix)+'\\s+','iu').test(stem)) variants.push(norm(name)+stem.slice(prefix.length));
  }
  for(const variant of [...variants]) if(/^(He|She)\s+(?!also\b)/iu.test(variant)) variants.push(variant.replace(/^(He|She)\s+/iu,'$1 also '));
  const matches=new Set<string>();
  for(const variant of variants) for(const match of text.matchAll(new RegExp('(?<![\\p{L}\\p{N}_])'+escape(variant)+'(?![\\p{L}\\p{N}_])','giu'))) matches.add(match.index+':'+(match.index!+match[0].length));
  return matches.size===1;
}
