export interface AppFeatureFlags {
  readonly calling: boolean;
  readonly campaigns: boolean;
  readonly team: boolean;
}

export interface AppEnvironment {
  readonly production: boolean;
  /**
   * Relative API base path. Browser-facing code must never target an absolute
   * localhost URL because the browser is not the server host.
   */
  readonly apiBaseUrl: string;
  readonly appName: string;
  /**
   * Google OAuth *client ID* only. This value is public by design; the client
   * secret is never present in the frontend. Empty disables Google sign-in.
   */
  readonly googleClientId: string;
  readonly featureFlags: AppFeatureFlags;
}
