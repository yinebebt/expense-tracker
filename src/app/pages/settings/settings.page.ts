import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { App } from '@capacitor/app';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { SOURCES } from '../../parsing/rules';
import { SenderCount } from '../../services/sms-reader.service';
import { IMPORT_WINDOW_DAYS, SmsSyncService } from '../../services/sms-sync.service';
import { TransactionService } from '../../services/transaction.service';

const ACCESS_TEXT = {
  granted: ['Allowed', 'success'],
  prompt: ['Not allowed yet', 'warning'],
  denied: ['Blocked', 'danger'],
  unavailable: ['Android only', 'medium'],
} as const;

@Component({
  selector: 'app-settings',
  imports: [
    DatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonNote,
    IonButton,
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  private readonly txService = inject(TransactionService);
  private readonly alerts = inject(AlertController);
  protected readonly sync = inject(SmsSyncService);

  protected readonly windowDays = IMPORT_WINDOW_DAYS;
  protected readonly supported = SOURCES.map((s) => s.source).join(', ');
  protected readonly count = computed(() => this.txService.transactions().length);
  protected readonly busy = signal(false);
  protected readonly version = signal('');
  protected readonly otherSenders = signal<SenderCount[] | null>(null);

  protected readonly accessText = computed(() => {
    const a = this.sync.access();
    return a ? ACCESS_TEXT[a] : null;
  });

  /** Stored transactions per source, only for sources that have any. */
  protected readonly sourceCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const t of this.txService.transactions())
      counts.set(t.source, (counts.get(t.source) ?? 0) + 1);
    return [...counts].map(([source, n]) => `${source} ${n}`).join(' · ');
  });

  constructor() {
    App.getInfo()
      .then((info) => this.version.set(`${info.version} (${info.build})`))
      .catch(() => this.version.set('browser build'));
  }

  protected async showOtherSenders(): Promise<void> {
    this.busy.set(true);
    try {
      this.otherSenders.set(await this.sync.otherSenders());
    } catch (err) {
      console.error('Listing senders failed', err);
      this.otherSenders.set([]);
    } finally {
      this.busy.set(false);
    }
  }

  protected async confirmClear(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Delete all transactions?',
      message: `This removes all stored transactions. The next check re-reads the last ${IMPORT_WINDOW_DAYS} days of SMS still in your inbox. Categories set on a payee are kept; changes to single transactions are lost.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => this.clear() },
      ],
    });
    await alert.present();
  }

  private async clear(): Promise<void> {
    this.busy.set(true);
    try {
      await this.txService.clear();
    } finally {
      this.busy.set(false);
    }
  }
}
