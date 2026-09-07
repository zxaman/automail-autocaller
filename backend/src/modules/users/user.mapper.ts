import type { AuthenticatedUserDto } from '../auth/auth.types';
import type { UserDocument } from './user.model';

/**
 * Maps a user document to the client projection.
 * Explicit field selection guarantees no internal or sensitive field leaks.
 */
export function toAuthenticatedUserDto(user: UserDocument): AuthenticatedUserDto {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    profileImageUrl: user.profileImageUrl,
    role: user.role,
    workspaceId: user.workspaceId.toString(),
    preferences: {
      timezone: user.preferences.timezone,
      locale: user.preferences.locale,
      theme: user.preferences.theme,
    },
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}
