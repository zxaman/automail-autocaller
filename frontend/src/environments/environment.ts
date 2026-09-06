import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: false,
  apiBaseUrl: '/api/v1',
  appName: 'AutoCall & AutoMail',
  // Public OAuth client ID. Never place a client secret here.
  googleClientId: '',
  featureFlags: {
    calling: true,
    campaigns: false,
    team: false,
  },
};
