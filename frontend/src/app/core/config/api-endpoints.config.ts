/**
 * Centralized relative API paths. Feature services must not build ad-hoc URLs
 * so the base path stays consistent across web and Capacitor builds.
 */
export const API_ENDPOINTS = {
  auth: {
    google: '/auth/google',
    me: '/auth/me',
    logout: '/auth/logout',
    devLogin: '/auth/dev-login',
  },
  dashboard: '/dashboard',
  contacts: '/contacts',
  imports: '/imports',
  calls: '/calls',
  emails: '/emails',
  emailAccounts: '/email-accounts',
  emailTemplates: '/email-templates',
  emailSignatures: '/email-signatures',
  analytics: '/analytics',
  health: '/health',
} as const;
