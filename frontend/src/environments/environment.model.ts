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
  /**
   * Absolute API origin used by native builds only.
   *
   * A relative path resolves against the device itself inside a Capacitor
   * WebView, so native needs a real origin. Left empty for web, where the
   * relative path is correct and avoids a cross-origin cookie.
   */
  readonly nativeApiOrigin: string;
  readonly appName: string;
  /**
   * Google OAuth *client ID* only. This value is public by design; the client
   * secret is never present in the frontend. Empty disables Google sign-in.
   */
  readonly googleClientId: string;
  readonly featureFlags: AppFeatureFlags;
}
