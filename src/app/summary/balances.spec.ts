import { Transaction } from '../models/transaction.model';
import { accountBalances, accountNames } from './balances';

const tx = (
  source: string,
  at: number,
  balanceMinor: number | null,
  account: string | null = null,
): Transaction => ({
  id: `${source}${at}`,
  amountMinor: 100,
  currency: 'ETB',
  type: 'debit',
  occurredAt: at,
  merchant: null,
  reference: null,
  source,
  account,
  counterAccount: null,
  smsId: null,
  dedupKey: `${source}${at}`,
  category: 'other',
  categoryManual: false,
  needsReview: false,
  rawText: null,
  balanceMinor,
  createdAt: 0,
});

describe('accountBalances', () => {
  it('takes the newest SMS balance per account and skips SMS without one', () => {
    const b = accountBalances(
      [tx('CBE', 1, 5000), tx('CBE', 3, 4000), tx('CBE', 4, null)],
      new Map(),
    );
    expect(b).toEqual([{ name: 'CBE', balanceMinor: 4000, at: 3, manual: false }]);
  });

  it('lets a newer hand-typed balance win, and adds accounts no SMS covers', () => {
    const manual = new Map([
      ['CBE', { balanceMinor: 9000, at: 5 }],
      ['Cash', { balanceMinor: 1500, at: 2 }],
    ]);
    const b = accountBalances([tx('CBE', 3, 4000), tx('telebirr', 6, 700)], manual);
    expect(b.map((x) => [x.name, x.balanceMinor, x.manual])).toEqual([
      ['telebirr', 700, false],
      ['CBE', 9000, true],
      ['Cash', 1500, true],
    ]);
  });

  it('keeps the SMS balance when the typed one is older', () => {
    const b = accountBalances([tx('CBE', 9, 4000)], new Map([['CBE', { balanceMinor: 1, at: 5 }]]));
    expect(b[0]).toMatchObject({ balanceMinor: 4000, manual: false });
  });

  it('keeps one balance per account when a bank has several', () => {
    const b = accountBalances(
      [tx('CBE', 1, 5000, '1*6789'), tx('CBE', 2, 300, '1*4321'), tx('CBE', 3, 4000, '1*6789')],
      new Map(),
    );
    expect(b.map((x) => [x.name, x.balanceMinor])).toEqual([
      ['CBE 1…6789', 4000],
      ['CBE 1…4321', 300],
    ]);
  });

  it('names a bank with one account by the bank alone, with or without a number in the SMS', () => {
    const b = accountBalances([tx('CBE', 1, 5000, '1*6789'), tx('CBE', 2, 4000)], new Map());
    expect(b).toEqual([{ name: 'CBE', balanceMinor: 4000, at: 2, manual: false }]);
  });

  it('leaves out a balance that does not say which account once the bank has several', () => {
    const b = accountBalances(
      [tx('CBE', 1, 7000), tx('CBE', 2, 5000, '1*6789'), tx('CBE', 3, 300, '1*4321')],
      new Map([['CBE', { balanceMinor: 9999, at: 9 }]]),
    );
    expect(b.map((x) => x.name)).toEqual(['CBE 1…4321', 'CBE 1…6789']);
  });

  it('tells per-account names apart from banks and Cash', () => {
    const names = accountNames([tx('CBE', 1, null, '1*6789'), tx('CBE', 2, null, '1*4321')]);
    expect(['CBE 1…6789', 'CBE', 'Cash'].map((n) => names.isAccount(n))).toEqual([
      true,
      false,
      false,
    ]);
  });
});
