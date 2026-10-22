import { parseAmountMinor } from '../models/money';
import { Category, RawSms, Transaction, TxType } from '../models/transaction.model';
import { categorize } from './categorize';
import { dedupKey } from './dedup';
import {
  ANY_AMOUNT,
  BALANCE_PHRASE,
  OTP,
  PROMO,
  REFERENCE,
  REVERSAL,
  SHARED_PATTERNS,
  SOURCES,
  SourceRule,
  TRAILING_CURRENCY,
} from './rules';

export type IgnoreReason =
  'malformed' | 'unsupported-sender' | 'otp' | 'promo' | 'balance' | 'no-amount';

export interface ParsedTx {
  source: string;
  type: TxType;
  amountMinor: number | null;
  currency: string;
  merchant: string | null;
  reference: string | null;
  category: Category | null;
  needsReview: boolean;
}

export type ParseResult =
  { kind: 'ignored'; reason: IgnoreReason } | { kind: 'parsed'; tx: ParsedTx };

const MAX_BODY = 2000;

const normalizeAddress = (a: string) => a.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function findSource(address: string, rules: SourceRule[] = SOURCES): SourceRule | undefined {
  const a = normalizeAddress(address);
  return rules.find((r) => r.senders.some((s) => normalizeAddress(s) === a));
}

/** All sender addresses across sources, for filtering the inbox query. */
export function knownSenders(rules: SourceRule[] = SOURCES): string[] {
  return rules.flatMap((r) => r.senders);
}

export function parseSms(sms: RawSms, rules: SourceRule[] = SOURCES): ParseResult {
  if (
    typeof sms?.body !== 'string' ||
    typeof sms.address !== 'string' ||
    !Number.isFinite(sms.date)
  ) {
    return { kind: 'ignored', reason: 'malformed' };
  }
  const rule = findSource(sms.address, rules);
  if (!rule) return { kind: 'ignored', reason: 'unsupported-sender' };

  const body = sms.body
    .slice(0, MAX_BODY)
    .replace(/\s+/g, ' ')
    .replace(TRAILING_CURRENCY, 'ETB $1')
    .trim();
  if (OTP.test(body)) return { kind: 'ignored', reason: 'otp' };

  const reference = REFERENCE.exec(body)?.groups?.['ref']?.toUpperCase() ?? null;
  const base = { source: rule.source, currency: 'ETB', reference };

  if (REVERSAL.test(body)) {
    return {
      kind: 'parsed',
      tx: {
        ...base,
        type: 'unknown',
        amountMinor: firstAmount(body),
        merchant: null,
        category: null,
        needsReview: true,
      },
    };
  }

  const matches = [...(rule.patterns ?? []), ...SHARED_PATTERNS]
    .map((p) => ({ p, m: p.match.exec(body) }))
    .filter((x) => x.m?.groups?.['amount']);
  const types = new Set(matches.map((x) => x.p.type));

  if (types.size === 1) {
    const { p, m } = matches[0];
    const amountMinor = parseAmountMinor(m!.groups!['amount']);
    if (amountMinor !== null && amountMinor > 0) {
      const merchant = cleanParty(p.party?.exec(body)?.groups?.['party']);
      return {
        kind: 'parsed',
        tx: {
          ...base,
          type: p.type,
          amountMinor,
          merchant,
          category: p.category ?? categorize(p.type, merchant),
          needsReview: false,
        },
      };
    }
  }

  // Conflicting or unusable matches, or no pattern matched: decide between ignoring and review.
  if (types.size === 0) {
    const withoutBalance = body.replace(BALANCE_PHRASE, '');
    if (!ANY_AMOUNT.test(withoutBalance)) {
      return { kind: 'ignored', reason: /balance/i.test(body) ? 'balance' : 'no-amount' };
    }
    if (PROMO.test(body)) return { kind: 'ignored', reason: 'promo' };
  }

  return {
    kind: 'parsed',
    tx: {
      ...base,
      type: 'unknown',
      amountMinor: firstAmount(body),
      merchant: null,
      category: null,
      needsReview: true,
    },
  };
}

export function toTransaction(sms: RawSms, tx: ParsedTx, id: string, now: number): Transaction {
  return {
    id,
    amountMinor: tx.amountMinor,
    currency: tx.currency,
    type: tx.type,
    occurredAt: sms.date,
    merchant: tx.merchant,
    reference: tx.reference,
    source: tx.source,
    smsId: sms.id ?? null,
    dedupKey: dedupKey({ ...tx, occurredAt: sms.date }),
    category: tx.category,
    categoryManual: false,
    needsReview: tx.needsReview,
    rawText: tx.type === 'unknown' ? sms.body.slice(0, MAX_BODY) : null,
    createdAt: now,
  };
}

/** First amount that isn't part of a balance phrase. */
function firstAmount(body: string): number | null {
  const m = ANY_AMOUNT.exec(body.replace(BALANCE_PHRASE, ''));
  return m?.groups?.['amount'] ? parseAmountMinor(m.groups['amount']) : null;
}

function cleanParty(s: string | undefined): string | null {
  const t = s
    ?.replace(/\s+/g, ' ')
    .replace(/\s+\+?[\d*]{6,}$/, '') // trailing masked phone or account number
    .trim();
  // "to your account", "from your wallet" and the like name no one.
  if (!t || /^(your|you|the|a|an|my)\b/i.test(t)) return null;
  return t.slice(0, 80);
}
