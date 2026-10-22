import { Category } from '../models/transaction.model';

// Parsing rules. The shared patterns cover the wording most Ethiopian banks and
// wallets use; sources only add patterns for formats the shared ones miss.
// Sender IDs and formats are best guesses until checked against real SMS
// (fixtures/fictional-sms.ts holds the made-up examples the tests use).

export interface TxPattern {
  type: 'debit' | 'credit';
  /** Must capture a named `amount` group. */
  match: RegExp;
  /** Optional; captures a named `party` group (merchant, payee or payer). */
  party?: RegExp;
  /** Fixed category for this pattern, e.g. airtime purchases. */
  category?: Category;
}

export interface SourceRule {
  /** Stored on each transaction and shown in the UI. Don't rename existing ones: dedup keys use it. */
  source: string;
  /** SMS sender addresses, compared after uppercasing and stripping non-alphanumerics. */
  senders: string[];
  /** Checked before SHARED_PATTERNS. */
  patterns?: TxPattern[];
}

/** Amounts are written as "ETB 1,250.00"; the parser rewrites "1,250.00 ETB" into that form first. */
const AMOUNT = String.raw`\b(?:ETB|Birr|Br)\.?\s?(?<amount>\d[\d,]*(?:\.\d{1,2})?)`;
const re = (pattern: string) => new RegExp(pattern, 'i');

const PARTY_TO = /\bto (?<party>[^.(]+?)\s*(?:\(|\bon\b|\.)/i;
const PARTY_FROM = /\bfrom (?<party>[^.,(]+?)\s*(?:\(|,|\bon\b|\.)/i;

/** Checked in order; for each type the first match wins. */
export const SHARED_PATTERNS: TxPattern[] = [
  {
    type: 'debit',
    match: re(String.raw`\b(?:debited|debit of)\s+(?:with\s+|by\s+)?` + AMOUNT),
    party: PARTY_TO,
  },
  {
    type: 'debit',
    match: re(AMOUNT + String.raw`\s+(?:has been|was|is)\s+(?:debited|withdrawn|deducted)`),
    party: PARTY_TO,
  },
  {
    type: 'debit',
    match: re(String.raw`\b(?:paid|transferr?ed|sent)\s+` + AMOUNT),
    party: PARTY_TO,
  },
  {
    type: 'debit',
    match: re(AMOUNT + String.raw`\s+(?:sent|paid|transferr?ed)\s+to\b`),
    party: PARTY_TO,
  },
  { type: 'debit', match: re(String.raw`\b(?:withdrawn|withdrawal of)\s+` + AMOUNT) },
  {
    type: 'credit',
    match: re(String.raw`\b(?:credited|credit of)\s+(?:with\s+|by\s+)?` + AMOUNT),
    party: PARTY_FROM,
  },
  {
    type: 'credit',
    match: re(AMOUNT + String.raw`\s+(?:has been|was|is)\s+(?:credited|deposited|received)`),
    party: PARTY_FROM,
  },
  { type: 'credit', match: re(String.raw`\breceived\s+` + AMOUNT), party: PARTY_FROM },
  { type: 'credit', match: re(String.raw`\bdeposit of\s+` + AMOUNT), party: PARTY_FROM },
];

/** Reference numbers: "Ref No FT…", "Ref: …", "transaction number is …", "Transaction ID …", receipt links "?id=…". */
export const REFERENCE =
  /(?:\bRef(?:erence)?\b\.?\s*(?:No\.?|Number|#)?|\btransaction (?:number|ID)|\bTxn ?ID|[?&]id=)\s*(?:is\s+)?[:.]?\s*(?<ref>(?=[A-Z]*\d)[A-Z0-9]{6,})/i;

const bank = (source: string, ...senders: string[]): SourceRule => ({ source, senders });

export const SOURCES: SourceRule[] = [
  // Banks
  bank('CBE', 'CBE'),
  bank('Awash', 'AwashBank', 'Awash'),
  bank('Dashen', 'DashenBank', 'Dashen'),
  bank('BOA', 'BOA', 'Abyssinia', 'BankofAbyssinia'),
  bank('Coopbank', 'Coopbank', 'COOP', 'CBO'),
  bank('Wegagen', 'WegagenBank', 'Wegagen'),
  bank('Hibret', 'HibretBank', 'Hibret', 'UnitedBank'),
  bank('Nib', 'NibBank', 'NIB'),
  bank('Zemen', 'ZemenBank', 'Zemen'),
  bank('Oromia Bank', 'OromiaBank', 'OIB'),
  bank('Bunna', 'BunnaBank', 'Bunna'),
  bank('Berhan', 'BerhanBank', 'Berhan'),
  bank('Abay', 'AbayBank', 'Abay'),
  bank('Enat', 'EnatBank', 'Enat'),
  bank('Amhara Bank', 'AmharaBank'),
  bank('Lion', 'LionBank', 'LIB'),
  bank('Global', 'GlobalBank'),
  bank('Addis', 'AddisBank'),
  bank('Siinqee', 'SiinqeeBank', 'Siinqee'),
  bank('Ahadu', 'AhaduBank'),
  bank('Tsehay', 'TsehayBank'),
  bank('Gadaa', 'GadaaBank'),
  bank('Hijra', 'HijraBank'),
  bank('ZamZam', 'ZamZamBank'),
  // Wallets
  {
    source: 'telebirr',
    senders: ['127', 'telebirr'],
    patterns: [
      {
        type: 'debit',
        match: re(String.raw`You have (?:bought|purchased)\b.*?\b(?:for|of)\s+` + AMOUNT),
        category: 'bills',
      },
    ],
  },
  bank('M-PESA', 'M-PESA'),
  bank('CBE Birr', 'CBE Birr'),
  bank('HelloCash', 'HelloCash'),
  bank('Kacha', 'Kacha'),
  bank('e-Birr', 'e-Birr'),
];

/** One-time codes. Checked before anything else. */
export const OTP = /\b(OTP|one[- ]time (?:password|code)|verification code|security code)\b/i;

/** Reversals and refunds go to review rather than guessing their direction. */
export const REVERSAL = /\b(revers(?:ed|al)|refund(?:ed)?)\b/i;

/** Promotional wording. Only checked when no transaction pattern matched. */
export const PROMO =
  /\b(offer|promo(?:tion)?|win|winners?|cashback|discount|bonus|lottery|dial \*\d+)\b/i;

/** Balance phrases, stripped before deciding whether a message still mentions an amount. */
export const BALANCE_PHRASE = new RegExp(String.raw`balance\b[^.]*?` + AMOUNT, 'gi');

/** Any amount, for the unknown-message fallback. */
export const ANY_AMOUNT = re(AMOUNT);

/** "1,250.00 ETB" → "ETB 1,250.00", so patterns only handle one order. */
export const TRAILING_CURRENCY = /(\d[\d,]*(?:\.\d{1,2})?)\s?(?:ETB|Birr|Br)\b/gi;
