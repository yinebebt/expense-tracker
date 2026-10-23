import { Component, computed, input, output } from '@angular/core';
import { formatMinor } from '../models/money';
import { CATEGORIES, Category, CATEGORY_LABELS } from '../models/transaction.model';
import { CategoryTotal } from '../summary/summary';

/**
 * Each category keeps one color and one position in the bar, whatever the month's
 * ranking, so a reader who learned "food is blue, on the left" isn't misled.
 */
const COLOR: Record<Category, string> = {
  food: 'var(--viz-1)',
  transport: 'var(--viz-2)',
  shopping: 'var(--viz-3)',
  bills: 'var(--viz-4)',
  household: 'var(--viz-5)',
  health: 'var(--viz-6)',
  income: 'var(--viz-7)',
  transfers: 'var(--viz-other)',
  other: 'var(--viz-other)',
};

/** Part-to-whole: one stacked bar in fixed category order, plus a legend that doubles as the table. */
@Component({
  selector: 'app-category-bar',
  template: `
    <div class="bar" role="img" [attr.aria-label]="ariaLabel()">
      @for (s of segments(); track s.category) {
        <span
          class="seg"
          [style.flex-grow]="s.amountMinor"
          [style.background]="color(s.category)"
        ></span>
      }
    </div>
    <ul class="legend">
      @for (s of ranked(); track s.category) {
        <li>
          <button type="button" (click)="picked.emit(s.category)">
            <span class="swatch" [style.background]="color(s.category)"></span>
            <span class="name">{{ label(s.category) }}</span>
            <span class="pct">{{ pct(s.amountMinor) }}%</span>
            <span class="amt">{{ masked() ? '****' : fmt(s.amountMinor) }}</span>
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }
    .bar {
      display: flex;
      gap: 2px;
      height: 16px;
      border-radius: 4px;
      overflow: hidden;
    }
    .seg {
      flex-basis: 0;
      min-width: 3px;
    }
    .legend {
      list-style: none;
      margin: 12px 0 0;
      padding: 0;
    }
    .legend button {
      display: grid;
      grid-template-columns: 12px 1fr auto auto;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 0;
      background: none;
      border: 0;
      border-bottom: 1px solid var(--viz-baseline);
      color: var(--ion-text-color);
      font: inherit;
      font-size: 0.9rem;
      text-align: left;
    }
    .swatch {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }
    .pct {
      color: var(--viz-muted);
      font-variant-numeric: tabular-nums;
    }
    .amt {
      min-width: 7.5em;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class CategoryBarComponent {
  readonly items = input.required<CategoryTotal[]>();
  /** Hides the amounts; the shares stay. */
  readonly masked = input(false);
  readonly picked = output<Category>();

  protected readonly fmt = formatMinor;
  protected readonly label = (c: Category) => CATEGORY_LABELS[c];
  protected readonly color = (c: Category) => COLOR[c];

  private readonly total = computed(() => this.items().reduce((s, i) => s + i.amountMinor, 0));

  /** Bar order: the fixed category order, Other last. */
  protected readonly segments = computed(() =>
    [...this.items()].sort((a, b) => order(a.category) - order(b.category)),
  );

  /** Legend order: biggest first. */
  protected readonly ranked = computed(() =>
    [...this.items()].sort((a, b) => b.amountMinor - a.amountMinor),
  );

  protected readonly ariaLabel = computed(() =>
    this.ranked()
      .map((s) => `${CATEGORY_LABELS[s.category]} ${this.pct(s.amountMinor)}%`)
      .join(', '),
  );

  protected pct(minor: number): number {
    const total = this.total();
    return total ? Math.round((minor / total) * 100) : 0;
  }
}

function order(c: Category): number {
  return c === 'other' ? CATEGORIES.length : CATEGORIES.indexOf(c);
}
