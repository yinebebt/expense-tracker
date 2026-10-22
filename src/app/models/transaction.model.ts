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
  /** Epoch ms, taken from the SMS received time. */
  occurredAt: number;
  merchant: string | null;
  reference: string | null;
  /** Parser source, e.g. 'CBE', 'telebirr'. */
  source: string;
  smsId: string | null;
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
