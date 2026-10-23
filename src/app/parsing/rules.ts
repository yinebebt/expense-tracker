import { Category } from '../models/transaction.model';

// Parsing rules. The shared patterns cover the wording most Ethiopian banks and
// wallets use; sources only add patterns for formats the shared ones miss.
// Sender IDs and formats are best guesses until checked against real SMS
// (fixtures/fictional-sms.ts holds the made-up examples the tests use).

export interface TxPattern {
  type: 'debit' | 'credit';
  /** Must capture a named `amount` group. */
  match: RegExp;
  /**
   * Optional; captures the merchant, payee or payer as a named `party` group, or as
   * `holder` when it's an account holder's name in brackets.
   */
  party?: RegExp;
  /** Fixed category for this pattern, e.g. airtime purchases. */
  category?: Category;
  /** Fixed merchant, for messages that name no payee. */
  merchant?: string;
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

// CBE names the other side in brackets after a masked account number:
// "to account 1****9999 (Abebe Kebede)", "from account 1****9999 (A.a City Agency)".
// The bracketed name may contain dots, so it gets its own group.
const HELD = String.raw`account\s+[\d*]+\s*\((?<holder>[^)]+)\)`;
const PARTY_TO = new RegExp(
  String.raw`\bto (?:${HELD}|(?<party>[^.(;]+?)\s*(?:\(|;|\bon\b|\.))`,
  'i',
);
const PARTY_FROM = new RegExp(
  // telebirr: "from Bank of Abyssinia to your telebirr Account 2519… - <your name>."
  String.raw`\bfrom (?:${HELD}|(?<party>[^.,(]+?)\s*(?:\(|,|\bon\b|\bto your\b|\.))`,
  'i',
);
/** Amharic "ከ X" (from X), ending at the amount, a "-" separator, "በ" (on) or the sentence end. */
const PARTY_FROM_AM = /(?:^|\s)ከ\s+(?<party>[^።]+?)\s*(?:\bETB\b|፟|\s-\s|\sበ\s|።)/;

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
    // Also e-Birr: "ETB 400 has been paid to merchant Feres."
    type: 'debit',
    match: re(AMOUNT + String.raw`\s+(?:has been\s+|was\s+)?(?:sent|paid|transferr?ed)\s+to\b`),
    party: PARTY_TO,
  },
  { type: 'debit', match: re(String.raw`\b(?:withdrawn|withdrawal of)\s+` + AMOUNT) },
  {
    // CBE: "A debit transaction of ETB 600.0. has occurred on your account …"
    type: 'debit',
    match: re(String.raw`\bdebit transaction of\s+` + AMOUNT),
    party: PARTY_TO,
  },
  // Amharic (BOA): "ብር 1,250.00 ወጪ ተደርጓል" = debited. The parser rewrites ብር to ETB first.
  // BOA spells the verb more than one way (ተደርጓል, ተደርጓዋል).
  { type: 'debit', match: re(AMOUNT + String.raw`\s*ወጪ ተደርጓ`) },
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
  {
    // CBE: "credited by SAMPLE INSURANCE COMPANY S.C (SIC) with ETB 1200.00"
    type: 'credit',
    match: re(String.raw`\bcredited by\s.{1,120}?\swith\s+` + AMOUNT),
    party: /\bcredited by (?<party>.+?)\s*(?:\(|\swith\s)/i,
  },
  { type: 'credit', match: re(String.raw`\bdeposit of\s+` + AMOUNT), party: PARTY_FROM },
  {
    type: 'credit',
    match: re(String.raw`\bcredit transaction of\s+` + AMOUNT),
    party: PARTY_FROM,
  },
  {
    // e-Birr: "ETB350 Received from Sample Transport PLC (2519…)"
    type: 'credit',
    match: re(AMOUNT + String.raw`\s+(?:received|credited|deposited)\s+from\b`),
    party: PARTY_FROM,
  },
  // Amharic (BOA): "ከ ALMAZ BEKELE ብር 750.00 ገቢ ተደርጓዋል" = credited.
  { type: 'credit', match: re(AMOUNT + String.raw`\s*ገቢ ተደርጓ`), party: PARTY_FROM_AM },
  {
    // Amharic (M-PESA): "600.00 ብር ከ Commercial Bank Of Ethiopia-B2C ፟- ከ … ተቀብለዋል" = received.
    type: 'credit',
    match: re(AMOUNT + String.raw`\s+ከ\s[^።]*?ተቀብለዋል`),
    party: PARTY_FROM_AM,
  },
];

/**
 * Reference numbers: "Ref No FT…", "Ref: …", "transaction number is …", "Transaction ID …",
 * receipt links "?id=…", "?trx=…" or ".../FT…", and M-PESA's Amharic "መለያ ቁጥር …" (transaction ID).
 */
