import { TxType } from '../models/transaction.model';

/**
 * Stable key for a parsed message. The type is part of the key so a reversal
 * that quotes the original reference doesn't collide with the original row.
 * Without a reference, falls back to amount and time to the second: two
 * identical transactions from one source in the same second would merge.
 */
export function dedupKey(tx: {
  source: string;
  type: TxType;
  reference: string | null;
  amountMinor: number | null;
  occurredAt: number;
}): string {
  if (tx.reference) return `${tx.source}|${tx.type}|ref:${tx.reference.toUpperCase()}`;
  return `${tx.source}|${tx.type}|${tx.amountMinor ?? 'na'}|${Math.floor(tx.occurredAt / 1000)}`;
}
