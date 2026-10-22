import { Injectable } from '@angular/core';
import { Capacitor, PermissionState, PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { RawSms } from '../models/transaction.model';

/** `denied` means Android won't show the prompt again; the user has to allow it in app settings. */
export type SmsAccess = 'granted' | 'prompt' | 'denied' | 'unavailable';

export interface SmsReader {
  access(): Promise<SmsAccess>;
  requestAccess(): Promise<SmsAccess>;
  /** Inbox messages from `senders` received at or after `since` (epoch ms), oldest first. */
  read(senders: string[], since: number): Promise<RawSms[]>;
  /** One message by inbox id, or null when it's gone or not from `senders`. */
  get(id: string, senders: string[]): Promise<RawSms | null>;
  /** Business-looking senders since `since` that aren't in `known`. Addresses only, no message text. */
  otherSenders(known: string[], since: number): Promise<SenderCount[]>;
  /** Calls `onChange` when the SMS store changes while the app runs. Returns a stop function. */
  watch(onChange: () => void): Promise<() => void>;
  openAppSettings(): Promise<void>;
}

export interface SenderCount {
  address: string;
  count: number;
}

// Native side: android/app/src/main/java/com/yinebebt/expenses/SmsInboxPlugin.kt
interface SmsInboxPlugin {
  checkPermissions(): Promise<{ sms: PermissionState }>;
  requestPermissions(): Promise<{ sms: PermissionState }>;
  list(options: { senders: string[]; since: number }): Promise<{ messages: RawSms[] }>;
  get(options: { id: string; senders: string[] }): Promise<{ message?: RawSms }>;
  otherSenders(options: { known: string[]; since: number }): Promise<{ senders: SenderCount[] }>;
  startWatching(): Promise<void>;
  addListener(event: 'smsChanged', fn: () => void): Promise<PluginListenerHandle>;
  openSettings(): Promise<void>;
}

const SmsInbox = registerPlugin<SmsInboxPlugin>('SmsInbox');

const toAccess = (s: PermissionState): SmsAccess =>
  s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt';

/** Android only. In the browser every method reports `unavailable` or returns nothing. */
@Injectable({ providedIn: 'root' })
export class SmsReaderService implements SmsReader {
  private readonly android = Capacitor.getPlatform() === 'android';

  async access(): Promise<SmsAccess> {
    if (!this.android) return 'unavailable';
    return toAccess((await SmsInbox.checkPermissions()).sms);
  }

  async requestAccess(): Promise<SmsAccess> {
    if (!this.android) return 'unavailable';
    return toAccess((await SmsInbox.requestPermissions()).sms);
  }

  async read(senders: string[], since: number): Promise<RawSms[]> {
    if (!this.android) return [];
    return (await SmsInbox.list({ senders, since })).messages;
  }

  async get(id: string, senders: string[]): Promise<RawSms | null> {
    if (!this.android) return null;
    return (await SmsInbox.get({ id, senders })).message ?? null;
  }

  async otherSenders(known: string[], since: number): Promise<SenderCount[]> {
    if (!this.android) return [];
    return (await SmsInbox.otherSenders({ known, since })).senders;
  }

  async watch(onChange: () => void): Promise<() => void> {
    if (!this.android) return () => {};
    const handle = await SmsInbox.addListener('smsChanged', onChange);
    await SmsInbox.startWatching();
    return () => void handle.remove();
  }

  async openAppSettings(): Promise<void> {
    if (this.android) await SmsInbox.openSettings();
  }
}
