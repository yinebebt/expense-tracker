/** Parses "1,234.5" into 123450. Returns null for anything that isn't a plain positive amount. */
export function parseAmountMinor(text: string): number | null {
  const s = text.replace(/,/g, '').trim();
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const minor = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function formatMinor(minor: number, currency = 'ETB'): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const cents = String(abs % 100).padStart(2, '0');
  return `${sign}${currency} ${whole}.${cents}`;
}
