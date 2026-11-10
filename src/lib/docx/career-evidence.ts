/** Bound career mentions, never a global client-name allowlist.
 * The source-to-field review still determines whether the relationship is true.
 */
export type CareerMention = { quote: string; entity: string };
const norm = (v: unknown) => String(v || '').normalize('NFC').replace(/\s+/g, ' ').trim();
const identity = (v: unknown) => norm(v).toLocaleLowerCase();

export function careerMentions(person: any, candidate: any): CareerMention[] {
  if (!candidate || identity(person?.name || person?.fullName) !== identity(candidate.name)) return [];
  const originals = ['bio','comments','standout_work','standoutWork','credentials','professional_roles'].map(k => norm(person[k]));
  return (candidate.profile_coverage || []).flatMap((item: any) => {
    const entity=String(item.entity_name || ''), quote=String(item.public_quote || ''), source=norm(item.source_quote);
    if (item.decision !== 'retain' || item.privacy_basis || !['former_employer','professional_association'].includes(item.relationship)
      || !entity || !quote || !source || !originals.some(s => s.includes(source))
      || !source.includes(norm(entity)) || !quote.includes(entity) || !String(candidate.submission_bio || '').includes(quote)) return [];
    // Multiple occurrences would make the career vs mandate mention ambiguous.
    if (quote.split(entity).length !== 2) return [];
    return [{entity,quote}];
  });
}

export function transformOutsideCareerMentions(text: string, mentions: CareerMention[], transform: (s: string) => string, protectedTransform: (s: string) => string = s=>s): string {
  const spans=mentions.flatMap(({quote,entity}) => {
    const start=text.indexOf(quote);
    if (start<0 || text.indexOf(quote,start+1)>=0 || quote.split(entity).length!==2) return [];
    const at=start+quote.indexOf(entity);
    return [{start:at,end:at+entity.length}];
  }).sort((a,b)=>a.start-b.start);
  let cursor=0, result='';
  for (const span of spans) {
    if (span.start<cursor) continue;
    result+=transform(text.slice(cursor,span.start))+protectedTransform(text.slice(span.start,span.end));cursor=span.end;
  }
  return result+transform(text.slice(cursor));
}

/** For the name-only integrity detector, mask just the bound career occurrence.
 * The same identity elsewhere (client work, B10, C2, D) remains detectable.
 */
export function withoutCareerMentions(text: string, mentions: CareerMention[]): string {
  return transformOutsideCareerMentions(text,mentions,s=>s,()=> '');
}
