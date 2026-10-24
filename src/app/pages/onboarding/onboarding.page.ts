import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonProgressBar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, arrowForwardOutline, checkmarkOutline } from 'ionicons/icons';
import { ONBOARDING_KEY } from '../../guards/onboarding.guard';
import { daysAgo, localDateValue } from '../../models/dates';
import { DatabaseService } from '../../services/database.service';
import { IMPORT_WINDOW_DAYS, SmsSyncService } from '../../services/sms-sync.service';

const STEPS = ['welcome', 'how-it-works', 'permission', 'import-start'] as const;
type Step = (typeof STEPS)[number];

/** A little personality for each step, next to its heading. */
const EMOJI: Record<Step, string> = {
  welcome: '👋',
  'how-it-works': '🔍',
  permission: '🔒',
  'import-start': '📅',
};

/** A few screens shown once, before the first visit to the app's tabs. */
@Component({
  selector: 'app-onboarding',
  imports: [IonContent, IonButton, IonIcon, IonProgressBar],
  templateUrl: './onboarding.page.html',
  styleUrl: './onboarding.page.scss',
})
export class OnboardingPage {
  private readonly db = inject(DatabaseService);
  private readonly router = inject(Router);
  protected readonly sync = inject(SmsSyncService);

  /** True when opened again from Settings, rather than on first launch. */
  protected readonly replay = inject(ActivatedRoute).snapshot.queryParamMap.has('replay');

  protected readonly steps = STEPS;
  protected readonly windowDays = IMPORT_WINDOW_DAYS;
  protected readonly index = signal(0);
  protected readonly step = computed<Step>(() => STEPS[this.index()]);
  protected readonly progress = computed(() => (this.index() + 1) / STEPS.length);
  protected readonly emoji = computed(() => EMOJI[this.step()]);

  protected readonly importStartInput = computed(() => {
    const v = this.sync.importStart();
    return v === null ? '' : localDateValue(v);
  });

  constructor() {
    addIcons({ arrowBackOutline, arrowForwardOutline, checkmarkOutline });
  }

  protected back(): void {
    this.index.update((i) => Math.max(0, i - 1));
  }

  protected next(): void {
    this.index.update((i) => Math.min(STEPS.length - 1, i + 1));
  }

  /** `daysAgoCount` null picks the default window instead of a cutoff. */
  protected setPreset(daysAgoCount: number | null): void {
    void this.sync.setImportStart(daysAgoCount === null ? null : daysAgo(daysAgoCount));
  }

  /** `value` is a date-input string ("2026-10-24"), or empty for the default window. */
  protected setImportStart(value: string): void {
    void this.sync.setImportStart(value ? new Date(`${value}T00:00`).getTime() : null);
  }

  protected async finish(): Promise<void> {
    await this.db.setMeta(ONBOARDING_KEY, '1');
    // Dashboard either way: it shows the sync in progress, so there's nothing to wait on here.
    await this.router.navigateByUrl('/tabs/dashboard', { replaceUrl: true });
  }
}
