import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonItem, IonLabel, IonNote } from '@ionic/angular';
import { formatMinor } from '../models/money';
import { CATEGORY_LABELS, Transaction } from '../models/transaction.model';

@Component({
  selector: 'app-tx-item',
  imports: [IonItem, IonLabel, IonNote, IonBadge, DatePipe],
  template: `
    <ion-item [button]="clickable()" [detail]="false" (click)="clickable() && picked.emit(tx())">
      <ion-label>
        <h3>{{ tx().merchant ?? tx().source }}</h3>
        <p>
          {{ tx().source }} · {{ category() }} · {{ tx().occurredAt | date: 'EEE d MMM, HH:mm' }}
        </p>
        @if (tx().needsReview) {
          <ion-badge color="warning">Needs review · not counted</ion-badge>
        }
      </ion-label>
      <ion-note slot="end" class="amount" [color]="color()">{{ amount() }}</ion-note>
    </ion-item>
  `,
  styles: `
    .amount {
      font-size: 1rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    ion-badge {
      margin-top: 4px;
      font-weight: 500;
    }
  `,
})
export class TxItemComponent {
  readonly tx = input.required<Transaction>();
  readonly clickable = input(false);
  readonly picked = output<Transaction>();

  protected readonly category = computed(() => {
    const c = this.tx().category;
    return c ? CATEGORY_LABELS[c] : 'Unclassified';
  });

  protected readonly amount = computed(() => {
    const t = this.tx();
    if (t.amountMinor === null) return '—';
    const text = formatMinor(t.amountMinor, t.currency);
    return t.type === 'debit' ? `−${text}` : t.type === 'credit' ? `+${text}` : text;
  });

  protected readonly color = computed(() => {
    const t = this.tx();
    if (t.type === 'unknown' || t.category === 'transfers') return 'medium';
    return t.type === 'debit' ? 'danger' : 'success';
  });
}
