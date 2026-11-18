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
/** v1.0.100 (DeForest 18-11): the B10 named Raymundo's former employer while
 * the renderer replaced it with "a confidential entity", because the same
 * company is also a confidential matter client; the judge rejected it on every
 * pass. A department sentence keeps that entity only when the sentence itself
 * is the lawyer's career statement: it names that lawyer and a career marker,
 * and it describes no firm work for the entity. Any other occurrence (client
 * work, D, E) is anonymized exactly as before. */
const CAREER_MARKER=/\b(?:years?|decades?|career|former(?:ly)?|previous(?:ly)?|prior|before joining|served|tenure|general legal director|legal director|general counsel|in-house)\b/i;
const FIRM_WORK=/\b(?:advis\w*|represent\w*|retain\w*|engag\w*|instruct\w*|act(?:s|ed|ing)? for|on behalf of|mandate|matter|client)\b/i;
export function departmentCareerMentions(text: string, lawyers: {name?: string; career?: CareerMention[]}[] = []): CareerMention[] {
  const sentences=String(text || '').split(/(?<=[.!?])\s+|\n+/).map(s=>s.trim()).filter(Boolean);
  return lawyers.flatMap(lawyer => {
    const name=norm(lawyer.name), surname=name.split(' ').filter(t=>t.length>2).slice(1).join(' ');
    return (lawyer.career || []).flatMap(({entity}) => sentences.filter(sentence =>
      (sentence.includes(name) || (!!surname && sentence.includes(surname)))
      && sentence.split(entity).length===2 && CAREER_MARKER.test(sentence) && !FIRM_WORK.test(sentence)
      && String(text).split(sentence).length===2).map(quote=>({entity,quote})));
  });
}

/** Clients named only in a lawyer's source profile (no matter in the register,
 * so no confirmed publication) are anonymized in public B9/B10/C2 like any
 * other unconfirmed client: `editorial_development.py` requires confirmed
 * permission for a bio-only client name, and the final review enforces it.
 * A client whose own matter is confirmed publishable keeps its name. */
export function bioOnlyClientNames(development: any, publishableClients: string[] = []): string[] {
  const publishable=new Set(publishableClients.map(identity).filter(Boolean));
  const names=(development?.candidates || []).flatMap((candidate: any) => (candidate.profile_coverage || [])
    .filter((item: any) => item.relationship==='client')
    .map((item: any) => norm(item.entity_name)));
  return [...new Set<string>(names.filter((name: string) => name.length>=3 && !publishable.has(identity(name))))];
}

export function withoutCareerMentions(text: string, mentions: CareerMention[]): string {
  return transformOutsideCareerMentions(text,mentions,s=>s,()=> '');
}
