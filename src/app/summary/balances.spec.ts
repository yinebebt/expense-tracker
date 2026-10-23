import { Transaction } from '../models/transaction.model';
import { accountBalances } from './balances';

const tx = (source: string, at: number, balanceMinor: number | null): Transaction => ({
  id: `${source}${at}`,
  amountMinor: 100,
  currency: 'ETB',
  type: 'debit',
  occurredAt: at,
  merchant: null,
  reference: null,
  source,
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
    expect(b).toEqual([{ source: 'CBE', balanceMinor: 4000, at: 3, manual: false }]);
  });

  it('lets a newer hand-typed balance win, and adds accounts no SMS covers', () => {
    const manual = new Map([
      ['CBE', { balanceMinor: 9000, at: 5 }],
      ['Cash', { balanceMinor: 1500, at: 2 }],
    ]);
    const b = accountBalances([tx('CBE', 3, 4000), tx('telebirr', 6, 700)], manual);
    expect(b.map((x) => [x.source, x.balanceMinor, x.manual])).toEqual([
      ['telebirr', 700, false],
      ['CBE', 9000, true],
      ['Cash', 1500, true],
    ]);
  });

  it('keeps the SMS balance when the typed one is older', () => {
    const b = accountBalances([tx('CBE', 9, 4000)], new Map([['CBE', { balanceMinor: 1, at: 5 }]]));
    expect(b[0]).toMatchObject({ balanceMinor: 4000, manual: false });
  });
});
