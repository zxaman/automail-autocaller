import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: false,
  apiBaseUrl: '/api/v1',
  appName: 'AutoCall & AutoMail',
  featureFlags: {
    calling: true,
    campaigns: false,
    team: false,
  },
};
