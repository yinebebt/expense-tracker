import { inject, Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Transaction } from '../models/transaction.model';

/** Opens the transaction dialogs: the detail of a tapped row, and adding one by hand. */
@Injectable({ providedIn: 'root' })
export class TxDetailService {
  private readonly modals = inject(ModalController);

  async open(t: Transaction): Promise<void> {
    const { TxDetailComponent } = await import('../components/tx-detail.component');
    const modal = await this.modals.create({
      component: TxDetailComponent,
      componentProps: { txId: t.id },
      cssClass: 'dialog',
    });
    await modal.present();
  }

  async add(): Promise<void> {
    const { TxAddComponent } = await import('../components/tx-add.component');
    const modal = await this.modals.create({ component: TxAddComponent, cssClass: 'dialog' });
    await modal.present();
  }
}
