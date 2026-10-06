/** Conservative name variants derived from supplied identities, never an external client dictionary. */
export function clientAliases(names: string[]): string[] {
  const aliases = new Set<string>();
  const generic = /^(grupo|group|private|confidential|client|cliente|empresa|company|corporation|new|nueva|the)$/i;
  for (const value of names) {
    const name = String(value || '').trim();
    if (name.length < 2) continue;
    aliases.add(name);
    for (const match of name.matchAll(/\(([^()]+)\)/g)) if (match[1].trim().length >= 2) aliases.add(match[1].trim());
    for (const entity of name.split(/\s+and\s+|\s+&\s+|,\s+(?!S\.?A\b)/i)) {
      if (entity.trim().length >= 2) aliases.add(entity.trim());
      const first = entity.trim().match(/^[\p{L}\p{N}]+/u)?.[0];
      const tail = first ? entity.trim().slice(first.length).trim() : '';
      const companyQualifier = /^(?:de\b|m[eé]xico\b|industrial\b|manufacturing\b|international\b|services\b|s\.?a\b|s\.?p\.?a\b)/i.test(tail);
      const acronym = Boolean(first && first.length >= 3 && /[A-Z].*[A-Z]/.test(first));
      if (first && !generic.test(first) && (acronym || (first.length >= 5 && companyQualifier))) aliases.add(first);
    }
  }
  return [...aliases].sort((a,b)=>b.length-a.length);
}
