export const DAY = 86_400_000;

/** "2026-10-23T08:05" in local time, the value a datetime-local input takes. */
export function localInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2026-10-23" in local time, the value a date input takes. */
export function localDateValue(ms: number): string {
  return localInputValue(ms).slice(0, 10);
}

/** Midnight, local time, `days` ago (0 = today). */
export function daysAgo(days: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.getTime();
}
