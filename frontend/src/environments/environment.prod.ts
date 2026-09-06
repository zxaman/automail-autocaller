import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: '/api/v1',
  appName: 'AutoCall & AutoMail',
  featureFlags: {
    calling: true,
    campaigns: false,
    team: false,
  },
};
