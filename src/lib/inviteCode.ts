/** Codes have 6 characters from this alphabet (no 0/O, 1/I/L). */
const CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export const isValidCode = (code: string) => CODE_RE.test(code);

/**
 * Code from a typed code, a petapp://convite/CODE link or a shared message containing one.
 * Returns null unless a whole 6-character code is present (text is never cut down to fit).
 */
export function codeFromText(text: string): string | null {
  const link = text.match(/convite\/([A-Za-z0-9]{6})(?![A-Za-z0-9])/);
  if (link) return isValidCode(link[1].toUpperCase()) ? link[1].toUpperCase() : null;
  const whole = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (whole.length === 6) return isValidCode(whole) ? whole : null;
  const tokens = (text.match(/(?<![A-Za-z0-9])[A-Za-z0-9]{6}(?![A-Za-z0-9])/g) ?? [])
    .map((t) => t.toUpperCase())
    .filter(isValidCode);
  return tokens.length === 1 ? tokens[0] : null;
}

export const inviteLink = (code: string) => `petapp://convite/${code}`;
