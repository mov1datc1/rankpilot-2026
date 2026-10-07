const keys = ['executive_assessment','portfolio','leadership','evidence_gaps','next_steps'] as const;
const headings: Record<string,string> = {
  'evaluación ejecutiva':'executive_assessment', 'executive assessment':'executive_assessment',
  'cartera':'portfolio', 'cartera seleccionada':'portfolio', 'selected portfolio':'portfolio',
  'liderazgo':'leadership', 'liderazgo y atribución':'leadership', 'leadership and attribution':'leadership',
  'brechas de evidencia':'evidence_gaps', 'evidence gaps':'evidence_gaps',
  'próximos pasos':'next_steps', 'recommended next steps':'next_steps',
};

/** Recover explicitly labelled sections only when all five are unambiguous.
 * No inference, paraphrase or loss of content; partial/duplicate headings stay untouched. */
export function normalizeLetterSections(letter:any) {
  if (!letter || keys.some(key=>typeof letter[key] !== 'string')) return letter;
  const text=keys.map(key=>letter[key]).filter(Boolean).join('\n\n');
  const matches=[...text.matchAll(/^\*\*([^*\n]+)\*\*\s*$/gm)]
    .map(match=>({index:match.index!, end:match.index!+match[0].length,key:headings[match[1].trim().toLowerCase()]}))
    .filter(match=>match.key);
  if(matches.length!==5 || new Set(matches.map(match=>match.key)).size!==5 || text.slice(0,matches[0].index).trim()) return letter;
  const result={...letter};
  for(let i=0;i<matches.length;i++) {
    const content=text.slice(matches[i].end,matches[i+1]?.index ?? text.length).trim();
    if(!content) return letter;
    result[matches[i].key]=content;
  }
  return result;
}
