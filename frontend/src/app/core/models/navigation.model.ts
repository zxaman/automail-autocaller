export type NavigationIcon =
  | 'dashboard'
  | 'contacts'
  | 'calls'
  | 'emails'
  | 'templates'
  | 'imports'
  | 'analytics'
  | 'settings';

export interface NavigationItem {
  /** Stable identifier used for tracking and tests. */
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly route: string;
  readonly icon: NavigationIcon;
  /** Shown in mobile bottom navigation when true. */
  readonly primary: boolean;
  readonly featureFlag?: 'calling' | 'campaigns' | 'team';
}
