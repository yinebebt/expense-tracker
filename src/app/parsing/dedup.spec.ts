import { fromRow, toRow } from '../services/database.service';
import { dedupKey } from './dedup';
import { FIXTURES } from './fixtures/fictional-sms';
import { parseSms, toTransaction } from './sms-parser';

const keyOf = (i: number, date?: number) => {
  const sms = { ...FIXTURES[i].sms, ...(date !== undefined && { date }) };
  const res = parseSms(sms);
  if (res.kind !== 'parsed') throw new Error('fixture not parsed');
  return toTransaction(sms, res.tx, 'x', 0).dedupKey;
};

describe('dedupKey', () => {
  it('is the same when the same message is imported again', () => {
    expect(keyOf(0)).toBe(keyOf(0));
  });

  it('uses the reference when present, so a different received time still matches', () => {
    expect(keyOf(0, 1)).toBe(keyOf(0, 2));
    expect(keyOf(0)).toBe('CBE|debit|ref:FT26287ABC12');
  });

  it('does not collide between a reversal and the original with the same reference', () => {
    const debit = FIXTURES.findIndex((f) => f.name === 'BOA merchant payment');
    const reversal = FIXTURES.findIndex((f) => f.name === 'BOA reversal goes to review');
    expect(keyOf(debit)).not.toBe(keyOf(reversal));
  });

  it('falls back to amount and time to the second without a reference', () => {
    const base = { source: 'telebirr', type: 'debit' as const, reference: null, amountMinor: 5000 };
    expect(dedupKey({ ...base, occurredAt: 1_000_100 })).toBe(
      dedupKey({ ...base, occurredAt: 1_000_900 }),
    );
    expect(dedupKey({ ...base, occurredAt: 1_000_100 })).not.toBe(
      dedupKey({ ...base, occurredAt: 1_001_100 }),
    );
    expect(dedupKey({ ...base, occurredAt: 1_000_100 })).not.toBe(
      dedupKey({ ...base, amountMinor: 5001, occurredAt: 1_000_100 }),
    );
  });

  it('every fictional transaction has a distinct key', () => {
    const keys = FIXTURES.map((f) => parseSms(f.sms)).flatMap((r, i) =>
      r.kind === 'parsed' ? [toTransaction(FIXTURES[i].sms, r.tx, 'x', 0).dedupKey] : [],
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('database row mapping', () => {
  it('round-trips a transaction', () => {
    const res = parseSms(FIXTURES[0].sms);
    if (res.kind !== 'parsed') throw new Error('fixture not parsed');
    const t = toTransaction(FIXTURES[0].sms, res.tx, 'id-1', 123);
    const cols = [
      'id',
      'amount_minor',
      'currency',
      'type',
      'occurred_at',
      'merchant',
      'reference',
      'source',
      'sms_id',
      'dedup_key',
      'category',
      'category_manual',
      'needs_review',
      'raw_text',
      'created_at',
    ];
    const row = Object.fromEntries(toRow(t).map((v, i) => [cols[i], v]));
    expect(fromRow(row)).toEqual(t);
  });
});
