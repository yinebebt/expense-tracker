import { Routes } from '@angular/router';
import { requireOnboarding, skipIfOnboarded } from './guards/onboarding.guard';

export const routes: Routes = [
  {
    path: 'onboarding',
    canActivate: [skipIfOnboarded],
    loadComponent: () => import('./pages/onboarding/onboarding.page').then((m) => m.OnboardingPage),
  },
  {
    path: 'tabs',
    canActivate: [requireOnboarding],
    loadComponent: () => import('./pages/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('./pages/transactions/transactions.page').then((m) => m.TransactionsPage),
      },
      {
        path: 'payees',
        loadComponent: () => import('./pages/payees/payees.page').then((m) => m.PayeesPage),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  { path: '', redirectTo: 'tabs/dashboard', pathMatch: 'full' },
];
