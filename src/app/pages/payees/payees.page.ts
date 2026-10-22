import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonRouterLink,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { settingsOutline } from 'ionicons/icons';
import { formatMinor } from '../../models/money';
import { CATEGORY_LABELS } from '../../models/transaction.model';
import { TransactionService } from '../../services/transaction.service';
import { PayeeSummary } from '../../summary/payees';

type Filter = 'all' | 'frequent';

const FREQUENT = 5;

@Component({
  selector: 'app-payees',
  imports: [
    RouterLink,
    IonRouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonNote,
  ],
  templateUrl: './payees.page.html',
  styleUrl: './payees.page.scss',
})
export class PayeesPage {
  private readonly txService = inject(TransactionService);
  private readonly modals = inject(ModalController);

  protected readonly frequent = FREQUENT;
  protected readonly filter = signal<Filter>('all');
  protected readonly fmt = formatMinor;

  private readonly split = computed(() => {
    const min = this.filter() === 'frequent' ? FREQUENT : 1;
    const people: PayeeSummary[] = [];
    const ownAccounts: PayeeSummary[] = [];
    for (const p of this.txService.payees()) {
      if (p.count < min) continue;
      (this.categoryOf(p) === 'transfers' ? ownAccounts : people).push(p);
    }
    return { people, ownAccounts };
  });

  /** People and businesses: where the money actually goes. */
  protected readonly payees = computed(() => this.split().people);
  /** The user's own accounts, kept apart because moving money between them isn't spending. */
  protected readonly ownAccounts = computed(() => this.split().ownAccounts);

  protected readonly hasAny = computed(() => this.txService.payees().length > 0);

  constructor() {
    addIcons({ settingsOutline });
  }

  protected categoryLabel(p: PayeeSummary): string {
    const c = this.categoryOf(p);
    return c ? CATEGORY_LABELS[c] : '';
  }

  private categoryOf(p: PayeeSummary) {
    return this.txService.payeeRule(p.name) ?? p.category;
  }

  protected isRuled(p: PayeeSummary): boolean {
    return this.txService.payeeRule(p.name) !== null;
  }

  protected async open(p: PayeeSummary): Promise<void> {
    const { PayeeDetailComponent } = await import('../../components/payee-detail.component');
    const modal = await this.modals.create({
      component: PayeeDetailComponent,
      componentProps: { payeeKey: p.key },
      cssClass: 'dialog',
    });
    await modal.present();
  }
}
