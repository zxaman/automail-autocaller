import type { NavigationItem } from '../models/navigation.model';

/**
 * Single source of truth for primary navigation.
 * Sidebar, mobile navigation, and header page titles all read from this list.
 */
export const PRIMARY_NAVIGATION: readonly NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Home',
    route: '/dashboard',
    icon: 'dashboard',
    primary: true,
  },
  {
    id: 'contacts',
    label: 'Contacts',
    shortLabel: 'Contacts',
    route: '/contacts',
    icon: 'contacts',
    primary: true,
  },
  {
    id: 'calls',
    label: 'Calls',
    shortLabel: 'Calls',
    route: '/calls',
    icon: 'calls',
    primary: true,
    featureFlag: 'calling',
  },
  {
    id: 'emails',
    label: 'Emails',
    shortLabel: 'Emails',
    route: '/emails',
    icon: 'emails',
    primary: true,
  },
  {
    id: 'templates',
    label: 'Templates',
    shortLabel: 'Templates',
    route: '/templates',
    icon: 'templates',
    primary: false,
  },
  {
    id: 'imports',
    label: 'Imports',
    shortLabel: 'Imports',
    route: '/imports',
    icon: 'imports',
    primary: false,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    shortLabel: 'Analytics',
    route: '/analytics',
    icon: 'analytics',
    primary: false,
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    route: '/settings',
    icon: 'settings',
    primary: true,
  },
];
