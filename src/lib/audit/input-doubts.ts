/**
 * v1.0.119 (Jonathan, 25 Nov): what the application understood from the input
 * is said before the case runs, so the user corrects the register once instead
 * of a reviewer finding the consequence after the money is spent.
 *
 * Each line corresponds to a family of late findings in stored real runs: a
 * co-led mandate written as led by one person, a lead partner with no profile
 * who became an unplanned internal evaluation, a profile with no mandate behind
 * it, a "client" that was a sentence of a court filing, one of several heads
 * presented as the only head.
 *
 * It reads structured cells only, exactly as ai-engine/core/fact_sheet.py does
 * (listed_names, roster_match): the two must stay equal, and the contract test
 * uses the same examples. Nothing here changes a source, blocks generation or
 * decides which reading is right.
 */
export type InputDoubt = { kind: 'doubt' | 'check'; text: string };

const fold = (value: unknown) => (String(value ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().match(/[\p{L}\p{N}_]+/gu) || []).join(' ');
const HEADING = /^\s*(?:(?:other\s+)?team\s+members?|lead partners?|lead lawyers?|socios? responsables?)\s*[:(s)]*\s*/i;
const EMPTY = new Set(['not applicable', 'sin informacion', 'n a', 'not stated', 'none', 'no aplica']);
const trimName = (value: string) => value.replace(/^[ .\t]+|[ .\t]+$/g, '');

/** Names in a structured role cell. Titles in parentheses are not names. */
export function listedNames(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.flatMap(listedNames))];
  const raw = String(value ?? '').replace(HEADING, '').replace(/\([^()]*\)/g, ' ');
  const names: string[] = [];
  for (const part of raw.split(/\s+(?:and|y|&)\s+|[;\n/]|,\s*/)) {
    const name = trimName(trimName(part.trim()).replace(/^(?:and|y|&)\s+/i, ''));
    const words = fold(name).split(' ').filter(Boolean).length;
    if (words >= 2 && words <= 7 && !EMPTY.has(fold(name)) && !names.includes(name)) names.push(name);
  }
  return names;
}

/** The roster lawyer a cell names: the same name, or the only one that contains it. */
export function rosterMatch(name: string, roster: string[]): string | null {
  const key = fold(name);
  if (roster.includes(key)) return key;
  const words = key.split(' ').filter(Boolean);
  const found = roster.filter(person => words.length >= 2 && words.every(word => person.split(' ').includes(word)));
  return found.length === 1 ? found[0] : null;
}

const label = (matter: any) => String(matter?.client || matter?.name || matter?.title || 'Asunto').replace(/\s+/g, ' ').trim();
const short = (text: string, max = 70) => text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
const listed = (items: string[], max = 6) => items.slice(0, max).join('; ') + (items.length > max ? ` y ${items.length - max} más` : '');

/** A client cell that holds a sentence, not a name (a filing's opening line read as a matter). */
export function clientLooksLikeText(client: unknown): boolean {
  const text = String(client ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  // A numbered heading («I: …», «2) …», «3. …»); an initial with a period («J. Example & Sons») is a name.
  return /^(?:(?:[IVXLC]{1,5}|\d{1,2})\s*[:)]|\d{1,2}\.)\s+\S/.test(text) && text.split(' ').length >= 4
    || /\b(?:comparece|solicita|promueve|expone|whereas|hereby|respectfully)\b/i.test(text)
    || text.split(' ').length > 14;
}

