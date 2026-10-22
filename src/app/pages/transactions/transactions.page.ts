import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItemDivider,
  IonItemGroup,
  IonLabel,
  IonList,
  IonNote,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonRouterLink,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { settingsOutline } from 'ionicons/icons';
import { TxItemComponent } from '../../components/tx-item.component';
import { formatMinor } from '../../models/money';
import { CATEGORY_LABELS, Transaction } from '../../models/transaction.model';
import { TxDetailService } from '../../services/tx-detail.service';
import { SmsSyncService } from '../../services/sms-sync.service';
import { TransactionService } from '../../services/transaction.service';
import { isCounted } from '../../summary/summary';

interface DayGroup {
  day: number;
  items: Transaction[];
  /** Counted debits only, so it matches the dashboard. */
  spentMinor: number;
}

@Component({
  selector: 'app-transactions',
  imports: [
    DatePipe,
    RouterLink,
    IonRouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonSearchbar,
    IonContent,
    IonList,
    IonItemGroup,
    IonItemDivider,
    IonLabel,
    IonNote,
    IonProgressBar,
    IonRefresher,
    IonRefresherContent,
    TxItemComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Transactions</ion-title>
        <ion-buttons slot="end">
          <ion-button routerLink="/settings" aria-label="Settings">
            <ion-icon slot="icon-only" name="settings-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          placeholder="Search merchant, bank, category, amount"
          [debounce]="200"
          [value]="query()"
          (ionInput)="query.set($any($event).detail.value ?? '')"
        />
      </ion-toolbar>
      @if (sync.syncing()) {
        <ion-progress-bar type="indeterminate" />
      }
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>
      @if (groups().length) {
        <ion-list>
          @for (g of groups(); track g.day) {
            <ion-item-group>
              <ion-item-divider sticky>
                <ion-label>{{ g.day | date: 'EEEE d MMMM' }}</ion-label>
                @if (g.spentMinor) {
                  <ion-note slot="end" class="day-total">{{ fmt(g.spentMinor) }}</ion-note>
                }
              </ion-item-divider>
              @for (t of g.items; track t.id) {
                <app-tx-item
                  [tx]="t"
                  dateFormat="HH:mm"
                  [clickable]="true"
                  (picked)="txDetail.open($event)"
                />
              }
            </ion-item-group>
          }
        </ion-list>
      } @else {
        <div class="empty">
          @if (query()) {
            <p>Nothing matches “{{ query() }}”.</p>
          } @else {
            <h2>No transactions yet</h2>
            <p>
              They appear here once bank and telebirr SMS are read. See the Dashboard or Settings.
            </p>
          }
        </div>
      }
    </ion-content>
  `,
  styles: `
    .day-total {
      padding-inline-end: 16px;
      color: var(--ion-text-color);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class TransactionsPage {
  private readonly txService = inject(TransactionService);
  protected readonly txDetail = inject(TxDetailService);
  protected readonly sync = inject(SmsSyncService);

  protected readonly query = signal('');
  protected readonly fmt = formatMinor;

  protected readonly groups = computed<DayGroup[]>(() => {
    const q = this.query().trim().toLowerCase();
    const groups: DayGroup[] = [];
    for (const t of this.txService.transactions()) {
      if (q && !this.searchText(t).includes(q)) continue;
      const d = new Date(t.occurredAt);
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const spent = t.type === 'debit' && isCounted(t) ? t.amountMinor! : 0;
      const last = groups.at(-1);
      if (last?.day === day) {
        last.items.push(t);
        last.spentMinor += spent;
      } else groups.push({ day, items: [t], spentMinor: spent });
    }
    return groups;
  });

  constructor() {
    addIcons({ settingsOutline });
    // The Payees tab links here with ?q=<name> to show one payee's transactions.
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const q = params.get('q');
        if (q !== null) this.query.set(q);
      });
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.sync.sync();
    await event.target.complete();
  }

  private searchText(t: Transaction): string {
    return [
      t.merchant,
      t.source,
      t.category ? CATEGORY_LABELS[t.category] : 'unclassified',
      t.amountMinor !== null ? formatMinor(t.amountMinor) : '',
      t.amountMinor !== null ? String(t.amountMinor / 100) : '',
      t.needsReview ? 'review' : '',
    ]
      .join(' ')
      .toLowerCase();
  }
}
