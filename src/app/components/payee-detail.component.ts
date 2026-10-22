import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonSelect, IonSelectOption, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { formatMinor } from '../models/money';
import { CATEGORIES, Category, CATEGORY_LABELS } from '../models/transaction.model';
import { TransactionService } from '../services/transaction.service';

/** One payee in a small dialog: totals and the category for all their transactions. */
@Component({
  selector: 'app-payee-detail',
  imports: [IonContent, IonIcon, IonSelect, IonSelectOption],
  template: `
    <ion-content>
      @if (payee(); as p) {
        <div class="top">
          <span>{{ category() === 'transfers' ? 'Your account' : 'Payee' }}</span>
          <button type="button" class="close" aria-label="Close" (click)="close()">
            <ion-icon name="close" />
          </button>
        </div>
        <div class="name">{{ p.name }}</div>
        <div class="why">{{ p.count }} {{ p.count === 1 ? 'transaction' : 'transactions' }}</div>

        <dl class="facts">
          <dt>Category</dt>
          <dd>
            <ion-select
              aria-label="Category"
              interface="popover"
              placeholder="Unclassified"
              [value]="category()"
              (ionChange)="setCategory($any($event).detail.value)"
            >
              @for (c of categories; track c) {
                <ion-select-option [value]="c">{{ labels[c] }}</ion-select-option>
              }
            </ion-select>
          </dd>
          @if (p.paidMinor) {
            <dt>Paid</dt>
            <dd>{{ fmt(p.paidMinor) }}</dd>
          }
          @if (p.receivedMinor) {
            <dt>Received</dt>
            <dd>{{ fmt(p.receivedMinor) }}</dd>
          }
        </dl>
        <p class="hint">The category applies to all their transactions, and to new ones.</p>

        <button type="button" class="link" (click)="showTransactions(p.name)">
          Show transactions
        </button>
      }
    </ion-content>
  `,
  styles: `
    .name {
      font-size: 1.35rem;
      font-weight: 600;
      line-height: 1.25;
    }
    .hint {
      margin: 4px 0 16px;
      font-size: 0.8rem;
      color: var(--viz-muted);
    }
  `,
})
export class PayeeDetailComponent implements OnInit {
  /** Set through the modal's componentProps. */
  payeeKey = '';

  private readonly modal = inject(ModalController);
  private readonly router = inject(Router);
  private readonly txService = inject(TransactionService);

  protected readonly categories = CATEGORIES;
  protected readonly labels = CATEGORY_LABELS;
  protected readonly fmt = formatMinor;

  private readonly key = signal('');
  /** Live, so a category change shows straight away. */
  protected readonly payee = computed(() =>
    this.txService.payees().find((p) => p.key === this.key()),
  );
  /** The payee's rule if one is set, otherwise their most common category. */
  protected readonly category = computed(() => {
    const p = this.payee();
    return p ? (this.txService.payeeRule(p.name) ?? p.category) : null;
  });

  constructor() {
    addIcons({ close });
  }

  ngOnInit(): void {
    this.key.set(this.payeeKey);
  }

  protected close(): void {
    void this.modal.dismiss();
  }

  protected setCategory(c: Category): void {
    const p = this.payee();
    if (!p || !c || c === this.txService.payeeRule(p.name)) return;
    this.txService
      .setPayeeCategory(p.name, c)
      .catch((err) => console.error('Setting payee category failed', err));
  }

  protected async showTransactions(name: string): Promise<void> {
    await this.modal.dismiss();
    await this.router.navigate(['/tabs/transactions'], { queryParams: { q: name } });
  }
}