export function inputDoubts(input: { lawyers?: any[]; matters?: any[]; departmentHeads?: any[] }): InputDoubt[] {
  const matters = input.matters || [], doubts: InputDoubt[] = [];
  const fragments = matters.filter(m => clientLooksLikeText(m?.client));
  if (fragments.length)
    doubts.push({ kind: 'doubt', text: `${fragments.length} asunto(s) tienen como cliente un fragmento de texto y no un nombre (${listed(fragments.map(m => `«${short(label(m))}»`))}). Suele ser un documento de respaldo leído como asunto: corrige el nombre del cliente o descarta el asunto antes de preparar.` });

  const profiles = (input.lawyers || []).map(l => String(l?.name || l?.fullName || '').trim()).filter(name => fold(name).split(' ').length >= 2);
  const roster = profiles.map(fold);
  const roles = matters.map(m => ({ matter: m, lead: listedNames(m?.leadPartner || m?.lead_partner), team: listedNames(m?.teamMembers || m?.team_members) }));
  const anyRole = roles.some(r => r.lead.length || r.team.length);

  const shared = roles.filter(r => r.lead.length > 1);
  if (shared.length)
    doubts.push({ kind: 'check', text: `${shared.length} asunto(s) nombran a más de un socio responsable (${listed(shared.map(r => `${short(label(r.matter), 40)}: ${r.lead.join(' y ')}`))}). Se redactarán como codirigidos por esas personas, nunca como liderados por una sola. Si alguno lo dirige una sola persona, deja solo su nombre en «socio responsable».` });

  if (anyRole) {
    const unassigned = roles.filter(r => !r.lead.length && !clientLooksLikeText(r.matter?.client));
    if (unassigned.length)
      doubts.push({ kind: 'doubt', text: `${unassigned.length} asunto(s) no indican socio responsable (${listed(unassigned.map(r => short(label(r.matter), 40)))}): nadie podrá atribuírselos en su B9. Añade el responsable si la fuente lo permite.` });
  }

  if (roster.length && anyRole) {
    const outside = [...new Set(roles.flatMap(r => r.lead).filter(name => !rosterMatch(name, roster)))];
    if (outside.length)
      doubts.push({ kind: 'doubt', text: `Los asuntos nombran como socio responsable a ${outside.length} persona(s) sin perfil en B9 (${listed(outside)}). No tendrán biografía ni candidatura individual. Añade su perfil o confirma que no se presentan.` });
    const present = new Set(roles.flatMap(r => [...r.lead, ...r.team]).map(name => rosterMatch(name, roster)).filter(Boolean));
    const idle = profiles.filter(name => !present.has(fold(name)));
    if (idle.length)
      doubts.push({ kind: 'doubt', text: `${idle.length} abogado(s) con perfil no figuran como responsables ni como equipo en ningún asunto (${listed(idle)}). Su B9 se redactará sin trabajo que lo respalde: añádelos al asunto que corresponda o confirma que es correcto.` });
  }

  const heads = [...new Set((input.departmentHeads || []).map(h => String(h?.name || '').replace(/\s+/g, ' ').trim()).filter(name => fold(name).length > 2 && !EMPTY.has(fold(name))))];
  // A head named with fewer words than a known lawyer («Sofia Vega» / «Sofia Vega Ruiz»):
  // the engine does not assume they are the same person (fact_sheet.department_heads).
  const known = [...new Set([...profiles, ...roles.flatMap(r => r.lead)])];
  for (const head of heads) {
    const words = fold(head).split(' ');
    if (known.some(name => fold(name) === fold(head))) continue;
    const longer = known.filter(name => { const other = fold(name).split(' '); return other.length > words.length && words.every(word => other.includes(word)); });
    if (longer.length)
      doubts.push({ kind: 'doubt', text: `El formulario nombra como jefe de departamento a «${head}» y los asuntos o perfiles nombran a ${longer.join(' / ')}. RankPilot no da por hecho que sean la misma persona: escribe el nombre completo del jefe en los datos del departamento. Sin esa confirmación, B10 y C2 no dirán que esa persona dirige el departamento.` });
  }
  if (heads.length > 1)
    doubts.push({ kind: 'check', text: `El formulario nombra ${heads.length} jefes de departamento (${heads.join(', ')}). Cada uno se presentará como uno de los jefes, no como el único. Corrige la lista si la jefatura es de una sola persona.` });
  return doubts;
}
