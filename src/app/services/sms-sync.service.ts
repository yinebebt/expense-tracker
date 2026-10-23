import { inject, Injectable, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { knownSenders } from '../parsing/sms-parser';
import { DatabaseService } from './database.service';
import { SmsAccess, SmsReaderService } from './sms-reader.service';
import { ImportResult, TransactionService } from './transaction.service';

/** How far back the first import (and a full re-import) reads. */
export const IMPORT_WINDOW_DAYS = 90;
const DAY = 86_400_000;
const LAST_SMS_KEY = 'last_sms_date';

export interface SyncResult extends ImportResult {
  at: number;
}

/**
 * Where a sync starts reading. Inclusive of the last seen message's time, so a
 * message sharing that millisecond isn't skipped; dedup drops the repeat.
 */
export function syncStart(lastSmsDate: number | null, now: number): number {
  return lastSmsDate ?? now - IMPORT_WINDOW_DAYS * DAY;
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

  private running?: Promise<void>;
  private again = false;
  private watching = false;
  private changeTimer?: ReturnType<typeof setTimeout>;

  /** Call once after the database is loaded. Syncs now, on every resume, and when new SMS arrive. */
  async start(): Promise<void> {
    await App.addListener('resume', () => void this.refresh());
    await this.refresh();
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

  /** Forgets the sync position and reads the whole import window again. Stored rows and manual categories stay. */
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
      const since = syncStart(last === null ? null : Number(last), Date.now());
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

  private fail(context: string, err: unknown): void {
    console.error(context, err);
    this.error.set(`${context}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
