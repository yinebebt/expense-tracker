import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
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
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, settingsOutline } from 'ionicons/icons';
import { TxItemComponent } from '../../components/tx-item.component';
import { DAY, localDateValue } from '../../models/dates';
import { formatMinor } from '../../models/money';
import { CATEGORY_LABELS, Transaction } from '../../models/transaction.model';
import { TxDetailService } from '../../services/tx-detail.service';
import { SmsSyncService } from '../../services/sms-sync.service';
import { TransactionService } from '../../services/transaction.service';
import { DateRange, isCounted, monthRange, weekRange } from '../../summary/summary';

type Period = 'all' | 'week' | 'month' | 'last-month' | 'custom';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'custom', label: 'Pick dates…' },
];

/** "Today", "Yesterday", or the weekday and date. */
function dayLabel(day: number): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (day === today) return 'Today';
  if (day === today - DAY) return 'Yesterday';
  return new Date(day).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** "2026-10-23" from a date input, as local midnight. */
function parseDay(value: string): Date | null {
  const [y, m, d] = value.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

const shortDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

interface DayGroup {
  day: number;
  items: Transaction[];
  /** Counted debits only, so it matches the dashboard. */
  spentMinor: number;
}

@Component({
  selector: 'app-transactions',
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
    IonContent,
    IonFab,
    IonFabButton,
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
        <div class="search-row">
          <ion-searchbar
            placeholder="Search"
            [debounce]="200"
            [value]="query()"
            (ionInput)="query.set($any($event).detail.value ?? '')"
          />
          <ion-select
            [class.on]="period() !== 'all'"
            aria-label="Period"
            interface="popover"
            [value]="period()"
            [selectedText]="period() === 'custom' ? customLabel() : undefined"
            (ionChange)="setPeriod($any($event).detail.value)"
          >
            @for (p of periods; track p.value) {
              <ion-select-option [value]="p.value">{{ p.label }}</ion-select-option>
            }
          </ion-select>
        </div>
        @if (period() === 'custom') {
          <div class="dates">
            <label>
              From
              <input type="date" [value]="from()" (change)="from.set($any($event.target).value)" />
            </label>
            <label>
              To
              <input type="date" [value]="to()" (change)="to.set($any($event.target).value)" />
            </label>
          </div>
        }
      </ion-toolbar>
      @if (sync.syncing()) {
        <ion-progress-bar type="indeterminate" />
      }
    </ion-header>

    <ion-content>
      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button aria-label="Add transaction" (click)="txDetail.add()">
          <ion-icon name="add" />
        </ion-fab-button>
      </ion-fab>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>
      @if (matched().length) {
        <div class="totals" role="group" aria-label="Money in or out">
          <button
            type="button"
            [class.on]="flow() === null"
            [attr.aria-pressed]="flow() === null"
            (click)="flow.set(null)"
          >
            {{ totals().count }} {{ totals().count === 1 ? 'transaction' : 'transactions' }}
          </button>
          @if (totals().spent || flow() === 'debit') {
            ·
            <button
              type="button"
              [class.on]="flow() === 'debit'"
              [attr.aria-pressed]="flow() === 'debit'"
              (click)="toggleFlow('debit')"
            >
              out {{ fmt(totals().spent) }}
            </button>
          }
          @if (totals().received || flow() === 'credit') {
            ·
            <button
              type="button"
              [class.on]="flow() === 'credit'"
              [attr.aria-pressed]="flow() === 'credit'"
              (click)="toggleFlow('credit')"
            >
              in {{ fmt(totals().received) }}
            </button>
          }
        </div>
      }
      @if (groups().length) {
        <ion-list>
          @for (g of groups(); track g.day) {
            <ion-item-group>
              <ion-item-divider sticky>
                <ion-label>{{ dayLabel(g.day) }}</ion-label>
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
          } @else if (filtering()) {
            <p>Nothing matches these filters.</p>
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
    .dates {
      display: flex;
      gap: 12px;
      padding: 0 16px 8px;
    }
    .dates label {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      font-size: 0.8rem;
      color: var(--viz-muted);
    }
    .dates input {
      padding: 6px 8px;
      border: 1px solid var(--viz-baseline);
      border-radius: 8px;
      background: none;
      color: var(--ion-text-color);
      font: inherit;
      font-size: 0.95rem;
    }
    .totals {
      padding: 10px 16px 4px;
      font-size: 0.85rem;
      color: var(--viz-muted);
      font-variant-numeric: tabular-nums;
    }
    /* Each part of the totals line filters to it; the chosen one reads as selected. */
    .totals button {
      padding: 2px 0;
      border: none;
      border-bottom: 2px solid transparent;
      background: none;
      color: inherit;
      font: inherit;
    }
    .totals button.on {
      border-bottom-color: var(--ion-color-primary);
      color: var(--ion-text-color);
      font-weight: 600;
    }
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
  protected readonly periods = PERIODS;
  protected readonly period = signal<Period>('all');
  /** "Pick dates" bounds as date-input values; either can be empty. */
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly flow = signal<'debit' | 'credit' | null>(null);
  protected readonly fmt = formatMinor;
  protected readonly dayLabel = dayLabel;

  protected readonly filtering = computed(
    () => !!this.query().trim() || this.range() !== null || this.flow() !== null,
  );

  /** What the period dropdown reads once dates are picked: "3 Oct – 20 Oct". */
  protected readonly customLabel = computed(() => {
    const from = parseDay(this.from());
    const to = parseDay(this.to());
    if (from && to) return `${shortDate(from)} – ${shortDate(to)}`;
    if (from) return `From ${shortDate(from)}`;
    if (to) return `Until ${shortDate(to)}`;
    return undefined;
  });

  private readonly range = computed<DateRange | null>(() => {
    const now = new Date();
    switch (this.period()) {
      case 'week':
        return weekRange(now);
      case 'month':
        return monthRange(now);
      case 'last-month':
        return monthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      case 'custom': {
        const from = parseDay(this.from());
        const to = parseDay(this.to());
        if (!from && !to) return null;
        return {
          start: from ?? new Date(0),
          end: to ? new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1) : new Date(8.64e15),
        };
      }
      default:
        return null;
    }
  });

  /** Search and period applied, before money in/out, so the totals line can offer both. */
  protected readonly matched = computed(() => {
    const q = this.query().trim().toLowerCase();
    const r = this.range();
    return this.txService
      .transactions()
      .filter(
        (t) =>
          (!q || this.searchText(t).includes(q)) &&
          (!r || (t.occurredAt >= r.start.getTime() && t.occurredAt < r.end.getTime())),
      );
  });

  protected readonly groups = computed<DayGroup[]>(() => {
    const flow = this.flow();
    const groups: DayGroup[] = [];
    for (const t of this.matched()) {
      if (flow && t.type !== flow) continue;
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

  /** What search and period match, counted the way the dashboard counts. */
  protected readonly totals = computed(() => {
    let spent = 0;
    let received = 0;
    for (const t of this.matched()) {
      if (!isCounted(t)) continue;
      if (t.type === 'debit') spent += t.amountMinor!;
      else if (t.type === 'credit') received += t.amountMinor!;
    }
    return { count: this.matched().length, spent, received };
  });

  constructor() {
    addIcons({ add, settingsOutline });
    // Payees and the Dashboard link here with ?q=<text>, and ?period=month for this month's
    // categories. A link replaces whatever filters were set.
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const q = params.get('q');
        if (q === null) return;
        this.query.set(q);
        this.period.set(params.get('period') === 'month' ? 'month' : 'all');
        this.flow.set(null);
      });
  }

  /** Picking dates starts both bounds on today, so the list isn't empty before a date is set. */
  protected setPeriod(p: Period): void {
    if (p === 'custom') {
      const today = localDateValue(Date.now());
      if (!this.from()) this.from.set(today);
      if (!this.to()) this.to.set(today);
    }
    this.period.set(p);
  }

  protected toggleFlow(f: 'debit' | 'credit'): void {
    this.flow.set(this.flow() === f ? null : f);
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
