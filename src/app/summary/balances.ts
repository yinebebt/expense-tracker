import { Transaction } from '../models/transaction.model';
import { formatAccount } from '../parsing/accounts';

export interface AccountBalance {
  /** See AccountNames.of(). */
  name: string;
  balanceMinor: number;
  /** When the balance was reported (SMS time) or typed in. */
  at: number;
  /** True when the user typed it in rather than an SMS reporting it. */
  manual: boolean;
}

export interface AccountNames {
  /**
   * The bank, or the bank and account ("CBE 1…6789") when the bank has more than one.
   * Null when it has more than one and the row doesn't say which.
   */
  of(source: string, account: string | null): string | null;
  /** Whether a name is one of several accounts at a bank, e.g. "CBE 1…6789". */
  isAccount(name: string): boolean;
}

export function accountNames(txs: Transaction[]): AccountNames {
  const bySource = new Map<string, Set<string>>();
  for (const t of txs) {
    if (t.account) bySource.set(t.source, (bySource.get(t.source) ?? new Set()).add(t.account));
  }
  const several = [...bySource].filter(([, accs]) => accs.size > 1);
  const named = new Set(
    several.flatMap(([source, accs]) => [...accs].map((a) => `${source} ${formatAccount(a)}`)),
  );
  const split = new Set(several.map(([source]) => source));
  return {
    of: (source, account) => {
      if (!split.has(source)) return source;
      return account ? `${source} ${formatAccount(account)}` : null;
    },
    isAccount: (name) => named.has(name),
  };
}

/**
 * The latest known balance of each account: the newest SMS that reported one, unless a
 * balance typed in by hand is newer. Accounts with neither are left out. Newest first.
 * Once a bank has several accounts, a balance that doesn't say which is left out too.
 */
export function accountBalances(
  txs: Transaction[],
  manual: ReadonlyMap<string, { balanceMinor: number; at: number }>,
): AccountBalance[] {
  const names = accountNames(txs);
  const latest = new Map<string, AccountBalance>();
  for (const t of txs) {
    const name = names.of(t.source, t.account);
    if (t.balanceMinor === null || name === null) continue;
    const seen = latest.get(name);
    if (!seen || t.occurredAt > seen.at) {
      latest.set(name, { name, balanceMinor: t.balanceMinor, at: t.occurredAt, manual: false });
    }
  }
  for (const [name, m] of manual) {
    if (names.of(name, null) === null) continue;
    const seen = latest.get(name);
    if (!seen || m.at >= seen.at) latest.set(name, { name, ...m, manual: true });
  }
  return [...latest.values()].sort((a, b) => b.at - a.at);
}
