/**
 * Safe Content-Disposition Header Formatter
 * 
 * Complies with RFC 5987 / RFC 6266 and WHATWG ByteString restrictions.
 * Prevents: "Cannot convert argument to a ByteString because the character at index X has a value of Y which is greater than 255."
 */

export function buildSafeContentDisposition(prefix: string, rawPractice: string, ext = 'docx'): string {
  // 1. Sanitize the practice area text (max 50 chars, single-line, no question marks)
  let cleanPractice = (rawPractice || 'General_Practice').trim();
  if (cleanPractice.length > 50 || cleanPractice.includes('\n') || cleanPractice.includes('?')) {
    cleanPractice = cleanPractice.split(/[\n\r?:]/)[0].trim().slice(0, 45) || 'General_Practice';
  }

  const baseFilename = `RankPilot_${prefix}_${cleanPractice.replace(/\s+/g, '_')}.${ext}`;

  // 2. ASCII-safe fallback (remove accents, strip any non-ASCII characters)
  const asciiSafeName = baseFilename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^\x20-\x7E]/g, '_')    // replace any code point > 127 with underscore
    .replace(/["\\/;]/g, '_');        // replace header control chars

  // 3. RFC 5987 / RFC 6266 UTF-8 encoded filename for modern browsers
  const utf8EncodedName = encodeURIComponent(baseFilename);

  return `attachment; filename="${asciiSafeName}"; filename*=UTF-8''${utf8EncodedName}`;
}
