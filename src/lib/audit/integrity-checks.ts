/**
 * v1.0.105 (Ángela, DeForest 19 Nov): deterministic source-integrity checks
 * shown in the Audit as questions to confirm before filing. They never change
 * a source value, never block delivery and never decide which value is right.
 *
 * Calibrated on DeForest: they flag exactly Art Human (a value in the millions
 * with cents, unrelated to the narrative's MXN 2 million), Cinemex (value
 * versus a MXN 60.5 million exposure), the American Axle name variant and 4
 * partners declared in B2 versus 5 partner profiles. On Ramos they flag the
 * value with no currency. Approximate exchange rates are used only to decide
 * whether two amounts can describe the same figure, never to convert a value.
 */
const TO_USD: Record<string, number> = { USD: 1, MXN: 1 / 18, EUR: 1.08 };
const MAGNITUDE: Record<string, number> = { million: 1e6, millions: 1e6, millones: 1e6, billion: 1e9, billions: 1e9 };
const MONEY = /(?<![\w$])(US\$|USD|MXN|EUR|€|\$)?\s*(\d{1,3}(?:[,.]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*(millions?|millones|billions?)?(?![\w])/gi;

type Amount = { currency: string; value: number; raw: string };

function parseNumber(raw: string): number | null {
  let v = raw;
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(v)) v = v.replace(/,/g, '');
  else if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(v)) v = v.replace(/\./g, '').replace(',', '.');
  else if (v.includes(',') && !v.includes('.')) v = v.replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function moneyAmounts(text: string): Amount[] {
  const out: Amount[] = [];
  for (const m of String(text || '').matchAll(MONEY)) {
    const code = (m[1] || '').toUpperCase();
    const currency = ({ 'US$': 'USD', '€': 'EUR' } as Record<string, string>)[code] ?? code;
    if (!currency && !m[3]) continue;
    const n = parseNumber(m[2]);
    if (n === null) continue;
    out.push({ currency, value: n * (MAGNITUDE[(m[3] || '').toLowerCase()] || 1), raw: m[0].trim() });
  }
  return out;
}

const label = (m: any) => String(m.client || m.name || m.title || 'Asunto').trim();

export function integrityChecks(data: any, matters: any[] = []): string[] {
  const checks: string[] = [];
  const lawyers = Array.isArray(data?.lawyers) ? data.lawyers : [];
  const declared = Number(String(data?.numPartners ?? '').trim());
  const partners = lawyers.filter((l: any) => l?.isPartner === true || /^partner$/i.test(String(l?.role || '')));
  if (String(data?.numPartners ?? '').trim() && Number.isFinite(declared) && partners.length && declared !== partners.length)
    checks.push(`B2 declara ${declared} socios, pero los perfiles de B9 identifican ${partners.length} como Partner (${partners.map((l: any) => l.name).join(', ')}). Confirma la cifra o el cargo antes de presentar.`);
  const core = new Set<string>(data?.canonical_matter_selection?.core_matter_ids || []);
  const selected = matters.filter((m: any) => !core.size || core.has(m.id));
  for (const m of selected) {
    const rawValue = String(m.value || '').split(/:\s*/).slice(-1)[0].trim();
    // Mixed or irregular separators («300.000.000.00», «11.775,193.22»,
    // «172,37,026.00») can be read as different figures: ask, check nothing else.
    const irregular = (rawValue.match(/\d[\d.,]*\d/g) || []).filter(n => /[.,]/.test(n)
      && !/^\d{1,3}(?:,\d{3})*(?:\.\d+)?$/.test(n) && !/^\d{1,3}(?:\.\d{3})*(?:,\d+)?$/.test(n) && !/^\d+[.,]\d+$/.test(n));
    if (irregular.length) {
      checks.push(`El valor de ${label(m)} («${rawValue}») tiene un formato numérico ambiguo (${irregular.join(', ')}). Confirma la cifra exacta antes de presentar.`);
      continue;
    }
    const values = moneyAmounts(rawValue);
    const narrative = String(m.summary || m.rawNotes || '');
    if (rawValue && /(?<![A-Z])\$\s*\d/.test(rawValue) && !/\b(?:US\$|USD|MXN|EUR|pesos|d[oó]lares)\b/i.test(rawValue))
    {
      // v1.0.114: ask with the context the same matter already gives.
      const context = moneyAmounts(narrative).filter(a => TO_USD[a.currency] && a.value >= 1000).slice(0, 2);
      checks.push(context.length
        ? `El valor de ${label(m)} («${rawValue}») no indica la moneda, y su narrativa menciona ${context.map(a => a.raw).join(' y ')}. Confirma si el valor está en ${context[0].currency} y es esa cuantía exacta, o si corresponde a otro concepto.`
        : `El valor de ${label(m)} («${rawValue}») no indica la moneda. Confírmala antes de presentar.`);
    }
    // A value stated in two currencies (e.g. "MXN 11,775,193.22 (Approx USD
    // 65,353,319.98)") must describe the same figure: Ramos Real Estate.
    const priced = values.filter(v => TO_USD[v.currency]);
    if (priced.length >= 2 && priced[0].currency !== priced[1].currency) {
      const ratio = (priced[0].value * TO_USD[priced[0].currency]) / (priced[1].value * TO_USD[priced[1].currency]);
      if (ratio < 0.5 || ratio > 2)
        checks.push(`El valor de ${label(m)} («${rawValue}») expresa en dos monedas importes que no equivalen entre sí. Verifica cuál es la cifra correcta.`);
    }
    if (values.length === 1 && TO_USD[values[0].currency]) {
      const v = values[0];
      const reasons: string[] = [];
      if (v.value >= 1e6 && /[.,](?!00\b)\d{2}\b/.test(v.raw) && !/approx/i.test(rawValue)) reasons.push('es un importe de millones con centavos');
      const usd = v.value * TO_USD[v.currency];
      const narrated = moneyAmounts(narrative).filter(a => TO_USD[a.currency] && a.value >= 1000);
      if (narrated.length && !narrated.some(a => { const r = a.value * TO_USD[a.currency] / usd; return r >= 0.5 && r <= 2; }))
        reasons.push(`no corresponde a ninguna cuantía de su narrativa (${narrated.slice(0, 2).map(a => a.raw).join(', ')})`);
      if (reasons.length)
        checks.push(`El valor declarado de ${label(m)} («${rawValue}») ${reasons.join(' y ')}. Verifica la cifra y su moneda contra la fuente y confirma qué representa (valor del asunto, exposición, multa u otro concepto).`);
    }
    const core = label(m).replace(/[,.\s]*\b(?:S\.?\s?A\.?(?:\s*(?:de|DE)\s*C\.?\s?V\.?)?|S\.?\s?C\.?|S\.?\s?de\s?R\.?\s?L\.?(?:\s*de\s*C\.?\s?V\.?)?|Inc\.?|LLC|Ltd\.?|SpA)\s*\.?$/i, '').replace(/[\s.,]+$/, '');
    const words = label(m).split(/\s+/);
    if (words.length >= 2 && words[0].length >= 4) {
      const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const variant = new RegExp(`\\b${escape(words[0])}\\s+${escape(words[1])}(?:\\s+[A-Z&][\\w&.-]*){1,3}`).exec(narrative)?.[0];
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
      // The register name followed by the next sentence («… S.A. DE C.V. Is») is not a variant.
      if (variant && norm(variant) !== norm(label(m)) && !norm(label(m)).startsWith(norm(variant)) && !norm(variant).startsWith(norm(label(m))) && !norm(variant).startsWith(norm(core) + '.') && norm(variant) !== norm(core))
        checks.push(`${label(m)} aparece en la fuente también como «${variant.replace(/\s+/g, ' ').trim()}». Confirma la denominación que debe usarse de forma uniforme.`);
    }
  }
  return checks;
}
