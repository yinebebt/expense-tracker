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
  eyeOffOutline,
  eyeOutline,
  settingsOutline,
  swapHorizontalOutline,
} from 'ionicons/icons';
import { CategoryBarComponent } from '../../components/category-bar.component';
import { TxItemComponent } from '../../components/tx-item.component';
import { WeekChartComponent } from '../../components/week-chart.component';
import { formatMinor } from '../../models/money';
import { Category, CATEGORY_LABELS } from '../../models/transaction.model';
import { TxDetailService } from '../../services/tx-detail.service';
import { SmsSyncService } from '../../services/sms-sync.service';
import { TransactionService } from '../../services/transaction.service';
import { dayRange, spentIn } from '../../summary/summary';

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
  /** The day picked in the week chart; null means today. */
  protected readonly dayIndex = signal<number | null>(null);
  protected readonly todayIndex = computed(() =>
    this.s().week.days.findIndex((d) => d.day.getTime() === this.s().today.start.getTime()),
  );
  protected readonly pickedIndex = computed(() => this.dayIndex() ?? this.todayIndex());
  protected readonly pickedDay = computed(() => this.s().week.days[this.pickedIndex()].day);
  protected readonly pickedTotal = computed(
    () => this.s().week.days[this.pickedIndex()].spentMinor,
  );
  protected readonly pickedSpent = computed(() =>
    spentIn(this.txService.transactions(), dayRange(this.pickedDay())),
  );
  /** "Today" or "Yesterday"; other days show their name. */
  protected readonly dayTitle = computed(() => {
    const diff = this.todayIndex() - this.pickedIndex();
    return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : null;
  });

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
    });
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
