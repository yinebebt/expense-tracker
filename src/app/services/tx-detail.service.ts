import { inject, Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Transaction } from '../models/transaction.model';

/** Opens the detail dialog for a tapped transaction row. */
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
}
