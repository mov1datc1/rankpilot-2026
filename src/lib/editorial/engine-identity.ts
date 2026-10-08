import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
/** Match actual engine code/RAG even when Render skips a UI-only commit. */
export function engineFingerprint(root=join(process.cwd(),'ai-engine')) {
  const files=['main.py','requirements.txt','Dockerfile'].map(name=>join(root,name));
  const suffixes=new Set(['.py','.json','.txt','.md','.j2','.jinja2','.html','.tex']);
  const walk=(dir:string)=>{for(const entry of readdirSync(dir,{withFileTypes:true})) {
    if(['__pycache__','benchmark_cache'].includes(entry.name)) continue;
    const path=join(dir,entry.name);
    if(entry.isDirectory()) walk(path);
    else if(entry.isFile() && suffixes.has(extname(path))) files.push(path);
  }};
  for(const dir of ['agents','chains','config','core','rag_knowledge','templates','utils']) walk(join(root,dir));
  const records=files.map(path=>[relative(root,path).split('\\').join('/').normalize('NFC'),createHash('sha256').update(readFileSync(path)).digest('hex')]);
  records.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  return createHash('sha256').update(records.map(([name,digest])=>`${name}\0${digest}\n`).join('')).digest('hex');
}
