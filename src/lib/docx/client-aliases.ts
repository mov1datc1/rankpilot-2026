import { sanitizeClientName } from '../audit/extraction-auditor';

/** Conservative name variants derived from supplied identities, never an external client dictionary. */
export function clientAliases(names: string[]): string[] {
  const aliases = new Set<string>();
  const generic = /^(grupo|group|private|confidential|client|cliente|empresa|company|corporation|new|nueva|the|manufacturing|manufactura|services|servicios|industries|industria|logistics|logística|instituto|institute|sociedad|asociación|asociacion|fundación|fundacion|banco|bank|fondo|asociados|associates|transportes|semillas|familia|villas|jalisco|guadalajara|zapopan|tlajomulco|durango|m[eé]xico)$/i;
  for (const value of names) {
    const raw = String(value || '').trim();
    // Client fields can contain an entire company profile. Descriptive prose
    // and locations are not additional identities or aliases of that client.
    if (/^(?:it is (?:a|an)|a (?:global|leading|major) (?:company|leader))\b/i.test(raw)) continue;
    const name = sanitizeClientName(raw).cleanClient.replace(/\s*\(https?:\/\/[^)]*\)\s*/gi, ' ').trim();
    if (name.length < 2) continue;
    aliases.add(name);
    for (const match of name.matchAll(/\(([\p{L}\p{N}][\p{L}\p{N}. -]{1,60})\)/gu)) {
      const alias = match[1].trim();
      if (!/^(?:wealthy family|private owner|located|company|empresa|familia)\b/i.test(alias)) aliases.add(alias);
    }
    for (const entity of name.split(/\s+and\s+|\s+&\s+|,\s+(?!S\.?A\.?\b|S\.?\b)/i)) {
      const trimmedEntity = entity.trim();
      if (trimmedEntity.length >= 2 && !generic.test(trimmedEntity)) aliases.add(trimmedEntity);
      const first = trimmedEntity.match(/^[\p{L}\p{N}]+/u)?.[0];
      const tail = first ? trimmedEntity.slice(first.length).trim() : '';
      const companyQualifier = /^(?:de\b|m[eé]xico\b|industrial\b|manufacturing\b|international\b|services\b|s\.?a\b|s\.?p\.?a\b)/i.test(tail);
      const acronym = Boolean(first && first.length >= 3 && /[A-Z].*[A-Z]/.test(first));
      if (first && !generic.test(first) && (acronym || (first.length >= 5 && companyQualifier))) aliases.add(first);
    }
  }
  return [...aliases].sort((a,b)=>b.length-a.length);
}
