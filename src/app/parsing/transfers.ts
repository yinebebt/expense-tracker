import { Transaction } from '../models/transaction.model';

export const SELF_TRANSFER_WINDOW_MS = 10 * 60_000;

/** The sending bank may add its fee to the debit: BOA sends 6,000 and debits 6,012. */
const MAX_FEE_SHARE = 0.02;

/**
 * Finds transfers between the user's own accounts: a debit from one source and a
 * credit on another within the window, e.g. CBE to telebirr. The amounts match, or
 * the debit is larger by the sending bank's fee. Returns the ids of the sides that
 * still need marking. A side that is already a transfer (e.g. telebirr's "received
 * from Commercial Bank of Ethiopia", or a payee the user marked as their own account)
 * still pairs with its other half. Other rows the user categorized by hand, and
 * unknown rows, are left alone.
 *
 * A pair where both sides name a person is a payment and a payment back, not a move:
 * one side of a real move is unnamed or names the other bank.
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
  const noPerson = (t: Transaction) => !t.merchant || t.category === 'transfers';
  const credits = eligible.filter((t) => t.type === 'credit');
  const debits = eligible
    .filter((t) => t.type === 'debit')
    .sort((a, b) => a.occurredAt - b.occurredAt);
  const used = new Set<string>();
  const ids: string[] = [];

  // Exact amounts first, so a fee match never takes a credit an exact debit needs.
  for (const maxFeeShare of [0, MAX_FEE_SHARE]) {
    for (const d of debits) {
      if (used.has(d.id)) continue;
      let best: Transaction | undefined;
      for (const c of credits) {
        if (used.has(c.id) || c.source === d.source) continue;
        if (!noPerson(d) && !noPerson(c)) continue;
        const fee = d.amountMinor! - c.amountMinor!;
        if (fee < 0 || fee > c.amountMinor! * maxFeeShare) continue;
        const gap = Math.abs(c.occurredAt - d.occurredAt);
        if (gap <= windowMs && (!best || gap < Math.abs(best.occurredAt - d.occurredAt))) best = c;
      }
      if (best) {
        used.add(d.id).add(best.id);
        ids.push(...[d, best].filter(needsMark).map((t) => t.id));
      }
    }
  }
  return ids;
}

/**
 * Finds money sent to or received from another of the user's accounts at the same bank:
 * CBE "to account 1****4321" when another CBE SMS said "your account 1****4321". Rows
 * categorized by hand are left alone.
 */
export function findOwnAccountTransfers(txs: Transaction[]): string[] {
  const key = (source: string, account: string) => `${source}|${account}`;
  const own = new Set(txs.filter((t) => t.account).map((t) => key(t.source, t.account!)));
  return txs
    .filter(
      (t) =>
        t.type !== 'unknown' &&
        !t.categoryManual &&
        t.category !== 'transfers' &&
        t.counterAccount &&
        t.counterAccount !== t.account &&
        own.has(key(t.source, t.counterAccount)),
    )
    .map((t) => t.id);
}
