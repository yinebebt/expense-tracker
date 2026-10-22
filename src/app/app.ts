import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { SmsSyncService } from './services/sms-sync.service';
import { TransactionService } from './services/transaction.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  template: `<ion-app><ion-router-outlet /></ion-app>`,
})
export class App {
  private readonly txService = inject(TransactionService);
  private readonly smsSync = inject(SmsSyncService);

  constructor() {
    this.init().catch((err) => console.error('Startup failed', err));
  }

  private async init(): Promise<void> {
    await this.txService.load();
    await this.smsSync.start();
  }
}
