import { Category, Transaction } from '../models/transaction.model';
import { groupByPayee, payeeKey, payeeRuleCategory } from './payees';

let n = 0;
const tx = (
  merchant: string | null,
  amountMinor: number,
  p: Partial<Transaction> = {},
): Transaction => ({
  id: `t${++n}`,
  amountMinor,
  currency: 'ETB',
  type: 'debit',
  occurredAt: n,
  merchant,
  reference: null,
  source: 'telebirr',
  account: null,
  counterAccount: null,
  smsId: null,
  dedupKey: `k${n}`,
  category: 'other',
  categoryManual: false,
  needsReview: false,
  rawText: null,
  balanceMinor: null,
  createdAt: 0,
  ...p,
});

describe('payeeKey', () => {
  it('ignores case and extra spaces', () => {
    expect(payeeKey('  Abel   TESFAYE ')).toBe(payeeKey('abel tesfaye'));
  });

  it('ignores a trailing masked phone or account number', () => {
    expect(payeeKey('Abel Tesfaye 2517****8812')).toBe('abel tesfaye');
    expect(payeeKey('Abel Tesfaye (0911****45)')).toBe('abel tesfaye');
    expect(payeeKey('Shop 24')).toBe('shop 24');
  });
});

describe('groupByPayee', () => {
  const txs = [
    tx('Abel Tesfaye', 10000),
    tx('ABEL TESFAYE', 5000),
    tx('Abel Tesfaye', 20000, { type: 'credit', category: 'income' }),
    tx('Abel Tesfaye', 2000, { category: 'food' }),
    tx('Kaldis Coffee', 30000, { category: 'food' }),
    tx(null, 999),
    tx('Someone', 4500, { type: 'unknown', category: null }),
  ];
  const groups = groupByPayee(txs);

  it('merges name variants, totals paid and received, most frequent first', () => {
    expect(groups.map((g) => [g.name, g.count, g.paidMinor, g.receivedMinor])).toEqual([
      ['Abel Tesfaye', 4, 17000, 20000],
      ['Kaldis Coffee', 1, 30000, 0],
    ]);
  });

  it('reports the most common category', () => {
    expect(groups[0].category).toBe('other');
    expect(groups[1].category).toBe('food');
  });

  it('leaves out unnamed and unknown rows', () => {
    expect(groups.some((g) => g.name === 'Someone')).toBe(false);
  });
});

describe('payeeRuleCategory', () => {
  const rules = new Map<string, Category>([
    ['abel tesfaye', 'household'],
    ['my awash', 'transfers'],
  ]);

  it('applies a rule to payments to the payee', () => {
    expect(payeeRuleCategory({ merchant: 'ABEL  Tesfaye', type: 'debit' }, rules)).toBe(
      'household',
    );
  });

  it('keeps money received as income unless the rule is Transfers', () => {
    expect(payeeRuleCategory({ merchant: 'Abel Tesfaye', type: 'credit' }, rules)).toBeNull();
    expect(payeeRuleCategory({ merchant: 'My Awash', type: 'credit' }, rules)).toBe('transfers');
  });

  it('ignores unnamed, unknown and unruled rows', () => {
    expect(payeeRuleCategory({ merchant: null, type: 'debit' }, rules)).toBeNull();
    expect(payeeRuleCategory({ merchant: 'Abel Tesfaye', type: 'unknown' }, rules)).toBeNull();
    expect(payeeRuleCategory({ merchant: 'Kaldis', type: 'debit' }, rules)).toBeNull();
  });
});
