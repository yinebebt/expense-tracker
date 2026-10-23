import { manualTransaction, Transaction } from '../models/transaction.model';
import { toCsv } from './export';

const sms = (p: Partial<Transaction>): Transaction => ({
  id: 'x',
  amountMinor: 125050,
  currency: 'ETB',
  type: 'debit',
  occurredAt: new Date(2026, 9, 22, 9, 5).getTime(),
  merchant: 'Kaldis Coffee',
  reference: 'FT26295ABC12',
  source: 'CBE',
  smsId: '7',
  dedupKey: 'CBE|debit|ref:FT26295ABC12',
  category: 'food',
  categoryManual: false,
  needsReview: false,
  rawText: null,
  createdAt: 0,
  ...p,
});

describe('toCsv', () => {
  const lines = toCsv([
    sms({}),
    sms({ merchant: 'Shop, "Bole"', occurredAt: new Date(2026, 9, 21, 18, 0).getTime() }),
    sms({ type: 'unknown', amountMinor: null, merchant: null, category: null, needsReview: true }),
    manualTransaction(
      {
        type: 'credit',
        amountMinor: 50000,
        occurredAt: new Date(2026, 9, 23, 8, 0).getTime(),
        merchant: '=SUM(A1)',
        category: 'income',
        source: 'Cash',
        reference: 'R-1',
      },
      'm1',
      0,
    ),
  ]).split('\r\n');

  it('starts with a UTF-8 byte-order mark and a header', () => {
    expect(lines[0]).toBe(
      '﻿date,time,direction,amount,currency,payee,category,account,reference,counted,origin',
    );
  });

  it('writes rows oldest first with plain amounts', () => {
    expect(lines[1]).toBe(
      '2026-10-21,18:00,out,1250.50,ETB,"Shop, ""Bole""",Food and drinks,CBE,FT26295ABC12,yes,sms',
    );
    expect(lines[2]).toBe(
      '2026-10-22,09:05,out,1250.50,ETB,Kaldis Coffee,Food and drinks,CBE,FT26295ABC12,yes,sms',
    );
  });

  it('marks review rows and hand-entered rows', () => {
    expect(lines[3]).toBe(
      '2026-10-22,09:05,unknown,,ETB,,,CBE,FT26295ABC12,no,"sms, needs review"',
    );
    expect(lines[4]).toBe(
      "2026-10-23,08:00,in,500.00,ETB,'=SUM(A1),Income,Cash,R-1,yes,added by hand",
    );
  });
});
