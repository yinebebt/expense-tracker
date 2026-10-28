import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonNote,
  IonList,
  IonListHeader,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonRouterLink,
  IonSegment,
  IonSegmentButton,
  IonSegmentContent,
  IonSegmentView,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  chevronBackOutline,
  chevronForwardOutline,
  eyeOffOutline,
  eyeOutline,
  settingsOutline,
  swapHorizontalOutline,
} from 'ionicons/icons';
import { CategoryBarComponent } from '../../components/category-bar.component';
import { TxItemComponent } from '../../components/tx-item.component';
import { WeekChartComponent } from '../../components/week-chart.component';
import { DAY } from '../../models/dates';
import { formatMinor } from '../../models/money';
import { Category, CATEGORY_LABELS } from '../../models/transaction.model';
import { TxDetailService } from '../../services/tx-detail.service';
import { SmsSyncService } from '../../services/sms-sync.service';
import { TransactionService } from '../../services/transaction.service';
import { dayRange, spentIn, weekRange, weekSummary } from '../../summary/summary';

const HIDE_AMOUNT_KEY = 'dashboard.hideAmount';

type View = 'expenses' | 'accounts' | 'summary';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-dashboard',
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
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonProgressBar,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSegmentView,
    IonSegmentContent,
    TxItemComponent,
    WeekChartComponent,
    CategoryBarComponent,
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private readonly txService = inject(TransactionService);
  private readonly router = inject(Router);
  protected readonly sync = inject(SmsSyncService);
  protected readonly txDetail = inject(TxDetailService);

  protected readonly s = this.txService.summary;
  protected readonly hasData = computed(() => this.txService.transactions().length > 0);
  protected readonly reviewCount = computed(
    () => this.txService.transactions().filter((t) => t.needsReview).length,
  );
  protected readonly balances = this.txService.balances;
  protected readonly balanceTotal = computed(() =>
    this.balances().reduce((sum, b) => sum + b.balanceMinor, 0),
  );
  /** The day picked in the week chart, at local midnight; null means today. The chart shows its week. */
  protected readonly picked = signal<Date | null>(null);
  protected readonly pickedDay = computed(() => this.picked() ?? this.s().today.start);
  protected readonly week = computed(() =>
    weekSummary(this.txService.transactions(), this.pickedDay()),
  );
  protected readonly pickedIndex = computed(() =>
    this.week().days.findIndex((d) => d.day.getTime() === this.pickedDay().getTime()),
  );
  protected readonly pickedTotal = computed(() => this.week().days[this.pickedIndex()].spentMinor);
  protected readonly pickedSpent = computed(() =>
    spentIn(this.txService.transactions(), dayRange(this.pickedDay())),
  );
  /** Days from the picked day to today; negative for later days this week. */
  private readonly daysAgo = computed(() =>
    Math.round((this.s().today.start.getTime() - this.pickedDay().getTime()) / DAY),
  );
  /** "Today" or "Yesterday"; other days show their name. */
  protected readonly dayTitle = computed(() =>
    this.daysAgo() === 0 ? 'Today' : this.daysAgo() === 1 ? 'Yesterday' : null,
  );
  protected readonly upcoming = computed(() => this.daysAgo() < 0);

  protected readonly isThisWeek = computed(
    () => this.week().end.getTime() > this.s().today.start.getTime(),
  );
  /** "This week" or "Last week"; older weeks show their dates. */
  protected readonly weekTitle = computed(() => {
    const thisMonday = weekRange(this.s().today.start).start.getTime();
    const weeksAgo = Math.round((thisMonday - this.week().start.getTime()) / (7 * DAY));
    return weeksAgo === 0 ? 'This week' : weeksAgo === 1 ? 'Last week' : null;
  });
  /** Going back stops at the week of the oldest transaction. */
  protected readonly hasEarlier = computed(() =>
    this.txService.transactions().some((t) => t.occurredAt < this.week().start.getTime()),
  );

  /** The page shown; swiping or tapping the segment changes it. */
  protected readonly view = signal<View>('expenses');
  /** Pages scrolled away from the top, where pull-to-refresh has to stay off. */
  protected readonly scrolledDown = signal<Partial<Record<View, boolean>>>({});

  protected readonly fmt = formatMinor;
  /** Masks the amounts on all three pages, e.g. when someone else can see the screen. Remembered on this phone. */
  protected readonly amountHidden = signal(readFlag(HIDE_AMOUNT_KEY));
  protected readonly money = (minor: number) =>
    this.amountHidden() ? 'ETB ****' : formatMinor(minor);

  constructor() {
    addIcons({
      settingsOutline,
      alertCircleOutline,
      swapHorizontalOutline,
      eyeOutline,
      eyeOffOutline,
      chevronBackOutline,
      chevronForwardOutline,
    });
  }

  protected pickDay(i: number | null): void {
    this.picked.set(i === null ? null : this.week().days[i].day);
  }

  /** Same weekday a week back or ahead; a day past today becomes today. */
  protected shiftWeek(weeks: number): void {
    const d = this.pickedDay();
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * weeks);
    this.picked.set(next.getTime() >= this.s().today.start.getTime() ? null : next);
  }

  protected showCategory(c: Category): void {
    void this.router.navigate(['/tabs/transactions'], {
      queryParams: { q: CATEGORY_LABELS[c], period: 'month' },
    });
  }

  protected onPanelScroll(view: View, event: Event): void {
    const down = (event.target as HTMLElement).scrollTop > 0;
    if (this.scrolledDown()[view] !== down)
      this.scrolledDown.update((m) => ({ ...m, [view]: down }));
  }

  protected toggleAmount(): void {
    const hidden = !this.amountHidden();
    this.amountHidden.set(hidden);
    try {
      localStorage.setItem(HIDE_AMOUNT_KEY, hidden ? '1' : '0');
    } catch {
      // Storage unavailable: the choice lasts until the app restarts.
    }
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.sync.sync();
    await this.txService.load(); // also rolls "today" over after midnight
    await event.target.complete();
  }
}
