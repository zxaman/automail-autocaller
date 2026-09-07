import type { Types } from 'mongoose';

import type { UserRole } from '../users/user.model';

/** Authenticated principal attached to every protected request. */
export interface AuthContext {
  userId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  role: UserRole;
  sessionId: Types.ObjectId;
}

/** Safe user projection returned to the client. Never includes credentials. */
export interface AuthenticatedUserDto {
  id: string;
  name: string;
  email: string;
  profileImageUrl: string | null;
  role: UserRole;
  workspaceId: string;
  preferences: {
    timezone: string;
    locale: string;
    theme: 'light' | 'dark' | 'system';
  };
  lastLoginAt: string | null;
}

export interface LoginResult {
  user: AuthenticatedUserDto;
  token: string;
  expiresAt: Date;
  isNewUser: boolean;
}
