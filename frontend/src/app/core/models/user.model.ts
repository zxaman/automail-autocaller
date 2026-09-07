export type UserRole = 'owner' | 'admin' | 'manager' | 'agent';

export type UserType = 'root' | 'employee';

export interface UserPreferences {
  readonly timezone: string;
  readonly locale: string;
  readonly theme: 'light' | 'dark' | 'system';
}

export interface AuthenticatedUser {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly email: string;
  readonly userType: UserType;
  readonly phoneNumber: string;
  readonly dateOfBirth: string | null;
  readonly appCode: string;
  readonly profileImageUrl: string | null;
  readonly role: UserRole;
  readonly workspaceId: string;
  readonly preferences: UserPreferences;
  readonly lastLoginAt: string | null;
}

export interface RegisterRequest {
  readonly username: string;
  readonly email: string;
  readonly password: string;
  readonly dateOfBirth: string;
  readonly phoneNumber: string;
  readonly appCode: string;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}
