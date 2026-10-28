import { Category, TxType } from '../models/transaction.model';

// Checked in order against the merchant name; the first match wins.
const MERCHANT_RULES: [Category, RegExp][] = [
  [
    'bills',
    /\b(airtime|data|package|ethio ?telecom|safaricom|electric(?:ity)?|EEU|water|dstv|canal|internet|wifi)\b/i,
  ],
  ['health', /\b(pharmacy|pharma|clinic|hospital|medical|diagnostic|laboratory)\b/i],
  ['transport', /\b(fuel|petrol|taxi|ride|feres|bus|airlines?|transport|parking)\b/i],
  // "Hotel" usually means a restaurant or café in Ethiopia.
  ['food', /\b(caf[eé]|coffee|restaurant|hotel|burger|pizza|juice|bakery|kitchen|lounge)\b/i],
  ['household', /\b(supermarket|mini ?market|gebeya|furniture|household)\b/i],
  ['shopping', /\b(shop|store|mall|boutique|fashion|electronics)\b/i],
];

export function categorizeMerchant(merchant: string | null): Category | null {
  if (!merchant) return null;
  return MERCHANT_RULES.find(([, re]) => re.test(merchant))?.[0] ?? null;
}

/**
 * Counterparties that are a bank or wallet rather than a person or shop, e.g. telebirr's
 * "received from Commercial Bank of Ethiopia". That's almost always the user's own account.
 */
const INSTITUTION = /\b(bank|telebirr|m-?pesa|cbe ?birr|hello ?cash|e-?birr|kacha|wallet)\b/i;
/** The wallet paying the user itself, e.g. "M-PESA cashback": income, not a move. */
const REWARD = /\b(cash ?back|reward|bonus|interest)\b/i;

export function categorize(type: TxType, merchant: string | null): Category | null {
  if (type === 'unknown') return null;
  if (merchant && INSTITUTION.test(merchant) && !REWARD.test(merchant)) return 'transfers';
  if (type === 'credit') return 'income';
  if (type === 'debit') return categorizeMerchant(merchant) ?? 'other';
  return null;
}
