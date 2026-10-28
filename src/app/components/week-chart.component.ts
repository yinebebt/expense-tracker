import { DatePipe } from '@angular/common';
import { Component, computed, input, model } from '@angular/core';
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

/** Spending per day for one week. Tap a day to select it. Content goes in the caption above. */
@Component({
  selector: 'app-week-chart',
  imports: [DatePipe],
  template: `
    <div class="caption"><ng-content /></div>
    <svg
      [attr.viewBox]="'0 0 ' + W + ' ' + H"
      role="group"
      aria-label="Spending per day"
      [class.picking]="selected() !== null"
    >
      <line class="baseline" x1="0" [attr.x2]="W" [attr.y1]="BASE" [attr.y2]="BASE" />
      @for (b of bars(); track b.i) {
        <g
          class="band"
          tabindex="0"
          role="button"
          [attr.aria-label]="(b.day | date: 'EEEE') + ', ' + fmt(b.minor)"
          [attr.aria-pressed]="b.i === selected()"
          (click)="select(b.i)"
          (keydown.enter)="select(b.i)"
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
  `,
  styles: `
    :host {
      display: block;
    }
    .caption {
      margin-bottom: 4px;
      color: var(--viz-muted);
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
      fill: var(--viz-1);
    }
    .picking path:not(.on) {
      fill: var(--viz-1-soft);
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
  /** Index into `days`, or null when no day is picked. */
  readonly selected = model<number | null>(null);

  protected readonly todayIndex = computed(() => {
    const t = this.today();
    return this.days().findIndex(
      (d) =>
        d.day.getFullYear() === t.getFullYear() &&
        d.day.getMonth() === t.getMonth() &&
        d.day.getDate() === t.getDate(),
    );
  });

  protected readonly bars = computed(() => {
    const days = this.days();
    const max = Math.max(0, ...days.map((d) => d.spentMinor));
    const maxIndex = days.findIndex((d) => d.spentMinor === max);
    return days.map((d, i) => {
      const bandX = i * BAND;
      const x = bandX + (BAND - BAR) / 2;
      const h = max ? Math.max(3, (d.spentMinor / max) * (BASE - TOP)) : 0;
      const top = d.spentMinor > 0 ? BASE - h : null;
      // Label only the tallest day and the selected one; the readout above carries the rest.
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

  protected select(i: number): void {
    this.selected.set(i);
  }
}
