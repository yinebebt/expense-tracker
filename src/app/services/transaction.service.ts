import { computed, inject, Injectable, signal } from '@angular/core';
import {
  Category,
  isManual,
  ManualEntry,
  manualTransaction,
  RawSms,
  Transaction,
} from '../models/transaction.model';
import { parseSms, toTransaction } from '../parsing/sms-parser';
import { findSelfTransfers, SELF_TRANSFER_WINDOW_MS } from '../parsing/transfers';
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
  private rules = new Map<string, Category>();

  /** Newest first. */
  readonly transactions = this.all.asReadonly();
  readonly summary = computed(() => summarize(this.all()));
  readonly payees = computed(() => groupByPayee(this.all()));

  async load(): Promise<void> {
    const [txs, rules] = await Promise.all([this.db.all(), this.db.payeeRules()]);
    this.rules = rules;
    this.all.set(txs);
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
