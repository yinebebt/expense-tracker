import { inject, Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Transaction } from '../models/transaction.model';

/** Opens the small dialogs: a transaction's detail, adding one by hand, and typing in a balance. */
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

  /** `account` preselects the account, e.g. the row that was tapped. */
  async editBalance(account: string | null = null): Promise<void> {
    const { BalanceEditComponent } = await import('../components/balance-edit.component');
    const modal = await this.modals.create({
      component: BalanceEditComponent,
      componentProps: { account },
      cssClass: 'dialog',
    });
    await modal.present();
  }
}
