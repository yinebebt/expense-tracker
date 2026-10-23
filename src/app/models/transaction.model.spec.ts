import { isManual, manualTransaction, txTitle } from './transaction.model';

describe('txTitle', () => {
  it('uses the payee when the SMS names one', () => {
    expect(txTitle({ merchant: 'Kaldis Coffee', type: 'debit' })).toBe('Kaldis Coffee');
  });

  it('says what happened, not the bank, when it names no one', () => {
    expect(txTitle({ merchant: null, type: 'debit' })).toBe('Money out');
    expect(txTitle({ merchant: null, type: 'credit' })).toBe('Money in');
    expect(txTitle({ merchant: null, type: 'unknown' })).toBe('Unrecognised SMS');
  });
});

describe('manualTransaction', () => {
  it('marks a hand-entered row so it is never mistaken for an SMS', () => {
    const t = manualTransaction(
      {
        type: 'debit',
        amountMinor: 12000,
        occurredAt: 1,
        merchant: 'Bus',
        category: 'transport',
        source: 'Cash',
        reference: 'R-1',
      },
      'abc',
      2,
    );
    expect(isManual(t)).toBe(true);
    expect(t).toMatchObject({ smsId: null, categoryManual: true, needsReview: false });
    expect(isManual({ dedupKey: 'CBE|debit|ref:FT1' })).toBe(false);
  });
});
