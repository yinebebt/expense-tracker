import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { Category, Transaction, TxType } from '../models/transaction.model';

const DB_NAME = 'expenses';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  amount_minor INTEGER,
  currency TEXT NOT NULL DEFAULT 'ETB',
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit', 'unknown')),
  occurred_at INTEGER NOT NULL,
  merchant TEXT,
  reference TEXT,
  source TEXT NOT NULL,
  sms_id TEXT,
  dedup_key TEXT NOT NULL UNIQUE,
  category TEXT,
  category_manual INTEGER NOT NULL DEFAULT 0,
  needs_review INTEGER NOT NULL DEFAULT 0,
  raw_text TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions (occurred_at);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payee_rules (
  payee_key TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL
);
`;

const COLUMNS = [
  'id',
  'amount_minor',
  'currency',
  'type',
  'occurred_at',
  'merchant',
  'reference',
  'source',
  'sms_id',
  'dedup_key',
  'category',
  'category_manual',
  'needs_review',
  'raw_text',
  'created_at',
];

/**
 * A duplicate dedup key keeps the stored row but takes the newly parsed merchant, and
 * the new category unless the stored one was set by hand. Re-imports are safe, and a
 * re-read after a parser fix repairs old rows.
 */
export const INSERT_SQL = `INSERT INTO transactions (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})
ON CONFLICT (dedup_key) DO UPDATE SET
  merchant = excluded.merchant,
  category = CASE WHEN category_manual THEN category ELSE excluded.category END,
  category_manual = category_manual OR excluded.category_manual`;

const SUPERSEDED_REVIEW_SQL = `DELETE FROM transactions WHERE type = 'unknown' AND sms_id = ? AND source = ?`;

export function toRow(t: Transaction): unknown[] {
  return [
    t.id,
    t.amountMinor,
    t.currency,
    t.type,
    t.occurredAt,
    t.merchant,
    t.reference,
    t.source,
    t.smsId,
    t.dedupKey,
    t.category,
    t.categoryManual ? 1 : 0,
    t.needsReview ? 1 : 0,
    t.rawText,
    t.createdAt,
  ];
}

export function fromRow(r: Record<string, any>): Transaction {
  return {
    id: r['id'],
    amountMinor: r['amount_minor'] ?? null,
    currency: r['currency'],
    type: r['type'] as TxType,
    occurredAt: r['occurred_at'],
    merchant: r['merchant'] ?? null,
    reference: r['reference'] ?? null,
    source: r['source'],
    smsId: r['sms_id'] ?? null,
    dedupKey: r['dedup_key'],
    category: (r['category'] ?? null) as Category | null,
    categoryManual: r['category_manual'] === 1,
    needsReview: r['needs_review'] === 1,
    rawText: r['raw_text'] ?? null,
    createdAt: r['created_at'],
  };
}

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private readonly sqlite = new SQLiteConnection(CapacitorSQLite);
  private readonly isWeb = Capacitor.getPlatform() === 'web';
  private ready?: Promise<SQLiteDBConnection>;

  private conn(): Promise<SQLiteDBConnection> {
    return (this.ready ??= this.open());
  }

  private async open(): Promise<SQLiteDBConnection> {
    if (this.isWeb) {
      // Browser dev only: jeep-sqlite runs sql.js and loads assets/sql-wasm.wasm.
      const { defineCustomElements } = await import('jeep-sqlite/loader');
      defineCustomElements(window);
      document.body.appendChild(document.createElement('jeep-sqlite'));
      await customElements.whenDefined('jeep-sqlite');
      await this.sqlite.initWebStore();
    }
    const consistent = (await this.sqlite.checkConnectionsConsistency()).result;
    const exists = (await this.sqlite.isConnection(DB_NAME, false)).result;
    const db =
      consistent && exists
        ? await this.sqlite.retrieveConnection(DB_NAME, false)
        : await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    await db.open();
    await db.execute(SCHEMA);
    return db;
  }

  /** Returns how many rows were actually added. */
  /**
   * Upserts rows and returns how many the table grew by. A row the parser now understands
   * replaces the review row stored earlier for the same SMS: the type is part of the dedup
   * key, so without this a re-read would keep both.
   */
  async insertMany(txs: Transaction[]): Promise<number> {
    if (!txs.length) return 0;
    const db = await this.conn();
    const before = await this.count(db);
    const superseded = txs
      .filter((t) => t.type !== 'unknown' && t.smsId)
      .map((t) => ({ statement: SUPERSEDED_REVIEW_SQL, values: [t.smsId, t.source] }));
    await db.executeSet(
      [...superseded, ...txs.map((t) => ({ statement: INSERT_SQL, values: toRow(t) }))],
      true,
    );
    await this.persist();
    return Math.max(0, (await this.count(db)) - before);
  }

  /** Removes review rows stored for these SMS. Parsed rows are never touched. */
  async deleteReviews(smsIds: string[]): Promise<void> {
    if (!smsIds.length) return;
    const db = await this.conn();
    await db.executeSet(
      smsIds.map((id) => ({
        statement: `DELETE FROM transactions WHERE type = 'unknown' AND sms_id = ?`,
        values: [id],
      })),
      true,
    );
    await this.persist();
  }

  async all(): Promise<Transaction[]> {
    const db = await this.conn();
    const res = await db.query('SELECT * FROM transactions ORDER BY occurred_at DESC');
    return (res.values ?? []).map(fromRow);
  }

  async since(from: number): Promise<Transaction[]> {
    const db = await this.conn();
    const res = await db.query(
      'SELECT * FROM transactions WHERE occurred_at >= ? ORDER BY occurred_at',
      [from],
    );
    return (res.values ?? []).map(fromRow);
  }

  async setCategory(id: string, category: Category, manual: boolean): Promise<void> {
    const db = await this.conn();
    await db.run('UPDATE transactions SET category = ?, category_manual = ? WHERE id = ?', [
      category,
      manual ? 1 : 0,
      id,
    ]);
    await this.persist();
  }

  async setCategories(ids: string[], category: Category, manual: boolean): Promise<void> {
    if (!ids.length) return;
    const db = await this.conn();
    await db.executeSet(
      ids.map((id) => ({
        statement: 'UPDATE transactions SET category = ?, category_manual = ? WHERE id = ?',
        values: [category, manual ? 1 : 0, id],
      })),
      true,
    );
    await this.persist();
  }

  async payeeRules(): Promise<Map<string, Category>> {
    const db = await this.conn();
    const res = await db.query('SELECT payee_key, category FROM payee_rules');
    return new Map((res.values ?? []).map((r) => [r.payee_key, r.category as Category]));
  }

  async setPayeeRule(payeeKey: string, category: Category): Promise<void> {
    const db = await this.conn();
    await db.run('INSERT OR REPLACE INTO payee_rules (payee_key, category) VALUES (?, ?)', [
      payeeKey,
      category,
    ]);
    await this.persist();
  }

  /** Removes all transactions and sync state, so the next sync starts from scratch. Payee rules stay. */
  async clear(): Promise<void> {
    const db = await this.conn();
    await db.execute('DELETE FROM transactions; DELETE FROM meta;');
    await this.persist();
  }

  async getMeta(key: string): Promise<string | null> {
    const db = await this.conn();
    const res = await db.query('SELECT value FROM meta WHERE key = ?', [key]);
    return res.values?.[0]?.value ?? null;
  }

  async setMeta(key: string, value: string | null): Promise<void> {
    const db = await this.conn();
    if (value === null) await db.run('DELETE FROM meta WHERE key = ?', [key]);
    else await db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
    await this.persist();
  }

  private async count(db: SQLiteDBConnection): Promise<number> {
    const res = await db.query('SELECT COUNT(*) AS n FROM transactions');
    return res.values?.[0]?.n ?? 0;
  }

  private async persist(): Promise<void> {
    if (this.isWeb) await this.sqlite.saveToStore(DB_NAME);
  }
}
