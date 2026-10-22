import { Transaction } from '../models/transaction.model';
import { dayRange, monthRange, summarize, weekRange } from './summary';

let n = 0;
const tx = (at: Date, amountMinor: number, p: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`,
  amountMinor,
  currency: 'ETB',
  type: 'debit',
  occurredAt: at.getTime(),
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

// Thursday 22 October 2026, 14:00 local time.
const NOW = new Date(2026, 9, 22, 14, 0);

describe('date ranges', () => {
  it('day is local midnight to midnight', () => {
    const r = dayRange(NOW);
    expect(r.start).toEqual(new Date(2026, 9, 22));
    expect(r.end).toEqual(new Date(2026, 9, 23));
  });

  it('week runs Monday to Sunday', () => {
    const r = weekRange(NOW);
    expect(r.start).toEqual(new Date(2026, 9, 19));
    expect(r.end).toEqual(new Date(2026, 9, 26));
  });

  it('week of a Sunday belongs to the preceding Monday', () => {
    expect(weekRange(new Date(2026, 9, 25, 23, 59)).start).toEqual(new Date(2026, 9, 19));
    expect(weekRange(new Date(2026, 9, 26, 0, 0)).start).toEqual(new Date(2026, 9, 26));
  });

  it('week can span a month boundary', () => {
    const r = weekRange(new Date(2026, 10, 1)); // Sunday 1 November
    expect(r.start).toEqual(new Date(2026, 9, 26));
    expect(r.end).toEqual(new Date(2026, 10, 2));
  });

  it('month is the calendar month', () => {
    const r = monthRange(NOW);
    expect(r.start).toEqual(new Date(2026, 9, 1));
    expect(r.end).toEqual(new Date(2026, 10, 1));
  });
});

describe('summarize', () => {
  const txs = [
    tx(new Date(2026, 9, 22, 8, 0), 15000, { category: 'food' }), // today
    tx(new Date(2026, 9, 22, 0, 0), 5000, { category: 'transport' }), // today, at midnight
    tx(new Date(2026, 9, 21, 23, 59), 10000, { category: 'food' }), // yesterday, this week
    tx(new Date(2026, 9, 19, 0, 0), 20000, { category: 'bills' }), // Monday, this week
    tx(new Date(2026, 9, 18, 23, 59), 99900, { category: 'shopping' }), // Sunday, last week, this month
    tx(new Date(2026, 8, 30, 12, 0), 77700, { category: 'shopping' }), // last month
    tx(new Date(2026, 9, 20, 9, 0), 500000, { type: 'credit', category: 'income' }), // income this week
    tx(new Date(2026, 9, 20, 9, 0), 200000, { category: 'transfers' }), // own-account transfer out
    tx(new Date(2026, 9, 20, 9, 1), 200000, { type: 'credit', category: 'transfers' }), // and in
    tx(new Date(2026, 9, 22, 9, 0), 4500, { type: 'unknown', category: null, needsReview: true }),
  ];
  const s = summarize(txs, NOW);

  it('totals today, this week and this month from debits only', () => {
    expect(s.today.spent).toBe(20000);
    expect(s.week.spent).toBe(50000);
    expect(s.month.spent).toBe(149900);
  });

  it('counts credits as received, not spent', () => {
    expect(s.week.received).toBe(500000);
  });

  it('excludes own-account transfers and unknown rows', () => {
    expect(s.week.spent).toBe(50000);
    expect(s.month.byCategory.find((c) => c.category === 'transfers')).toBeUndefined();
  });

  it('ranks categories by this month’s spending', () => {
    expect(s.topCategory).toEqual({ category: 'shopping', amountMinor: 99900 });
    expect(s.month.byCategory.map((c) => c.category)).toEqual([
      'shopping',
      'food',
      'bills',
      'transport',
    ]);
  });

  it('splits the week into seven days of spending, Monday first', () => {
    expect(s.week.days.map((d) => d.day.getDate())).toEqual([19, 20, 21, 22, 23, 24, 25]);
    expect(s.week.days.map((d) => d.spentMinor)).toEqual([20000, 0, 10000, 20000, 0, 0, 0]);
  });

  it('reports money moved between own accounts once per move', () => {
    expect(s.month.moved).toEqual({ amountMinor: 200000, count: 1 });
    expect(s.month.received).toBe(500000);
  });

  it('handles no transactions', () => {
    const empty = summarize([], NOW);
    expect(empty.today.spent).toBe(0);
    expect(empty.topCategory).toBeNull();
    expect(empty.week.days).toHaveLength(7);
    expect(empty.month.moved).toEqual({ amountMinor: 0, count: 0 });
  });
});
