import { Category, Transaction } from '../models/transaction.model';

/** Local calendar range; `end` is exclusive. */
export interface DateRange {
  start: Date;
  end: Date;
}

export interface CategoryTotal {
  category: Category;
  amountMinor: number;
}

export interface DayTotal {
  day: Date;
  spentMinor: number;
}

export type WeekSummary = DateRange & { spent: number; days: DayTotal[] };

export interface DashboardSummary {
  today: DateRange;
  month: DateRange & {
    spent: number;
    received: number;
    byCategory: CategoryTotal[];
    /** Money moved between the user's own accounts; never counted as spent or received. */
    moved: { amountMinor: number; count: number };
  };
}

export function dayRange(now: Date): DateRange {
  const [y, m, d] = [now.getFullYear(), now.getMonth(), now.getDate()];
  return { start: new Date(y, m, d), end: new Date(y, m, d + 1) };
}

/** Monday to Sunday. */
export function weekRange(now: Date): DateRange {
  const sinceMonday = (now.getDay() + 6) % 7;
  const [y, m, d] = [now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday];
  return { start: new Date(y, m, d), end: new Date(y, m, d + 7) };
}

export function monthRange(now: Date): DateRange {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

/** Whether a row counts toward spending or income. Unknown rows and own-account transfers don't. */
export function isCounted(t: Transaction): boolean {
  return t.type !== 'unknown' && t.amountMinor !== null && t.category !== 'transfers';
}

const inRange = (t: Transaction, r: DateRange) =>
  t.occurredAt >= r.start.getTime() && t.occurredAt < r.end.getTime();

export function total(txs: Transaction[], type: 'debit' | 'credit', r: DateRange): number {
  return txs.reduce(
    (sum, t) => (t.type === type && isCounted(t) && inRange(t, r) ? sum + t.amountMinor! : sum),
    0,
  );
}

export function spendingByCategory(txs: Transaction[], r: DateRange): CategoryTotal[] {
  const totals = new Map<Category, number>();
  for (const t of txs) {
    if (t.type !== 'debit' || !isCounted(t) || !inRange(t, r)) continue;
    const c = t.category ?? 'other';
    totals.set(c, (totals.get(c) ?? 0) + t.amountMinor!);
  }
  return [...totals]
    .map(([category, amountMinor]) => ({ category, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

/** The debits that make up `total(txs, 'debit', r)`, in the order given. */
export function spentIn(txs: Transaction[], r: DateRange): Transaction[] {
  return txs.filter((t) => t.type === 'debit' && isCounted(t) && inRange(t, r));
}

/** Spending per day across a range, one entry per local calendar day. */
export function dailySpending(txs: Transaction[], r: DateRange): DayTotal[] {
  const days: DayTotal[] = [];
  for (
    let d = new Date(r.start);
    d < r.end;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  ) {
    days.push({ day: d, spentMinor: total(txs, 'debit', dayRange(d)) });
  }
  return days;
}

/** The Monday-to-Sunday week that holds `day`, with its spending per day. */
export function weekSummary(txs: Transaction[], day: Date): WeekSummary {
  const r = weekRange(day);
  return { ...r, spent: total(txs, 'debit', r), days: dailySpending(txs, r) };
}

/**
 * Money moved between own accounts. Both sides of a move are usually stored (the debit
 * at one bank, the credit at another), so the larger side stands for the amount moved
 * and the count is the number of moves, not rows.
 */
export function movedBetweenAccounts(
  txs: Transaction[],
  r: DateRange,
): { amountMinor: number; count: number } {
  const out = { debit: 0, credit: 0, debits: 0, credits: 0 };
  for (const t of txs) {
    if (t.category !== 'transfers' || t.amountMinor === null || !inRange(t, r)) continue;
    if (t.type === 'debit') {
      out.debit += t.amountMinor;
      out.debits++;
    } else if (t.type === 'credit') {
      out.credit += t.amountMinor;
      out.credits++;
    }
  }
  return { amountMinor: Math.max(out.debit, out.credit), count: Math.max(out.debits, out.credits) };
}

export function summarize(txs: Transaction[], now = new Date()): DashboardSummary {
  const month = monthRange(now);
  return {
    today: dayRange(now),
    month: {
      ...month,
      spent: total(txs, 'debit', month),
      received: total(txs, 'credit', month),
      byCategory: spendingByCategory(txs, month),
      moved: movedBetweenAccounts(txs, month),
    },
  };
}
