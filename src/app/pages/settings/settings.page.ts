import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { App } from '@capacitor/app';
import {
  AlertController,
  IonBackButton,
  IonButtons,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonProgressBar,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { downloadOutline, refresh, trashOutline } from 'ionicons/icons';
import { SOURCES } from '../../parsing/rules';
import { ExportService } from '../../services/export.service';
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
    IonProgressBar,
    IonButton,
    IonIcon,
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  private readonly txService = inject(TransactionService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly exporter = inject(ExportService);
  protected readonly sync = inject(SmsSyncService);

  protected readonly windowDays = IMPORT_WINDOW_DAYS;
  protected readonly supported = SOURCES.map((s) => s.source);
  protected readonly showSupported = signal(false);
  protected readonly count = computed(() => this.txService.transactions().length);
  protected readonly busy = signal(false);
  protected readonly version = signal('');

  protected readonly accessText = computed(() => {
    const a = this.sync.access();
    return a ? ACCESS_TEXT[a] : null;
  });

  constructor() {
    addIcons({ refresh, downloadOutline, trashOutline });
    App.getInfo()
      .then((info) => this.version.set(`${info.version} (${info.build})`))
      .catch(() => this.version.set('browser build'));
  }

  protected async exportCsv(): Promise<void> {
    this.busy.set(true);
    let message: string;
    try {
      const res = await this.exporter.exportCsv();
      message = 'savedAs' in res ? `Saved to ${res.savedAs}` : 'Exported';
    } catch (err) {
      console.error('Export failed', err);
      message = 'Export failed';
    } finally {
      this.busy.set(false);
    }
    const toast = await this.toasts.create({ message, duration: 3000 });
    await toast.present();
  }

  protected async confirmClear(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Delete all transactions?',
      message: `Transactions added by hand are deleted too; SMS ones come back on the next check (last ${IMPORT_WINDOW_DAYS} days). Payee categories and balances you typed in are kept.`,
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
