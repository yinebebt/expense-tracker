import { Category, Transaction } from '../models/transaction.model';

/** Everything about one counterparty: a person or business the user paid or received from. */
export interface PayeeSummary {
  key: string;
  /** Name as it appears on the most recent transaction. */
  name: string;
  count: number;
  paidMinor: number;
  receivedMinor: number;
  /** Most common category across this payee's transactions. */
  category: Category | null;
}

/**
 * Names from different SMS differ in case, spacing and a trailing masked phone or account
 * number ("Abel Tesfaye 2517****8812"); this is what payees are grouped and ruled on.
 */
export const payeeKey = (name: string) =>
  name
    .replace(/\s*\(?\+?[\d*]{6,}\)?\s*$/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

/** Groups named transactions by payee, most frequent first. Unknown rows and rows without a name are left out. */
export function groupByPayee(txs: Transaction[]): PayeeSummary[] {
  const groups = new Map<string, PayeeSummary & { latest: number; cats: Map<Category, number> }>();
  for (const t of txs) {
    if (!t.merchant || t.type === 'unknown' || t.amountMinor === null) continue;
    const key = payeeKey(t.merchant);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        name: t.merchant,
        count: 0,
        paidMinor: 0,
        receivedMinor: 0,
        category: null,
        latest: 0,
        cats: new Map(),
      };
      groups.set(key, g);
    }
    g.count++;
    if (t.type === 'debit') g.paidMinor += t.amountMinor;
    else g.receivedMinor += t.amountMinor;
    if (t.category) g.cats.set(t.category, (g.cats.get(t.category) ?? 0) + 1);
    if (t.occurredAt >= g.latest) {
      g.latest = t.occurredAt;
      g.name = t.merchant;
    }
  }
  return [...groups.values()]
    .map(({ latest, cats, ...p }) => ({
      ...p,
      category: [...cats].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.count - a.count || b.paidMinor - a.paidMinor);
}

/**
 * The category a payee rule gives a transaction, or null when no rule applies.
 * Rules cover payments to the payee; money received from them stays Income
 * unless the rule says Transfers (own accounts) or Income.
 */
export function payeeRuleCategory(
  t: Pick<Transaction, 'merchant' | 'type'>,
  rules: ReadonlyMap<string, Category>,
): Category | null {
  if (!t.merchant || t.type === 'unknown') return null;
  const c = rules.get(payeeKey(t.merchant));
  if (!c) return null;
  if (t.type === 'credit' && c !== 'transfers' && c !== 'income') return null;
  return c;
}
