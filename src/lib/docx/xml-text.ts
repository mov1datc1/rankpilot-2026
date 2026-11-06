/** Logical Word text: decode XML character references once, never recursively.
 * Preserve literal entity-looking text such as &amp;quot; as the Word displays it. */
export function wordXmlText(xml:string):string {
  return xml.replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(whole,entity:string)=>{
      if(entity[0]==='#') {
        const hex=entity[1].toLowerCase()==='x';const n=Number.parseInt(entity.slice(hex?2:1),hex?16:10);
        return Number.isFinite(n)&&n>=0&&n<=0x10ffff?String.fromCodePoint(n):whole;
      }
      return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[entity.toLowerCase()] || whole;
    });
}

/** Capture the actual public profile row, after every renderer transformation. */
export function wordTableProfiles(xml:string,names:string[]):Record<string,string> {
  const norm=(v:string)=>v.normalize('NFC').replace(/\s+/g,' ').trim();
  const expected=new Map(names.map(name=>[norm(name),name]));
  const profiles:Record<string,string>={};
  for(const row of xml.matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)) {
    const cells=[...row[0].matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)].map(cell=>wordXmlText(cell[0]));
    const name=expected.get(norm(cells[0]||''));
    const content=cells.slice(1).join('\n').trim();
    // Interview/contact rows cannot replace the public biography.
    if(name && content.split(/\s+/).length>=6 && !/^[^\s@]+@[^\s@]+$/.test(content))profiles[name]=content;
  }
  return profiles;
}
