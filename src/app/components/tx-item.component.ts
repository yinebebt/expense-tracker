import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { IonItem, IonLabel, IonNote } from '@ionic/angular';
import { formatMinor } from '../models/money';
import { CATEGORY_LABELS, Transaction } from '../models/transaction.model';

@Component({
  selector: 'app-tx-item',
  imports: [IonItem, IonLabel, IonNote, DatePipe],
  template: `
    <ion-item [button]="clickable()" [detail]="false" (click)="clickable() && picked.emit(tx())">
      <ion-label>
        <h3>{{ tx().merchant ?? tx().source }}</h3>
        <p>
          @if (tx().merchant) {
            {{ tx().source }} ·
          }
          @if (tx().needsReview) {
            <span class="review">Needs review</span> ·
          } @else {
            {{ category() }} ·
          }
          {{ tx().occurredAt | date: dateFormat() }}
        </p>
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
    .amount:not(.ion-color) {
      color: var(--ion-text-color);
    }
    .review {
      color: var(--ion-color-warning-shade);
      font-weight: 500;
    }
  `,
})
export class TxItemComponent {
  readonly tx = input.required<Transaction>();
  readonly clickable = input(false);
  /** 'HH:mm' where the list is already one day. */
  readonly dateFormat = input('EEE d MMM, HH:mm');
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
    // Most rows are debits; only money coming in is colored.
    return t.type === 'credit' ? 'success' : undefined;
  });
}
