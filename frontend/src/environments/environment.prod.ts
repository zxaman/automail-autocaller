import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: '/api/v1',
  appName: 'AutoCall & AutoMail',
  // Replace during the production build pipeline. Public value, never a secret.
  googleClientId: '',
  featureFlags: {
    calling: true,
    campaigns: false,
    team: false,
  },
};
