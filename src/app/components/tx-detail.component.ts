import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  IonContent,
  IonIcon,
  IonSelect,
  IonSelectOption,
  AlertController,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { formatMinor } from '../models/money';
import { CATEGORIES, Category, CATEGORY_LABELS, isManual } from '../models/transaction.model';
import { knownSenders } from '../parsing/sms-parser';
import { SmsReaderService } from '../services/sms-reader.service';
import { TransactionService } from '../services/transaction.service';
import { isCounted } from '../summary/summary';

/** One transaction in a small dialog: the facts, its category and the SMS. Opened by TxDetailService. */
@Component({
  selector: 'app-tx-detail',
  imports: [DatePipe, IonContent, IonIcon, IonSelect, IonSelectOption],
  template: `
    <ion-content>
      @if (tx(); as t) {
        <div class="top">
          <span class="kind">{{ title() }} · {{ t.source }}</span>
          <button type="button" class="close" aria-label="Close" (click)="close()">
            <ion-icon name="close" />
          </button>
        </div>
        <div class="amount" [class.credit]="t.type === 'credit' && counted()">{{ amount() }}</div>
        <div class="party" [class.muted]="!t.merchant">
          {{ t.merchant ?? 'The SMS doesn’t name the other side' }}
        </div>
        @if (notCounted(); as why) {
          <div class="why">Not counted · {{ why }}</div>
        }

        <dl class="facts">
          <dt>Category</dt>
          <dd>
            <ion-select
              aria-label="Category"
              interface="popover"
              placeholder="Unclassified"
              [value]="t.category"
              (ionChange)="setCategory($any($event).detail.value)"
            >
              @for (c of categories; track c) {
                <ion-select-option [value]="c">{{ labels[c] }}</ion-select-option>
              }
            </ion-select>
          </dd>
          <dt>Date</dt>
          <dd>{{ t.occurredAt | date: 'EEE d MMM y, HH:mm' }}</dd>
          @if (t.reference) {
            <dt>Reference</dt>
            <dd class="ref">{{ t.reference }}</dd>
          }
        </dl>

        @if (manual()) {
          <div class="manual">
            <span class="muted">Added by hand</span>
            <button type="button" class="link danger" (click)="confirmDelete()">Delete</button>
          </div>
        } @else {
          <div class="sms-head">
            <span>SMS</span>
            @if (message()) {
              <button type="button" class="link" (click)="copy()">Copy</button>
            }
          </div>
          <div class="sms">
            @switch (message()) {
              @case (undefined) {
                <span class="muted">Loading…</span>
              }
              @case (null) {
                <span class="muted">No longer in the inbox.</span>
              }
              @default {
                {{ message() }}
              }
            }
          </div>
        }
      }
    </ion-content>
  `,
  styles: `
    .amount {
      font-size: 1.75rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .amount.credit {
      color: var(--ion-color-success);
    }
    .party {
      font-size: 1rem;
    }
    .ref {
      font-variant-numeric: tabular-nums;
      user-select: text;
    }
    .sms-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin: 14px 0 6px;
      font-size: 0.85rem;
      color: var(--viz-muted);
    }
    .manual {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      font-size: 0.85rem;
    }
    .link.danger {
      color: var(--ion-color-danger);
    }
    .sms {
      max-height: 9.5em;
      overflow-y: auto;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--ion-color-step-50, rgba(127, 127, 127, 0.08));
      white-space: pre-wrap;
      font-size: 0.85rem;
      line-height: 1.45;
      user-select: text;
    }
  `,
})
export class TxDetailComponent implements OnInit {
  /** Set through the modal's componentProps. */
  txId = '';

  private readonly modal = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly alerts = inject(AlertController);
  private readonly txService = inject(TransactionService);
  private readonly reader = inject(SmsReaderService);

  protected readonly categories = CATEGORIES;
  protected readonly labels = CATEGORY_LABELS;

  private readonly id = signal('');
  /** Live, so a category change shows straight away. */
  protected readonly tx = computed(() =>
    this.txService.transactions().find((t) => t.id === this.id()),
  );
  /** undefined while loading, null when the SMS can't be found. */
  protected readonly message = signal<string | null | undefined>(undefined);

  protected readonly manual = computed(() => {
    const t = this.tx();
    return !!t && isManual(t);
  });

  protected readonly counted = computed(() => {
    const t = this.tx();
    return !!t && isCounted(t);
  });

  protected readonly title = computed(() => {
    const t = this.tx();
    if (!t || t.type === 'unknown') return 'Needs review';
    if (t.category === 'transfers') return 'Own transfer';
    return t.type === 'debit' ? 'Payment' : 'Received';
  });

  protected readonly notCounted = computed(() => {
    const t = this.tx();
    if (!t || this.counted()) return null;
    return t.type === 'unknown' ? 'the app couldn’t read this SMS' : 'moved between your accounts';
  });

  protected readonly amount = computed(() => {
    const t = this.tx();
    if (!t || t.amountMinor === null) return '—';
    const text = formatMinor(t.amountMinor, t.currency);
    return t.type === 'debit' ? `−${text}` : t.type === 'credit' ? `+${text}` : text;
  });

  constructor() {
    addIcons({ close });
  }

  ngOnInit(): void {
    this.id.set(this.txId);
    void this.loadMessage();
  }

  protected close(): void {
    void this.modal.dismiss();
  }

  protected setCategory(c: Category): void {
    if (!c || c === this.tx()?.category) return;
    this.txService
      .setCategory(this.txId, c)
      .catch((err) => console.error('Updating category failed', err));
  }

  protected async confirmDelete(): Promise<void> {
    const t = this.tx();
    if (!t) return;
    const alert = await this.alerts.create({
      header: 'Delete this transaction?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            void this.modal.dismiss();
            this.txService
              .deleteManual(t)
              .catch((err) => console.error('Deleting transaction failed', err));
          },
        },
      ],
    });
    await alert.present();
  }

  private async loadMessage(): Promise<void> {
    const t = this.tx();
    if (t && isManual(t)) return;
    if (t?.rawText) return this.message.set(t.rawText);
    if (!t?.smsId) return this.message.set(null);
    try {
      this.message.set((await this.reader.get(t.smsId, knownSenders()))?.body ?? null);
    } catch {
      this.message.set(null);
    }
  }

  /** For sending a message the app misreads to whoever maintains the parsing rules. */
  protected async copy(): Promise<void> {
    const text = this.message();
    if (!text) return;
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
      message: ok ? 'Copied — strip names and numbers first.' : 'Copy failed',
      duration: 3000,
    });
    await toast.present();
  }
}
