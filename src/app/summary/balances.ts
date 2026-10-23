import { Transaction } from '../models/transaction.model';

export interface AccountBalance {
  source: string;
  balanceMinor: number;
  /** When the balance was reported (SMS time) or typed in. */
  at: number;
  /** True when the user typed it in rather than an SMS reporting it. */
  manual: boolean;
}

/**
 * The latest known balance of each account: the newest SMS that reported one, unless a
 * balance typed in by hand is newer. Accounts with neither are left out. Newest first.
 */
export function accountBalances(
  txs: Transaction[],
  manual: ReadonlyMap<string, { balanceMinor: number; at: number }>,
): AccountBalance[] {
  const latest = new Map<string, AccountBalance>();
  for (const t of txs) {
    if (t.balanceMinor === null) continue;
    const seen = latest.get(t.source);
    if (!seen || t.occurredAt > seen.at) {
      latest.set(t.source, {
        source: t.source,
        balanceMinor: t.balanceMinor,
        at: t.occurredAt,
        manual: false,
      });
    }
  }
  for (const [source, m] of manual) {
    const seen = latest.get(source);
    if (!seen || m.at >= seen.at) latest.set(source, { source, ...m, manual: true });
  }
  return [...latest.values()].sort((a, b) => b.at - a.at);
}
