import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DatabaseService } from '../services/database.service';

export const ONBOARDING_KEY = 'onboarding_done';

async function onboarded(db: DatabaseService): Promise<boolean> {
  return (await db.getMeta(ONBOARDING_KEY)) !== null;
}

/** Sends first-time users to onboarding before the app's main tabs. */
export const requireOnboarding: CanActivateFn = async () => {
  // inject() only works before the first `await`, so grab everything up front.
  const db = inject(DatabaseService);
  const router = inject(Router);
  if (await onboarded(db)) return true;
  return router.createUrlTree(['/onboarding']);
};

/**
 * Once onboarding is done, visiting it again just bounces back to the app —
 * unless `?replay` is set, which is how Settings links back into these screens.
 */
export const skipIfOnboarded: CanActivateFn = async (route) => {
  const db = inject(DatabaseService);
  const router = inject(Router);
  if (route.queryParamMap.has('replay')) return true;
  if (!(await onboarded(db))) return true;
  return router.createUrlTree(['/tabs/dashboard']);
};
