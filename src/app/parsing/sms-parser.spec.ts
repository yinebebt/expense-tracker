import { RawSms } from '../models/transaction.model';
import { FIXTURES } from './fixtures/fictional-sms';
import { findSource, parseSms, toTransaction } from './sms-parser';

describe('parseSms', () => {
  for (const f of FIXTURES) {
    it(f.name, () => {
      const res = parseSms(f.sms);
      if ('ignored' in f.expect) {
        expect(res).toEqual({ kind: 'ignored', reason: f.expect.ignored });
      } else {
        expect(res.kind).toBe('parsed');
        if (res.kind === 'parsed') expect(res.tx).toMatchObject(f.expect);
      }
    });
  }

  it('does not take the balance as the transaction amount', () => {
    const res = parseSms({
      id: '1',
      address: 'CBE',
      date: 0,
      body: 'Your Current Balance is ETB 900.00. Your account has been debited with ETB 12.50.',
    });
    expect(res.kind === 'parsed' && res.tx.amountMinor).toBe(1250);
  });

  it('does not read a number after "telebirr" as an amount', () => {
    const res = parseSms({
      id: '1',
      address: 'CBE',
      date: 0,
      body: 'Your account was linked to telebirr 2519****5678 today.',
    });
    expect(res).toEqual({ kind: 'ignored', reason: 'no-amount' });
  });

  it('does not take "your account" as the merchant', () => {
    const res = parseSms({
      id: '1',
      address: 'CBE',
      date: 0,
      body: 'ETB 50.00 has been debited and transferred to your account at Awash.',
    });
    expect(res.kind === 'parsed' && res.tx).toMatchObject({
      type: 'debit',
      amountMinor: 5000,
      merchant: null,
    });
  });

  it('sends a message with conflicting debit and credit wording to review', () => {
    const res = parseSms({
      id: '1',
      address: 'CBE',
      date: 0,
      body: 'Your account has been debited with ETB 100.00 and credited with ETB 100.00.',
    });
    expect(res.kind === 'parsed' && res.tx).toMatchObject({ type: 'unknown', needsReview: true });
  });

  it('handles malformed input without throwing', () => {
    expect(
      parseSms({ id: '1', address: 'CBE', date: 0, body: undefined } as unknown as RawSms),
    ).toEqual({ kind: 'ignored', reason: 'malformed' });
    expect(parseSms(null as unknown as RawSms)).toEqual({ kind: 'ignored', reason: 'malformed' });
    expect(parseSms({ id: '1', address: 'CBE', date: NaN, body: 'x' })).toEqual({
      kind: 'ignored',
      reason: 'malformed',
    });
    expect(parseSms({ id: '1', address: 'CBE', date: 0, body: '' })).toEqual({
      kind: 'ignored',
      reason: 'no-amount',
    });
    expect(parseSms({ id: '1', address: 'CBE', date: 0, body: 'debited with ETB 0.00' }).kind).toBe(
      'parsed',
    );
  });

  it('matches sender addresses loosely', () => {
    expect(findSource('BoA')?.source).toBe('BOA');
    expect(findSource('Bank of Abyssinia')?.source).toBe('BOA');
    expect(findSource('telebirr')?.source).toBe('telebirr');
    expect(findSource('CBE-ALERT')).toBeUndefined();
  });
});

describe('toTransaction', () => {
  it('keeps SMS text only for unknown rows', () => {
    const parsed = FIXTURES.map((f) => ({ sms: f.sms, res: parseSms(f.sms) }));
    for (const { sms, res } of parsed) {
      if (res.kind !== 'parsed') continue;
      const t = toTransaction(sms, res.tx, 'id', 0);
      expect(t.rawText !== null).toBe(t.type === 'unknown');
      expect(t.occurredAt).toBe(sms.date);
    }
  });
});
