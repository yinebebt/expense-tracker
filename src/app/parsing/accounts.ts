import { TxType } from '../models/transaction.model';

// Banks mask account numbers, with a mask length that varies between SMS formats:
// "1*****6789" and "1****6789" are the same account. Numbers are kept with the mask
// shortened to one star, "1*6789", so the same account always compares equal.
const NUMBER = String.raw`(?<acc>\d[\d*]*\d)`;

/** "your Account 1*****6789", "from your account …", "credited to your account 50***12". */
const YOUR_ACCOUNT = new RegExp(String.raw`\byour\s+account\s+(?:no\.?\s*)?` + NUMBER, 'i');
/** BOA Amharic: "ሂሳብ ቁጥርዎ 1*23" (your account number). */
const YOUR_ACCOUNT_AM = new RegExp(String.raw`ሂሳብ ቁጥርዎ\s+` + NUMBER);
/** CBE: "transferred ETB… from account 1****6789 to account 1****4321 (…)". */
const FROM_ACCOUNT = new RegExp(String.raw`\bfrom\s+account\s+` + NUMBER, 'i');
const TO_ACCOUNT = new RegExp(String.raw`\bto\s+account\s+` + NUMBER, 'i');

function numberIn(re: RegExp, body: string): string | null {
  return re.exec(body)?.groups?.['acc']?.replace(/\*+/g, '*') ?? null;
}

/** The user's account the SMS is about, and the other side's when it names one. */
export function readAccounts(
  body: string,
  type: TxType,
): { account: string | null; counterAccount: string | null } {
  const own = numberIn(YOUR_ACCOUNT, body) ?? numberIn(YOUR_ACCOUNT_AM, body);
  if (type === 'debit') {
    return {
      account: own ?? numberIn(FROM_ACCOUNT, body),
      counterAccount: numberIn(TO_ACCOUNT, body),
    };
  }
  if (type === 'credit') return { account: own, counterAccount: numberIn(FROM_ACCOUNT, body) };
  return { account: own, counterAccount: null };
}

/** "1*6789" → "1…6789". */
export function formatAccount(account: string): string {
  return account.replace('*', '…');
}
