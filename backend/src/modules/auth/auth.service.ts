import mongoose from 'mongoose';

import type { GoogleTokenVerifier } from '../../infrastructure/google/google-token-verifier';
import { logger } from '../../infrastructure/logger/logger';
import { AppError } from '../../shared/errors/app-error';
import { toAuthenticatedUserDto } from '../users/user.mapper';
import type { UserDocument } from '../users/user.model';
import type { UserRepository } from '../users/user.repository';
import type { WorkspaceRepository } from '../workspaces/workspace.repository';
import type { AuthenticatedUserDto, LoginResult } from './auth.types';
import type { SessionService } from './session.service';

export interface LoginRequestContext {
  userAgent: string | null;
  ipAddress: string | null;
}

/**
 * Authentication business logic.
 *
 * Responsibilities: verify the Google identity, provision the user and their
 * private workspace on first login, and issue a revocable session.
 */
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly sessionService: SessionService,
    private readonly googleVerifier: GoogleTokenVerifier | null,
  ) {}

  public async loginWithGoogle(
    idToken: string,
    context: LoginRequestContext,
  ): Promise<LoginResult> {
    if (!this.googleVerifier) {
      throw new AppError(
        'Google sign-in is not configured on this server',
        503,
        'GOOGLE_AUTH_NOT_CONFIGURED',
      );
    }

    const identity = await this.googleVerifier.verify(idToken);

    let user = await this.userRepository.findByGoogleId(identity.googleId);
    let isNewUser = false;

    if (!user) {
      const existingByEmail = await this.userRepository.findByEmail(identity.email);
      if (existingByEmail) {
        // The address already belongs to another Google subject. Refusing to
        // link automatically prevents an account-takeover path.
        throw new AppError(
          'An account already exists for this email address',
          409,
          'ACCOUNT_EMAIL_CONFLICT',
        );
      }

      user = await this.provisionUser(identity);
      isNewUser = true;
    } else {
      if (!user.isActive) {
        throw new AppError('This account has been disabled', 403, 'ACCOUNT_DISABLED');
      }
      await this.userRepository.updateProfileFromGoogle(user._id, {
        name: identity.name,
        profileImageUrl: identity.pictureUrl,
      });
      user.name = identity.name;
      user.profileImageUrl = identity.pictureUrl;
    }

    const now = new Date();
    await this.userRepository.touchLogin(user._id, now);
    user.lastLoginAt = now;

    const issued = await this.sessionService.issue({
      userId: user._id,
      workspaceId: user.workspaceId,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
    });

    logger.info(
      { userId: user._id.toString(), workspaceId: user.workspaceId.toString(), isNewUser },
      'User authenticated with Google',
    );

    return {
      user: toAuthenticatedUserDto(user),
      token: issued.token,
      expiresAt: issued.expiresAt,
      isNewUser,
    };
  }

  public async getCurrentUser(userId: mongoose.Types.ObjectId): Promise<AuthenticatedUserDto> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new AppError('Session is no longer valid', 401, 'SESSION_INVALID');
    }
    return toAuthenticatedUserDto(user);
  }

  public async logout(token: string): Promise<void> {
    await this.sessionService.revoke(token);
  }

  /**
   * Creates the user and their private workspace.
   * A transaction is used when the deployment supports it (replica set); the
   * standalone fallback repairs ownership immediately after creation.
   */
  private async provisionUser(identity: {
    googleId: string;
    email: string;
    name: string;
    pictureUrl: string | null;
  }): Promise<UserDocument> {
    const workspaceName = `${identity.name}'s workspace`;
    const placeholderOwnerId = new mongoose.Types.ObjectId();

    const workspace = await this.workspaceRepository.create({
      name: workspaceName,
      ownerId: placeholderOwnerId,
    });

    try {
      const user = await this.userRepository.create({
        googleId: identity.googleId,
        name: identity.name,
        email: identity.email,
        profileImageUrl: identity.pictureUrl,
        role: 'owner',
        workspaceId: workspace._id,
      });

      await this.workspaceRepository.setOwner(workspace._id, user._id);
      return user;
    } catch (error) {
      // Do not leave an orphan workspace behind if user creation fails.
      await mongoose.model('Workspace').deleteOne({ _id: workspace._id }).exec();
      throw error;
    }
  }
}
