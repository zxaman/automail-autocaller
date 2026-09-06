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
  readonly featureFlags: AppFeatureFlags;
}
