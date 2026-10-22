import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonRouterLink,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircleOutline, settingsOutline, swapHorizontalOutline } from 'ionicons/icons';
import { CategoryBarComponent } from '../../components/category-bar.component';
import { TxItemComponent } from '../../components/tx-item.component';
import { WeekChartComponent } from '../../components/week-chart.component';
import { formatMinor } from '../../models/money';
import { Category, CATEGORY_LABELS } from '../../models/transaction.model';
import { SmsSyncService } from '../../services/sms-sync.service';
import { TransactionService } from '../../services/transaction.service';

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
    IonListHeader,
    IonItem,
    IonLabel,
    IonProgressBar,
    IonRefresher,
    IonRefresherContent,
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

  protected readonly s = this.txService.summary;
  protected readonly hasData = computed(() => this.txService.transactions().length > 0);
  protected readonly recent = computed(() => this.txService.transactions().slice(0, 5));
  protected readonly reviewCount = computed(
    () => this.txService.transactions().filter((t) => t.needsReview).length,
  );
  /** Inclusive last day of the week, for display. */
  protected readonly weekLastDay = computed(() => this.s().week.end.getTime() - 1);

  protected readonly fmt = formatMinor;

  constructor() {
    addIcons({ settingsOutline, alertCircleOutline, swapHorizontalOutline });
  }

  protected showCategory(c: Category): void {
    void this.router.navigate(['/tabs/transactions'], { queryParams: { q: CATEGORY_LABELS[c] } });
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.sync.sync();
    await this.txService.load(); // also rolls "today" over after midnight
    await event.target.complete();
  }
}
