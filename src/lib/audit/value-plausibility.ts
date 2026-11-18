/** v1.0.100 (DeForest 18-11): Art Human declared "US$ 104,000,000.45" for an
 * inspection-defence mandate whose only other figure is an exposure of about
 * MXN 2 million. The value is source data, so RankPilot never corrects it; it
 * warns before filing when the declared value is out of all proportion to
 * every other amount of the same matter. Rough rates only order magnitudes. */
const TO_USD: Record<string, number> = {usd: 1, 'us$': 1, $: 1, mxn: 1 / 17, eur: 1.1, '€': 1.1};
const SCALE: Record<string, number> = {million: 1e6, millones: 1e6, m: 1e6, billion: 1e9, bn: 1e9};
const AMOUNT = /(US\$|USD|MXN|EUR|€|\$)\s?(\d[\d,]*(?:\.\d+)?)(?:\s*(million|millones|billion|bn|m)\b)?/gi;
export const IMPLAUSIBLE_VALUE_RATIO = 50;

function amounts(text: string): number[] {
  return [...String(text || '').matchAll(AMOUNT)].map(([, currency, digits, scale]) =>
    Number(digits.replace(/,/g, '')) * (SCALE[String(scale || '').toLowerCase()] || 1) * (TO_USD[currency.toLowerCase()] ?? 1))
    .filter(n => Number.isFinite(n) && n > 0);
}

export function implausibleValueWarnings(matters: any[] = []): string[] {
  return matters.flatMap(matter => {
    const value = Math.max(0, ...amounts(String(matter?.value || '')));
    if (value < 1e6) return [];
    const others = amounts(['source_excerpt', 'rawNotes', 'otherInfo', 'summary'].map(k => String(matter?.[k] || '')).join(' '))
      .filter(n => Math.abs(n - value) > value * 0.01);
    if (!others.length) return [];
    const largest = Math.max(...others);
    if (value <= largest * IMPLAUSIBLE_VALUE_RATIO) return [];
    const client = String(matter?.client || matter?.name || 'Un asunto');
    return [`${client}: el valor declarado (${String(matter.value).trim()}) es más de ${IMPLAUSIBLE_VALUE_RATIO} veces mayor que cualquier otra cifra del mismo asunto. Confírmalo con la firma antes de presentar; puede ser una errata del original.`];
  });
}
