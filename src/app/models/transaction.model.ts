export type TxType = 'debit' | 'credit' | 'unknown';

export const CATEGORIES = [
  'food',
  'transport',
  'shopping',
  'bills',
  'household',
  'health',
  'transfers',
  'other',
  'income',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  food: 'Food and drinks',
  transport: 'Transport',
  shopping: 'Shopping',
  bills: 'Bills and mobile data',
  household: 'Household',
  health: 'Health',
  transfers: 'Own transfers',
  other: 'Other',
  income: 'Income',
};

export interface Transaction {
  id: string;
  /** Integer minor units (santim for ETB). Null only for unknown rows where no amount was found. */
  amountMinor: number | null;
  currency: string;
  type: TxType;
  /** Epoch ms: the SMS received time, or the date entered for a row added by hand. */
  occurredAt: number;
  merchant: string | null;
  reference: string | null;
  /** Parser source, e.g. 'CBE', 'telebirr', or the account picked for a row added by hand. */
  source: string;
  /** Null for rows added by hand. */
  smsId: string | null;
  /** `manual|<id>` for rows added by hand; see isManual(). */
  dedupKey: string;
  /** Null for unknown rows until reviewed. */
  category: Category | null;
  categoryManual: boolean;
  needsReview: boolean;
  /** SMS text, kept only for unknown rows so they can be reviewed. */
  rawText: string | null;
  createdAt: number;
}

/** A message as delivered by the SMS reader. */
export interface RawSms {
  id: string;
  address: string;
  body: string;
  /** Epoch ms. */
  date: number;
}

/** A row's title: the payee, or what happened when the SMS names no one. Never the bank. */
export function txTitle(t: Pick<Transaction, 'merchant' | 'type'>): string {
  if (t.merchant) return t.merchant;
  if (t.type === 'debit') return 'Money out';
  if (t.type === 'credit') return 'Money in';
  return 'Unrecognised SMS';
}

const MANUAL_KEY = 'manual|';

/** Rows added by hand rather than read from an SMS. */
export function isManual(t: Pick<Transaction, 'dedupKey'>): boolean {
  return t.dedupKey.startsWith(MANUAL_KEY);
}

export interface ManualEntry {
  type: 'debit' | 'credit';
  amountMinor: number;
  occurredAt: number;
  merchant: string | null;
  category: Category;
  source: string;
  reference: string;
}

/** A transaction row for something entered by hand. The category counts as set by hand. */
export function manualTransaction(e: ManualEntry, id: string, now: number): Transaction {
  return {
    id,
    ...e,
    currency: 'ETB',
    smsId: null,
    dedupKey: MANUAL_KEY + id,
    categoryManual: true,
    needsReview: false,
    rawText: null,
    createdAt: now,
  };
}
