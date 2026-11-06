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
