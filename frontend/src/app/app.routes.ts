import type { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

/**
 * Every feature area is lazy loaded so the initial bundle stays small on mobile.
 * Protected areas are rendered inside the authenticated application shell.
 */
export const APP_ROUTES: Routes = [
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    title: 'Sign in · AutoCall & AutoMail',
    loadComponent: () =>
      import('./features/auth/login-page/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · AutoCall & AutoMail',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page/dashboard-page.component').then(
            (m) => m.DashboardPageComponent,
          ),
      },
      {
        path: 'contacts',
        title: 'Contacts · AutoCall & AutoMail',
        loadComponent: () =>
          import('./features/contacts/contact-list-page/contact-list-page.component').then(
            (m) => m.ContactListPageComponent,
          ),
      },
      {
        path: 'contacts/:id',
        title: 'Contact · AutoCall & AutoMail',
        loadComponent: () =>
          import('./features/contacts/contact-detail-page/contact-detail-page.component').then(
            (m) => m.ContactDetailPageComponent,
          ),
      },
      {
        path: 'calls',
        title: 'Calls · AutoCall & AutoMail',
        loadComponent: () =>
          import('./features/calls/calls-page/calls-page.component').then((m) => m.CallsPageComponent),
      },
      {
        path: 'emails',
        title: 'Emails · AutoCall & AutoMail',
        loadComponent: () =>
          import('./features/emails/emails-page/emails-page.component').then(
            (m) => m.EmailsPageComponent,
          ),
      },
      {
        path: 'templates',
        title: 'Templates · AutoCall & AutoMail',
        loadComponent: () =>
          import('./features/templates/templates-page/templates-page.component').then(
            (m) => m.TemplatesPageComponent,
          ),
      },
      {
        path: 'imports',
        title: 'Imports · AutoCall & AutoMail',
        loadComponent: () =>
          import('./features/imports/import-wizard-page/import-wizard-page.component').then(
            (m) => m.ImportWizardPageComponent,
          ),
      },
      {
        path: 'analytics',
        title: 'Analytics · AutoCall & AutoMail',
        loadComponent: () =>
          import('./features/analytics/analytics-page/analytics-page.component').then(
            (m) => m.AnalyticsPageComponent,
          ),
      },
      {
        path: 'settings',
        title: 'Settings · AutoCall & AutoMail',
        loadComponent: () =>
          import('./features/settings/settings-page/settings-page.component').then(
            (m) => m.SettingsPageComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    title: 'Page not found · AutoCall & AutoMail',
    loadComponent: () =>
      import('./features/not-found/not-found-page/not-found-page.component').then(
        (m) => m.NotFoundPageComponent,
      ),
  },
];
