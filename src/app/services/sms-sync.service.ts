import { inject, Injectable, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { knownSenders } from '../parsing/sms-parser';
import { DatabaseService } from './database.service';
import { SmsAccess, SmsReaderService } from './sms-reader.service';
import { ImportResult, TransactionService } from './transaction.service';

/** How far back the first import (and a full re-import) reads, when no custom start is set. */
export const IMPORT_WINDOW_DAYS = 90;
const DAY = 86_400_000;
const LAST_SMS_KEY = 'last_sms_date';
const IMPORT_START_KEY = 'import_start_date';

export interface SyncResult extends ImportResult {
  at: number;
}

/**
 * Where a sync starts reading. Inclusive of the last seen message's time, so a
 * message sharing that millisecond isn't skipped; dedup drops the repeat.
 * `importStart` is the user's chosen cutoff (e.g. "today"); it only matters
 * before the first message has ever been seen, falling back to the window.
 */
export function syncStart(lastSmsDate: number | null, now: number, importStart: number | null = null): number {
  return lastSmsDate ?? importStart ?? now - IMPORT_WINDOW_DAYS * DAY;
}

/** Keeps stored transactions in step with the SMS inbox. */
@Injectable({ providedIn: 'root' })
export class SmsSyncService {
  private readonly reader = inject(SmsReaderService);
  private readonly txService = inject(TransactionService);
  private readonly db = inject(DatabaseService);

  readonly access = signal<SmsAccess | null>(null);
  readonly syncing = signal(false);
  readonly lastResult = signal<SyncResult | null>(null);
  readonly error = signal<string | null>(null);
  /** User-chosen cutoff for the first import, or null for the default window. */
  readonly importStart = signal<number | null>(null);

  private running?: Promise<void>;
  private again = false;
  private watching = false;
  private changeTimer?: ReturnType<typeof setTimeout>;

  /** Call once after the database is loaded. Syncs now, on every resume, and when new SMS arrive. */
  async start(): Promise<void> {
    await App.addListener('resume', () => void this.refresh());
    this.importStart.set(await this.loadImportStart());
    await this.refresh();
  }

  /**
   * Sets (or clears, with null) the cutoff the first import and a reimport read from.
   * Moving it later also drops already-imported SMS transactions before it, since the
   * point is to not carry that data in the app; moving it earlier just widens future
   * reads — use reimport() to pull in the newly-included older messages. The phone's
   * SMS inbox itself is never touched.
   */
  async setImportStart(date: number | null): Promise<void> {
    await this.db.setMeta(IMPORT_START_KEY, date === null ? null : String(date));
    this.importStart.set(date);
    if (date !== null) await this.txService.deleteSmsBefore(date);
  }

  async requestAccess(): Promise<void> {
    this.access.set(await this.reader.requestAccess());
    if (this.access() === 'granted') await this.onGranted();
  }

  openAppSettings(): Promise<void> {
    return this.reader.openAppSettings();
  }

  /** Reads new messages since the last sync. Concurrent calls join the running sync and trigger one more pass. */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.syncOnce();
      } while (this.again);
    })().finally(() => (this.running = undefined));
    return this.running;
  }

  /** Forgets the sync position and re-reads from the import window (or custom start). Stored rows and manual categories stay. */
  async reimport(): Promise<void> {
    await this.db.setMeta(LAST_SMS_KEY, null);
    await this.sync();
  }

  private async refresh(): Promise<void> {
    try {
      this.access.set(await this.reader.access());
      if (this.access() === 'granted') await this.onGranted();
    } catch (err) {
      this.fail('Checking SMS access failed', err);
    }
  }

  private async onGranted(): Promise<void> {
    if (!this.watching) {
      this.watching = true;
      await this.reader.watch(() => {
        // One SMS can fire several change events; sync once they settle.
        clearTimeout(this.changeTimer);
        this.changeTimer = setTimeout(() => void this.sync(), 1000);
      });
    }
    await this.sync();
  }

  private async syncOnce(): Promise<void> {
    this.syncing.set(true);
    this.error.set(null);
    try {
      const last = await this.db.getMeta(LAST_SMS_KEY);
      const since = syncStart(last === null ? null : Number(last), Date.now(), this.importStart());
      const messages = await this.reader.read(knownSenders(), since);
      const result = await this.txService.importMessages(messages);
      if (messages.length) {
        const newest = messages.reduce((max, m) => Math.max(max, m.date), since);
        await this.db.setMeta(LAST_SMS_KEY, String(newest));
      }
      this.lastResult.set({ ...result, at: Date.now() });
    } catch (err) {
      this.fail('Reading SMS failed', err);
    } finally {
      this.syncing.set(false);
    }
  }

  private async loadImportStart(): Promise<number | null> {
    const v = await this.db.getMeta(IMPORT_START_KEY);
    return v === null ? null : Number(v);
  }

  private fail(context: string, err: unknown): void {
    console.error(context, err);
    this.error.set(`${context}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
