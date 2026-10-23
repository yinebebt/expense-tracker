import { Component, computed, inject, signal } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonSelect,
  IonSelectOption,
  ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { parseAmountMinor } from '../models/money';
import { CATEGORIES, Category, CATEGORY_LABELS } from '../models/transaction.model';
import { TransactionService } from '../services/transaction.service';

const CASH = 'Cash';

/** "2026-10-23T08:05" in local time, the value a datetime-local input takes. */
function localInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Adds a transaction by hand, e.g. a cash payment no SMS reports. Opened by TxDetailService. */
@Component({
  selector: 'app-tx-add',
  imports: [IonContent, IonIcon, IonButton, IonSelect, IonSelectOption],
  template: `
    <ion-content>
      <div class="top">
        <span>Add transaction</span>
        <button type="button" class="close" aria-label="Close" (click)="close()">
          <ion-icon name="close" />
        </button>
      </div>

      <label class="amount">
        <span>ETB</span>
        <input
          inputmode="decimal"
          placeholder="0.00"
          aria-label="Amount"
          [value]="amountText()"
          (input)="amountText.set($any($event.target).value)"
        />
      </label>

      <dl class="facts">
        <dt>Type</dt>
        <dd>
          <ion-select
            aria-label="Type"
            interface="popover"
            [value]="type()"
            (ionChange)="setType($any($event).detail.value)"
          >
            <ion-select-option value="debit">Money out</ion-select-option>
            <ion-select-option value="credit">Money in</ion-select-option>
          </ion-select>
        </dd>
        <dt>{{ type() === 'debit' ? 'Paid to' : 'From' }}</dt>
        <dd>
          <input
            [placeholder]="type() === 'debit' ? 'Required' : 'Optional'"
            aria-label="Payee"
            [value]="payee()"
            (input)="setPayee($any($event.target).value)"
          />
        </dd>
        <dt>Category</dt>
        <dd>
          <ion-select
            aria-label="Category"
            interface="popover"
            [value]="category()"
            (ionChange)="pickCategory($any($event).detail.value)"
          >
            @for (c of categories; track c) {
              <ion-select-option [value]="c">{{ labels[c] }}</ion-select-option>
            }
          </ion-select>
        </dd>
        <dt>Account</dt>
        <dd>
          <ion-select
            aria-label="Account"
            interface="popover"
            [value]="source()"
            (ionChange)="source.set($any($event).detail.value)"
          >
            @for (a of accounts(); track a) {
              <ion-select-option [value]="a">{{ a }}</ion-select-option>
            }
          </ion-select>
        </dd>
        <dt>Date</dt>
        <dd>
          <input
            type="datetime-local"
            aria-label="Date"
            [value]="date()"
            (input)="date.set($any($event.target).value)"
          />
        </dd>
        <dt>Reference</dt>
        <dd>
          <input
            placeholder="Required"
            aria-label="Reference"
            [value]="reference()"
            (input)="reference.set($any($event.target).value)"
          />
        </dd>
      </dl>

      <div class="buttons">
        <ion-button fill="clear" size="small" (click)="close()">Cancel</ion-button>
        <ion-button size="small" [disabled]="!valid() || saving()" (click)="save()"
          >Save</ion-button
        >
      </div>
    </ion-content>
  `,
  styles: `
    .amount {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin: 16px 0 4px;
      font-size: 1.75rem;
      font-weight: 600;
    }
    .amount span {
      color: var(--viz-muted);
      font-size: 1.1rem;
    }
    .amount input {
      flex: 1;
      min-width: 0;
      font-variant-numeric: tabular-nums;
    }
    input {
      width: 100%;
      border: 0;
      border-bottom: 1px solid var(--viz-baseline);
      padding: 6px 0;
      background: none;
      color: var(--ion-text-color);
      font: inherit;
      text-align: inherit;
    }
    input:focus {
      outline: none;
      border-bottom-color: var(--ion-color-primary);
    }
    dd input {
      text-align: right;
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  `,
})
export class TxAddComponent {
  private readonly modal = inject(ModalController);
  private readonly txService = inject(TransactionService);

  protected readonly categories = CATEGORIES;
  protected readonly labels = CATEGORY_LABELS;

  protected readonly type = signal<'debit' | 'credit'>('debit');
  protected readonly amountText = signal('');
  protected readonly payee = signal('');
  protected readonly category = signal<Category>('other');
  protected readonly source = signal(CASH);
  protected readonly date = signal(localInputValue(Date.now()));
  protected readonly reference = signal('');
  protected readonly saving = signal(false);
  /** Once the user picks a category, typing a payee no longer changes it. */
  private categoryPicked = false;

  /** Cash first, then the accounts that already have transactions, busiest first. */
  protected readonly accounts = computed(() => {
    const counts = new Map<string, number>();
    for (const t of this.txService.transactions())
      counts.set(t.source, (counts.get(t.source) ?? 0) + 1);
    const seen = [...counts].sort((a, b) => b[1] - a[1]).map(([s]) => s);
    return [CASH, ...seen.filter((s) => s !== CASH)];
  });

  private readonly amountMinor = computed(() => parseAmountMinor(this.amountText()));
  private readonly occurredAt = computed(() => new Date(this.date()).getTime());

  /** Amount, date and reference are always needed; the payee only for money out. */
  protected readonly valid = computed(() => {
    const a = this.amountMinor();
    return (
      a !== null &&
      a > 0 &&
      Number.isFinite(this.occurredAt()) &&
      this.reference().trim() !== '' &&
      (this.type() === 'credit' || this.payee().trim() !== '')
    );
  });

  constructor() {
    addIcons({ close });
  }

  protected setType(t: 'debit' | 'credit'): void {
    this.type.set(t);
    if (!this.categoryPicked) this.category.set(this.defaultCategory());
  }

  protected setPayee(name: string): void {
    this.payee.set(name);
    if (!this.categoryPicked) this.category.set(this.defaultCategory());
  }

  protected pickCategory(c: Category): void {
    if (c === this.category()) return;
    this.categoryPicked = true;
    this.category.set(c);
  }

  /** The payee's rule if one is set, otherwise Other for money out and Income for money in. */
  private defaultCategory(): Category {
    const name = this.payee().trim();
    const ruled = name ? this.txService.payeeRule(name) : null;
    if (ruled && (this.type() === 'debit' || ruled === 'transfers' || ruled === 'income')) {
      return ruled;
    }
    return this.type() === 'debit' ? 'other' : 'income';
  }

  protected close(): void {
    void this.modal.dismiss();
  }

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    try {
      await this.txService.addManual({
        type: this.type(),
        amountMinor: this.amountMinor()!,
        occurredAt: this.occurredAt(),
        merchant: this.payee().trim() || null,
        category: this.category(),
        source: this.source(),
        reference: this.reference().trim(),
      });
      await this.modal.dismiss();
    } catch (err) {
      console.error('Adding transaction failed', err);
      this.saving.set(false);
    }
  }
}
