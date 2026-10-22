import { Transaction } from '../models/transaction.model';
import { findSelfTransfers } from './transfers';

const MIN = 60_000;
let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`,
  amountMinor: 200000,
  currency: 'ETB',
  type: 'debit',
  occurredAt: 0,
  merchant: null,
  reference: null,
  source: 'CBE',
  smsId: null,
  dedupKey: `k${n}`,
  category: 'other',
  categoryManual: false,
  needsReview: false,
  rawText: null,
  createdAt: 0,
  ...p,
});

describe('findSelfTransfers', () => {
  it('pairs a debit and a same-amount credit on another source within the window', () => {
    const d = tx({ type: 'debit', source: 'CBE', occurredAt: 0 });
    const c = tx({ type: 'credit', source: 'telebirr', occurredAt: 1 * MIN, category: 'income' });
    expect(findSelfTransfers([d, c]).sort()).toEqual([d.id, c.id].sort());
  });

  it('ignores same source, different amount, or too far apart', () => {
    const d = tx({ type: 'debit', source: 'CBE', occurredAt: 0 });
    expect(findSelfTransfers([d, tx({ type: 'credit', source: 'CBE', occurredAt: MIN })])).toEqual(
      [],
    );
    expect(
      findSelfTransfers([d, tx({ type: 'credit', source: 'BOA', amountMinor: 199999 })]),
    ).toEqual([]);
    expect(
      findSelfTransfers([d, tx({ type: 'credit', source: 'BOA', occurredAt: 11 * MIN })]),
    ).toEqual([]);
  });

  it('leaves manual and unknown rows alone', () => {
    const d = tx({ type: 'debit', source: 'CBE' });
    expect(
      findSelfTransfers([d, tx({ type: 'credit', source: 'BOA', categoryManual: true })]),
    ).toEqual([]);
    expect(findSelfTransfers([d, tx({ type: 'unknown', source: 'BOA' })])).toEqual([]);
  });

  it('pairs with a side that is already a transfer and only returns the side that changes', () => {
    const d = tx({ type: 'debit', source: 'CBE' });
    const bankNamed = tx({ type: 'credit', source: 'telebirr', category: 'transfers' });
    expect(findSelfTransfers([d, bankNamed])).toEqual([d.id]);
    const ruled = tx({
      type: 'credit',
      source: 'BOA',
      category: 'transfers',
      categoryManual: true,
    });
    expect(findSelfTransfers([d, ruled])).toEqual([d.id]);
  });

  it('uses each credit once and picks the closest in time', () => {
    const d1 = tx({ type: 'debit', source: 'CBE', occurredAt: 0 });
    const d2 = tx({ type: 'debit', source: 'BOA', occurredAt: 5 * MIN });
    const c = tx({ type: 'credit', source: 'telebirr', occurredAt: 4 * MIN });
    expect(findSelfTransfers([d1, d2, c])).toEqual([d1.id, c.id]);
    const near = tx({ type: 'credit', source: 'telebirr', occurredAt: 30_000 });
    const far = tx({ type: 'credit', source: 'BOA', occurredAt: 3 * MIN });
    expect(findSelfTransfers([d1, far, near])).toEqual([d1.id, near.id]);
  });
});
