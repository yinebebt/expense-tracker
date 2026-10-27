import { formatMinor } from '../models/money';
import { CATEGORY_LABELS, isManual, Transaction } from '../models/transaction.model';
import { formatAccount } from '../parsing/accounts';
import { isCounted } from './summary';

const COLUMNS = [
  'date',
  'time',
  'direction',
  'amount',
  'currency',
  'payee',
  'category',
  'account',
  'account number',
  'other account number',
  'reference',
  'counted',
  'origin',
];

/**
 * Transactions as CSV, oldest first, one row per stored transaction. Starts with a
 * byte-order mark so spreadsheet apps read Amharic names as UTF-8.
 */
export function toCsv(txs: Transaction[]): string {
  const rows = [...txs]
    .sort((a, b) => a.occurredAt - b.occurredAt)
    .map((t) => {
      const d = new Date(t.occurredAt);
      const pad = (n: number) => String(n).padStart(2, '0');
      return [
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        t.type === 'debit' ? 'out' : t.type === 'credit' ? 'in' : 'unknown',
        // Plain number, no thousands separator, so spreadsheets read it as a number.
        t.amountMinor === null ? '' : formatMinor(t.amountMinor, '').trim().replace(/,/g, ''),
        t.currency,
        t.merchant ?? '',
        t.category ? CATEGORY_LABELS[t.category] : '',
        t.source,
        t.account ? formatAccount(t.account) : '',
        t.counterAccount ? formatAccount(t.counterAccount) : '',
        t.reference ?? '',
        isCounted(t) ? 'yes' : 'no',
        isManual(t) ? 'added by hand' : t.needsReview ? 'sms, needs review' : 'sms',
      ];
    });
  return '﻿' + [COLUMNS, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

function cell(value: string): string {
  // A leading = + - or @ makes spreadsheets run the cell as a formula.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
