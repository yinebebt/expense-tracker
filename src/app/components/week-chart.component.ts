import { DatePipe } from '@angular/common';
import { Component, computed, effect, input, signal } from '@angular/core';
import { formatMinor } from '../models/money';
import { DayTotal } from '../summary/summary';

// SVG geometry in viewBox units; the SVG scales to the container width.
const W = 336;
const H = 168;
const TOP = 20; // room for the value label above the tallest bar
const AXIS = 24; // day labels under the baseline
const BASE = H - AXIS;
const BAND = W / 7;
const BAR = 24;
const RADIUS = 4;

/** "1,250.00" → "1.3K", "85.00" → "85". Axis-label sized. */
function compact(minor: number): string {
  const n = minor / 100;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

/** Column with a rounded data end and a square foot on the baseline. */
function columnPath(x: number, top: number): string {
  const r = Math.min(RADIUS, BASE - top);
  return `M${x},${BASE} V${top + r} Q${x},${top} ${x + r},${top} H${x + BAR - r} Q${x + BAR},${top} ${x + BAR},${top + r} V${BASE} Z`;
}

/** Spending per day for one week. Tap a day to read its exact amount; "List" shows all seven. */
@Component({
  selector: 'app-week-chart',
  imports: [DatePipe],
  template: `
    <div class="head">
      @if (selectedDay(); as d) {
        <span class="readout">
          <span class="readout-day">{{ d.day | date: 'EEE d MMM' }}</span>
          <strong>{{ fmt(d.spentMinor) }}</strong>
        </span>
      }
      <button type="button" class="toggle" (click)="asList.set(!asList())">
        {{ asList() ? 'Chart' : 'List' }}
      </button>
    </div>

    @if (asList()) {
      <table class="days">
        @for (d of days(); track $index) {
          <tr [class.today]="$index === todayIndex()">
            <td>{{ d.day | date: 'EEEE d MMM' }}</td>
            <td class="num">{{ fmt(d.spentMinor) }}</td>
          </tr>
        }
      </table>
    } @else {
      <svg
        [attr.viewBox]="'0 0 ' + W + ' ' + H"
        role="group"
        aria-label="Spending per day this week"
      >
        <line class="baseline" x1="0" [attr.x2]="W" [attr.y1]="BASE" [attr.y2]="BASE" />
        @for (b of bars(); track b.i) {
          <g
            class="band"
            tabindex="0"
            role="button"
            [attr.aria-label]="(b.day | date: 'EEEE') + ', ' + fmt(b.minor)"
            [attr.aria-pressed]="b.i === selected()"
            (click)="selected.set(b.i)"
            (keydown.enter)="selected.set(b.i)"
          >
            <rect class="hit" [attr.x]="b.bandX" y="0" [attr.width]="BAND" [attr.height]="H" />
            @if (b.top !== null) {
              <path [attr.d]="b.path" [class.on]="b.i === selected()" />
            }
            @if (b.label) {
              <text class="value" [attr.x]="b.cx" [attr.y]="(b.top ?? BASE) - 6">
                {{ b.label }}
              </text>
            }
            <text class="day" [class.today]="b.i === todayIndex()" [attr.x]="b.cx" [attr.y]="H - 7">
              {{ b.day | date: 'EEE' }}
            </text>
          </g>
        }
      </svg>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }
    .readout {
      display: flex;
      gap: 8px;
      align-items: baseline;
    }
    .readout-day {
      color: var(--viz-muted);
      font-size: 0.85rem;
    }
    .toggle {
      background: none;
      border: 0;
      padding: 4px 0;
      color: var(--ion-color-primary);
      font: inherit;
      font-size: 0.85rem;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .baseline {
      stroke: var(--viz-baseline);
      stroke-width: 1;
    }
    .hit {
      fill: transparent;
    }
    .band {
      cursor: pointer;
      outline: none;
    }
    .band:focus-visible .hit {
      fill: var(--viz-baseline);
      opacity: 0.25;
    }
    path {
      fill: var(--viz-1-soft);
    }
    path.on {
      fill: var(--viz-1);
    }
    text {
      text-anchor: middle;
      font-size: 11px;
      fill: var(--viz-muted);
      font-variant-numeric: tabular-nums;
    }
    text.value {
      fill: var(--ion-text-color);
      font-weight: 600;
    }
    text.day.today {
      fill: var(--ion-text-color);
      font-weight: 600;
    }
    table.days {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    table.days td {
      padding: 6px 0;
      border-bottom: 1px solid var(--viz-baseline);
    }
    table.days tr.today td {
      font-weight: 600;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class WeekChartComponent {
  readonly days = input.required<DayTotal[]>();
  readonly today = input(new Date());

  protected readonly W = W;
  protected readonly H = H;
  protected readonly BASE = BASE;
  protected readonly BAND = BAND;
  protected readonly fmt = formatMinor;
  protected readonly asList = signal(false);
  protected readonly selected = signal(0);

  protected readonly todayIndex = computed(() => {
    const t = this.today();
    return this.days().findIndex(
      (d) =>
        d.day.getFullYear() === t.getFullYear() &&
        d.day.getMonth() === t.getMonth() &&
        d.day.getDate() === t.getDate(),
    );
  });

  protected readonly selectedDay = computed(() => this.days()[this.selected()] ?? null);

  protected readonly bars = computed(() => {
    const days = this.days();
    const max = Math.max(0, ...days.map((d) => d.spentMinor));
    const maxIndex = days.findIndex((d) => d.spentMinor === max);
    return days.map((d, i) => {
      const bandX = i * BAND;
      const x = bandX + (BAND - BAR) / 2;
      const h = max ? Math.max(3, (d.spentMinor / max) * (BASE - TOP)) : 0;
      const top = d.spentMinor > 0 ? BASE - h : null;
      // Label only the tallest day and the selected one; the readout and List carry the rest.
      const labelled = d.spentMinor > 0 && (i === maxIndex || i === this.selected());
      return {
        i,
        day: d.day,
        minor: d.spentMinor,
        bandX,
        cx: bandX + BAND / 2,
        top,
        path: top === null ? '' : columnPath(x, top),
        label: labelled ? compact(d.spentMinor) : '',
      };
    });
  });

  constructor() {
    // Start on today (or the last day when today isn't in this range).
    effect(() => {
      const t = this.todayIndex();
      this.selected.set(t >= 0 ? t : this.days().length - 1);
    });
  }
}
