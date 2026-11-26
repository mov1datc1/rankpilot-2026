import { createHash } from 'node:crypto';
import { identity, isPlaceholder } from './placeholder';
export { identity, isPlaceholder } from './placeholder';

/** v1.0.121: the case register (ai-engine/core/case_register.py) is read once,
 * before a new generation, and saved in chambersData.case_register. Every role,
 * the fact sheet and the Word renderer then use the same reading of who is who:
 * client names and the other names a source uses for them, leads and team,
 * titles as written, closing dates and explicit restrictions on public use. */
export const CASE_REGISTER_VERSION = 'case-register-v1';

const MATTER_FIELDS = ['id','client','clientName','leadPartner','lead_partner','teamMembers','team_members','completionDate',
  'rawNotes','summary','source_excerpt','original_code_extraction','extraction_evidence'];

/** What the register is read from. A change here means the register is stale. */
export function registerSourceHash(data: any): string {
  const source = {
    version: CASE_REGISTER_VERSION,
    firm: data?.firm_name || data?.firmName || '',
    period: data?.research_period || null,
    b10: data?.confirmed_source_b10 ?? data?.original_b10 ?? '',
    heads: (data?.departmentHeads || data?.department?.department_heads || []).map((h: any) => h?.name || ''),
    lawyers: (data?.lawyers || []).map((l: any) => ({name: l?.name || l?.fullName || '', role: l?.role || l?.title || ''})),
    matters: (data?.matters || []).map((m: any) => Object.fromEntries(MATTER_FIELDS.map(k => [k, m?.[k] ?? null]))),
  };
  return createHash('sha256').update(JSON.stringify(source)).digest('hex');
}

export function registerFresh(data: any): boolean {
  const register = data?.case_register;
  return register?.version === CASE_REGISTER_VERSION && register?.source_hash === registerSourceHash(data);
}

/** Matters with placeholder lead/team answers ("na") replaced by the register's
 * reading, or, for a case saved before the register existed, by the original form
 * cell; otherwise left blank. A placeholder is never printed. A value the user
 * confirmed with a real name is never changed. */
export function applyRegister(matters: any[], register: any): any[] {
  if (!Array.isArray(matters)) return matters;
  const valid = register?.version === CASE_REGISTER_VERSION;
  return matters.map((matter: any) => {
    const facts = valid ? register.matters?.[matter?.id] : null;
    let copy = matter;
    for (const [field, snake, people] of [['leadPartner','lead_partner',facts?.leads],['teamMembers','team_members',facts?.team]] as const) {
      if (!matter || !isPlaceholder(matter[field] ?? matter[snake]) || (matter[field] ?? matter[snake]) === undefined) continue;
      const fromRegister = Array.isArray(people) && people.length ? people.map((p: any) => p.name).join('; ') : '';
      const cell = String(matter.original_code_extraction?.[field] || '');
      copy = {...copy, [field]: fromRegister || (isPlaceholder(cell) ? '' : cell), [snake]: fromRegister || (isPlaceholder(cell) ? '' : cell)};
    }
    return copy;
  });
}

/** Contact rows never print a placeholder ("Na", "NA") as an email or telephone. */
export function withoutPlaceholderContacts(rows: any[]): any[] {
  return (Array.isArray(rows) ? rows : []).map((row: any) => row && typeof row === 'object'
    ? {...row, ...Object.fromEntries(['name','email','phone'].map(k => [k, isPlaceholder(row[k]) ? '' : row[k]]))}
    : row);
}

/** The register's names for clients that are not publishable: its exact name and
 * every other proper name the sources use for it (a trading or subsidiary name in
 * the narrative), so the Word anonymises all of them, never a word of a description. */
export function registerConfidentialNames(data: any, isPublishable: (matter: any) => boolean): string[] {
  const register = data?.case_register;
  if (register?.version !== CASE_REGISTER_VERSION) return [];
  const names: string[] = [];
  for (const matter of data?.matters || []) {
    const client = register.clients?.[matter?.id];
    if (!client || isPublishable(matter)) continue;
    for (const name of [client.name, ...(client.other_names || [])]) if (String(name || '').trim().length >= 2) names.push(String(name).trim());
  }
  return [...new Set(names)];
}

/** chambersData and submission as the renderer should read them. */
export function renderingInputs(chambersData: any, submission?: any) {
  const register = chambersData?.case_register;
  const data = {...(chambersData || {}),
    matters: applyRegister(chambersData?.matters, register),
    contacts: withoutPlaceholderContacts(chambersData?.contacts),
    departmentHeads: withoutPlaceholderContacts(chambersData?.departmentHeads),
    ...(chambersData?.department ? {department: {...chambersData.department, department_heads: withoutPlaceholderContacts(chambersData.department.department_heads)}} : {})};
  const sub = submission && Array.isArray(submission.matters) ? {...submission, matters: applyRegister(submission.matters, register)} : submission;
  return {data, submission: sub};
}
