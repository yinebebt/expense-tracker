import { Transaction } from '../models/transaction.model';

export const SELF_TRANSFER_WINDOW_MS = 10 * 60_000;

/**
 * Finds transfers between the user's own accounts: a debit from one source and
 * a credit of the same amount on another source within the window, e.g. CBE to
 * telebirr. Returns the ids of the sides that still need marking. A side that is
 * already a transfer (e.g. telebirr's "received from Commercial Bank of Ethiopia",
 * or a payee the user marked as their own account) still pairs with its other half.
 * Other rows the user categorized by hand, and unknown rows, are left alone.
 */
export function findSelfTransfers(
  txs: Transaction[],
  windowMs = SELF_TRANSFER_WINDOW_MS,
): string[] {
  const eligible = txs.filter(
    (t) =>
      t.type !== 'unknown' &&
      t.amountMinor !== null &&
      (!t.categoryManual || t.category === 'transfers'),
  );
  const needsMark = (t: Transaction) => !t.categoryManual && t.category !== 'transfers';
  const credits = eligible.filter((t) => t.type === 'credit');
  const debits = eligible
    .filter((t) => t.type === 'debit')
    .sort((a, b) => a.occurredAt - b.occurredAt);
  const used = new Set<string>();
  const ids: string[] = [];

  for (const d of debits) {
    let best: Transaction | undefined;
    for (const c of credits) {
      if (used.has(c.id) || c.source === d.source || c.amountMinor !== d.amountMinor) continue;
      const gap = Math.abs(c.occurredAt - d.occurredAt);
      if (gap <= windowMs && (!best || gap < Math.abs(best.occurredAt - d.occurredAt))) best = c;
    }
    if (best) {
      used.add(best.id);
      ids.push(...[d, best].filter(needsMark).map((t) => t.id));
    }
  }
  return ids;
}
