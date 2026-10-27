import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
import { localInputValue } from '../models/dates';
import { parseAmountMinor } from '../models/money';
import { CASH } from '../models/transaction.model';
import { TransactionService } from '../services/transaction.service';

/** Types in an account's current balance, for Cash or a bank whose SMS don't report one. */
@Component({
  selector: 'app-balance-edit',
  imports: [IonContent, IonIcon, IonButton, IonSelect, IonSelectOption],
  template: `
    <ion-content>
      <div class="top">
        <span>Update balance</span>
        <button type="button" class="close" aria-label="Close" (click)="close()">
          <ion-icon name="close" />
        </button>
      </div>

      <label class="amount">
        <span>ETB</span>
        <input
          inputmode="decimal"
          placeholder="0.00"
          aria-label="Balance"
          [value]="amountText()"
          (input)="amountText.set($any($event.target).value)"
        />
      </label>

      <dl class="facts">
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
        <dt>As of</dt>
        <dd>
          <input
            type="datetime-local"
            aria-label="As of"
            [value]="date()"
            (input)="date.set($any($event.target).value)"
          />
        </dd>
      </dl>
      <p class="hint">A newer SMS from this account replaces it.</p>

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
      margin: 12px 0 4px;
      font-size: 1.75rem;
      font-weight: 600;
    }
    .amount span {
      color: var(--viz-muted);
      font-size: 1.1rem;
    }
    input {
      width: 100%;
      min-width: 0;
      border: 0;
      border-bottom: 1px solid var(--viz-baseline);
      padding: 6px 0;
      background: none;
      color: var(--ion-text-color);
      font: inherit;
      font-variant-numeric: tabular-nums;
    }
    input:focus {
      outline: none;
      border-bottom-color: var(--ion-color-primary);
    }
    dd input {
      text-align: right;
    }
    .hint {
      margin: 8px 0 0;
      font-size: 0.8rem;
      color: var(--viz-muted);
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
    }
  `,
})
export class BalanceEditComponent implements OnInit {
  /** Set through the modal's componentProps; the account to preselect. */
  account: string | null = null;

  private readonly modal = inject(ModalController);
  private readonly txService = inject(TransactionService);

  protected readonly accounts = this.txService.balanceAccounts;
  protected readonly amountText = signal('');
  protected readonly source = signal(CASH);
  protected readonly date = signal(localInputValue(Date.now()));
  protected readonly saving = signal(false);

  private readonly amountMinor = computed(() => parseAmountMinor(this.amountText()));
  private readonly at = computed(() => new Date(this.date()).getTime());

  /** Zero is a valid balance; a negative one isn't something parseAmountMinor accepts. */
  protected readonly valid = computed(
    () => this.amountMinor() !== null && Number.isFinite(this.at()),
  );

  constructor() {
    addIcons({ close });
  }

  ngOnInit(): void {
    if (this.account) this.source.set(this.account);
  }

  protected close(): void {
    void this.modal.dismiss();
  }

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    try {
      await this.txService.setBalance(this.source(), this.amountMinor()!, this.at());
      await this.modal.dismiss();
    } catch (err) {
      console.error('Saving balance failed', err);
      this.saving.set(false);
    }
  }
}
