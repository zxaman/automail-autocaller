export type UserRole = 'owner' | 'admin' | 'manager' | 'agent';

export interface UserPreferences {
  readonly timezone: string;
  readonly locale: string;
  readonly theme: 'light' | 'dark' | 'system';
}

export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly profileImageUrl: string | null;
  readonly role: UserRole;
  readonly workspaceId: string;
  readonly preferences: UserPreferences;
  readonly lastLoginAt: string | null;
}
