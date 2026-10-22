import { txTitle } from './transaction.model';

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
