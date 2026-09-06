import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: false,
  apiBaseUrl: '/api/v1',
  // Android emulator host loopback. Replace with a LAN IP for a real device.
  nativeApiOrigin: 'http://10.0.2.2:3000',
  appName: 'AutoCall & AutoMail',
  // Public OAuth client ID. Never place a client secret here.
  googleClientId: '',
  featureFlags: {
    calling: true,
    campaigns: false,
    team: false,
  },
};
