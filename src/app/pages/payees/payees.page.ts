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
  IonSearchbar,
  IonSelect,
  IonSelectOption,
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

type Sort = 'frequent' | 'paid' | 'received' | 'recent' | 'name';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'frequent', label: 'Most frequent' },
  { value: 'paid', label: 'Most paid' },
  { value: 'received', label: 'Most received' },
  { value: 'recent', label: 'Recent' },
  { value: 'name', label: 'A–Z' },
];

const COMPARE: Record<Sort, (a: PayeeSummary, b: PayeeSummary) => number> = {
  // groupByPayee already orders by frequency.
  frequent: () => 0,
  paid: (a, b) => b.paidMinor - a.paidMinor,
  received: (a, b) => b.receivedMinor - a.receivedMinor,
  recent: (a, b) => b.latest - a.latest,
  name: (a, b) => a.name.localeCompare(b.name),
};

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
    IonSearchbar,
    IonSelect,
    IonSelectOption,
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

  protected readonly sorts = SORTS;
  protected readonly sort = signal<Sort>('frequent');
  protected readonly query = signal('');
  protected readonly fmt = formatMinor;

  private readonly split = computed(() => {
    const q = this.query().trim().toLowerCase();
    const people: PayeeSummary[] = [];
    const ownAccounts: PayeeSummary[] = [];
    for (const p of this.txService.payees()) {
      if (q && !p.name.toLowerCase().includes(q)) continue;
      (this.categoryOf(p) === 'transfers' ? ownAccounts : people).push(p);
    }
    people.sort(COMPARE[this.sort()]);
    return { people, ownAccounts };
  });

  /** People and businesses: where the money actually goes. */
  protected readonly payees = computed(() => this.split().people);
  /** The user's own accounts, kept apart because moving money between them isn't spending. */
  protected readonly ownAccounts = computed(() => this.split().ownAccounts);

  /** Paid total across the listed people, shown next to the count. */
  protected readonly paidTotal = computed(() =>
    this.payees().reduce((sum, p) => sum + p.paidMinor, 0),
  );

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