export const REFERENCE =
  /(?:\bRef(?:erence)?\b\.?\s*(?:No\.?|Number|#)?|\btransaction (?:number|ID)|\bTxn ?ID|[?&](?:id|trx)=|\/(?=FT\d)|መለያ ቁጥር)\s*(?:is\s+)?[:.]?\s*(?<ref>(?=[A-Z]*\d)[A-Z0-9]{6,})/i;

const bank = (source: string, ...senders: string[]): SourceRule => ({ source, senders });

export const SOURCES: SourceRule[] = [
  // Banks
  bank('CBE', 'CBE'),
  bank('Awash', 'AwashBank', 'Awash'),
  bank('Dashen', 'DashenBank', 'Dashen'),
  {
    source: 'BOA',
    senders: ['BOA', 'Abyssinia', 'BankofAbyssinia'],
    patterns: [
      {
        // "debited with ETB 9.99 for the Mobile Banking Monthly Maintenance Fee, including …"
        type: 'debit',
        match: re(String.raw`\bdebited with\s+` + AMOUNT + String.raw`\s+for the\b`),
        party: /\bfor the (?<party>[^,.]+)/i,
      },
    ],
  },
  bank('Coopbank', 'Coopbank', 'COOP', 'CBO'),
  bank('Zemen', 'ZemenBank', 'Zemen'),
  bank('Enat', 'EnatBank', 'Enat'),
  bank('Amhara Bank', 'AmharaBank'),
  // Wallets
  {
    source: 'telebirr',
    senders: ['127', 'telebirr'],
    patterns: [
      {
        type: 'debit',
        match: re(String.raw`You have (?:bought|purchased)\b.*?\b(?:for|of)\s+` + AMOUNT),
        merchant: 'Ethio telecom',
        category: 'bills',
      },
      {
        // "You have recharged ETB 100.00 airtime for 9…"
        type: 'debit',
        match: re(String.raw`You have recharged\s+` + AMOUNT),
        merchant: 'Ethio telecom',
        category: 'bills',
      },
      {
        // "You have paid ETB 50.00 for package Weekly Internet Package … purchase made for 09…"
        type: 'debit',
        match: re(String.raw`\bpaid\s+` + AMOUNT + String.raw`\s+for package\b`),
        merchant: 'Ethio telecom',
        category: 'bills',
      },
    ],
  },
  {
    source: 'M-PESA',
    senders: ['M-PESA'],
    patterns: [
      {
        // Amharic: "የ5.00 ብር የአየር ሰዓት … ገዝተዋል" (bought airtime),
        // "የ2,100.00 ብር የሳፋሪኮም ጥቅል … ገዝተዋል" (bought a Safaricom package).
        type: 'debit',
        match: re(AMOUNT + String.raw`\s*(?:የአየር ሰዓት|የሳፋሪኮም ጥቅል)[^።]*?ገዝተዋል`),
        merchant: 'Safaricom',
        category: 'bills',
      },
      { type: 'debit', match: re(AMOUNT + String.raw`[^።]*?ገዝተዋል`) },
      // "99.99 ብር ለ2519… በ … ልከዋል" = sent to a number.
      { type: 'debit', match: re(AMOUNT + String.raw`\s+ለ\s?[^።]*?ልከዋል`) },
      {
        // Cashback: "በM-PESA በኩል ስለከፈሉ 9.99 ብር ተመላሽ ገንዘብ ተቀብለዋል" (received money back for paying).
        type: 'credit',
        match: re(AMOUNT + String.raw`\s+ተመላሽ ገንዘብ ተቀብለዋል`),
        merchant: 'M-PESA cashback',
        category: 'income',
      },
    ],
  },
  bank('CBE Birr', 'CBE Birr'),
  bank('HelloCash', 'HelloCash'),
  bank('Kacha', 'Kacha'),
  bank('e-Birr', 'e-Birr'),
];

/** One-time codes. Checked before anything else. */
export const OTP = /\b(OTP|one[- ]time (?:password|code)|verification code|security code)\b/i;

/** Reversals and refunds go to review rather than guessing their direction. */
export const REVERSAL = /\b(revers(?:ed|al)|refund(?:ed)?)\b/i;

/**
 * Ads and notices that move no money. Only checked when no transaction pattern matched,
 * and kept to signals real transactions don't carry: an unparsed transaction belongs in
 * review, not silently dropped.
 */
export const PROMO = new RegExp(
  String.raw`\b(?:offer|promo(?:tion)?|win|winners?|cashback|discount|bonus|lottery|dial \*\d+|up to (?:ETB|Birr))\b` +
    // "Download Sample Lending App" but not telebirr's "To download your payment information".
    String.raw`|\bdownload\s+(?:\S+\s+){0,4}app\b|play\.google\.com|apps\.apple\.com` +
    // Amharic: prize, win, discount, bonus, "up to birr" (ብር is rewritten to ETB first).
    String.raw`|ሽልማት|ያሸንፉ|ቅናሽ|ጉርሻ|እስከ ETB` +
    // M-PESA Errif (overdraft loan) reminders and limit notices; they move no money.
    String.raw`|ዕርፍ|እርፍ|\bErrif\b`,
  'i',
);

/** Balance phrases, stripped before deciding whether a message still mentions an amount. */
export const BALANCE_PHRASE = new RegExp(String.raw`(?:balance\b|ቀሪ \S*ሳብ)[^.።]*?` + AMOUNT, 'gi');

/** Any amount, for the unknown-message fallback. */
export const ANY_AMOUNT = re(AMOUNT);

/** "1,250.00 ETB" → "ETB 1,250.00", so patterns only handle one order. */
export const TRAILING_CURRENCY = /(\d[\d,]*(?:\.\d{1,2})?)\s?(?:ETB|Birr|Br)\b/gi;

/**
 * "ብር 1,250.00" or "1,250.00 ብር" (Amharic "birr") → "ETB 1,250.00". The leading form wins
 * when both could apply, as in "ቁጥርዎ 1*23 ብር 1,250.00".
 */
export const AMHARIC_CURRENCY = /ብር\s?(?=\d)|(\d[\d,]*(?:\.\d{1,2})?)\s?ብር(?!\s?\d)/g;
