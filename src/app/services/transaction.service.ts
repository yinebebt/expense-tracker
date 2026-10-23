import { computed, inject, Injectable, signal } from '@angular/core';
import {
  CASH,
  Category,
  isManual,
  ManualEntry,
  manualTransaction,
  RawSms,
  Transaction,
} from '../models/transaction.model';
import { parseSms, toTransaction } from '../parsing/sms-parser';
import { findSelfTransfers, SELF_TRANSFER_WINDOW_MS } from '../parsing/transfers';
import { accountBalances } from '../summary/balances';
import { groupByPayee, payeeKey, payeeRuleCategory } from '../summary/payees';
import { summarize } from '../summary/summary';
import { DatabaseService } from './database.service';

export interface ImportResult {
  read: number;
  ignored: number;
  inserted: number;
}

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly db = inject(DatabaseService);
  private readonly all = signal<Transaction[]>([]);
  private readonly manualBalances = signal(new Map<string, { balanceMinor: number; at: number }>());
  private rules = new Map<string, Category>();

  /** Newest first. */
  readonly transactions = this.all.asReadonly();
  readonly summary = computed(() => summarize(this.all()));
  readonly payees = computed(() => groupByPayee(this.all()));
  readonly balances = computed(() => accountBalances(this.all(), this.manualBalances()));
  /** Cash first, then every account with transactions or a balance, busiest first. */
  readonly accounts = computed(() => {
    const counts = new Map<string, number>();
    for (const t of this.all()) counts.set(t.source, (counts.get(t.source) ?? 0) + 1);
    for (const s of this.manualBalances().keys()) counts.set(s, counts.get(s) ?? 0);
    const seen = [...counts].sort((a, b) => b[1] - a[1]).map(([s]) => s);
    return [CASH, ...seen.filter((s) => s !== CASH)];
  });

  async load(): Promise<void> {
    const [txs, rules, balances] = await Promise.all([
      this.db.all(),
      this.db.payeeRules(),
      this.db.manualBalances(),
    ]);
    this.rules = rules;
    this.manualBalances.set(balances);
    this.all.set(txs);
  }

  /** Records an account's balance typed in by hand, e.g. Cash or a bank that sends no SMS. */
  async setBalance(source: string, balanceMinor: number, at: number): Promise<void> {
    await this.db.setManualBalance(source, balanceMinor, at);
    await this.load();
  }

  /** Parses and stores messages. Messages that were imported before are skipped by dedup key. */
  async importMessages(msgs: RawSms[]): Promise<ImportResult> {
    const now = Date.now();
    const rows: Transaction[] = [];
    const ignoredSmsIds: string[] = [];
    for (const sms of msgs) {
      const res = parseSms(sms);
      if (res.kind !== 'parsed') {
        if (sms.id) ignoredSmsIds.push(sms.id);
        continue;
      }
      const t = toTransaction(sms, res.tx, crypto.randomUUID(), now);
      const ruled = payeeRuleCategory(t, this.rules);
      if (ruled) {
        t.category = ruled;
        t.categoryManual = true;
      }
      rows.push(t);
    }

    // An ad or balance notice stored for review by an older parser goes away on re-read.
    await this.db.deleteReviews(ignoredSmsIds);
    const inserted = await this.db.insertMany(rows);
    if (rows.length) {
      const earliest = rows.reduce((min, r) => Math.min(min, r.occurredAt), Infinity);
      const pairs = findSelfTransfers(await this.db.since(earliest - SELF_TRANSFER_WINDOW_MS));
      await this.db.setCategories(pairs, 'transfers', false);
    }
    await this.load();
    return { read: msgs.length, ignored: msgs.length - rows.length, inserted };
  }

  async setCategory(id: string, category: Category): Promise<void> {
    await this.db.setCategory(id, category, true);
    await this.load();
  }

  /** Sets the category for every transaction with this payee, and for future ones. */
  async setPayeeCategory(name: string, category: Category): Promise<void> {
    const key = payeeKey(name);
    const rule = new Map([[key, category]]);
    const ids = this.all()
      .filter((t) => payeeRuleCategory(t, rule))
      .map((t) => t.id);
    await this.db.setPayeeRule(key, category);
    await this.db.setCategories(ids, category, true);
    await this.load();
  }

  /** The category set for a payee, if any. */
  payeeRule(name: string): Category | null {
    return this.rules.get(payeeKey(name)) ?? null;
  }

  async addManual(entry: ManualEntry): Promise<void> {
    await this.db.insertMany([manualTransaction(entry, crypto.randomUUID(), Date.now())]);
    await this.load();
  }

  /** Only rows added by hand can be deleted one by one; an SMS row would come back on re-read. */
  async deleteManual(t: Transaction): Promise<void> {
    if (!isManual(t)) return;
    await this.db.deleteOne(t.id);
    await this.load();
  }

  async clear(): Promise<void> {
    await this.db.clear();
    await this.load();
  }
}
