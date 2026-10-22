import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ActionSheetController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItemDivider,
  IonItemGroup,
  IonLabel,
  IonList,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonRouterLink,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { settingsOutline } from 'ionicons/icons';
import { TxItemComponent } from '../../components/tx-item.component';
import { formatMinor } from '../../models/money';
import { CATEGORIES, CATEGORY_LABELS, Transaction } from '../../models/transaction.model';
import { SmsSyncService } from '../../services/sms-sync.service';
import { TransactionService } from '../../services/transaction.service';

interface DayGroup {
  day: number;
  items: Transaction[];
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
              </ion-item-divider>
              @for (t of g.items; track t.id) {
                <app-tx-item [tx]="t" [clickable]="true" (picked)="changeCategory($event)" />
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
    .empty {
      padding: 48px 24px;
      text-align: center;
      color: var(--ion-color-medium);
    }
  `,
})
export class TransactionsPage {
  private readonly txService = inject(TransactionService);
  private readonly sheets = inject(ActionSheetController);
  private readonly toasts = inject(ToastController);
  protected readonly sync = inject(SmsSyncService);

  protected readonly query = signal('');

  protected readonly groups = computed<DayGroup[]>(() => {
    const q = this.query().trim().toLowerCase();
    const groups: DayGroup[] = [];
    for (const t of this.txService.transactions()) {
      if (q && !this.searchText(t).includes(q)) continue;
      const d = new Date(t.occurredAt);
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const last = groups.at(-1);
      if (last?.day === day) last.items.push(t);
      else groups.push({ day, items: [t] });
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

  protected async changeCategory(t: Transaction): Promise<void> {
    const rawText = t.rawText;
    const copy = rawText
      ? [{ text: 'Copy message text', handler: () => void this.copy(rawText) }]
      : [];
    const sheet = await this.sheets.create({
      header: t.merchant ?? t.source,
      subHeader: t.needsReview ? (rawText ?? 'Needs review') : 'Change category',
      buttons: [
        ...copy,
        ...CATEGORIES.map((c) => ({
          text: CATEGORY_LABELS[c] + (c === t.category ? ' ✓' : ''),
          handler: () => {
            this.txService
              .setCategory(t.id, c)
              .catch((err) => console.error('Updating category failed', err));
          },
        })),
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  /** For sending an unrecognised message to whoever maintains the parsing rules. */
  private async copy(text: string): Promise<void> {
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older WebViews: fall back to a hidden textarea.
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      ok = document.execCommand('copy');
      el.remove();
    }
    const toast = await this.toasts.create({
      message: ok ? 'Copied. Remove names and account numbers before sending it.' : 'Copy failed',
      duration: 3000,
    });
    await toast.present();
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
