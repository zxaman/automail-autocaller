import mongoose from 'mongoose';

import { logger } from '../../infrastructure/logger/logger';
import { AppError } from '../../shared/errors/app-error';
import { hashPassword, verifyPassword } from '../../shared/utils/password';
import type { EmailAccountService } from '../email-accounts/email-account.service';
import { toAuthenticatedUserDto } from '../users/user.mapper';
import { UserModel, type UserDocument } from '../users/user.model';
import type { UserRepository } from '../users/user.repository';
import type { WorkspaceRepository } from '../workspaces/workspace.repository';
import type { AuthenticatedUserDto, LoginResult } from './auth.types';
import type { RegisterInput, LoginInput } from './auth.validation';
import type { SessionService } from './session.service';

export interface LoginRequestContext {
  userAgent: string | null;
  ipAddress: string | null;
}

/**
 * Authentication business logic.
 */
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly sessionService: SessionService,
    private readonly emailAccountService: EmailAccountService | null = null,
  ) {}

  public async register(
    input: RegisterInput,
    context: LoginRequestContext,
  ): Promise<LoginResult> {
    const existingByEmail = await this.userRepository.findByEmail(input.email);
    if (existingByEmail) {
      throw new AppError(
        'An account already exists for this email address',
        409,
        'ACCOUNT_EMAIL_CONFLICT',
      );
    }

    const existingByUsername = await this.userRepository.findByUsername(input.username);
    if (existingByUsername) {
      throw new AppError(
        'This username is already taken',
        409,
        'USERNAME_TAKEN',
      );
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.provisionUser({
      username: input.username,
      name: input.username,
      email: input.email,
      passwordHash,
      dateOfBirth: new Date(input.dateOfBirth),
      phoneNumber: input.phoneNumber,
      appCode: input.appCode,
      userType: 'root',
    });

    try {
      await this.connectDefaultEmailAccount(user._id, user.workspaceId, {
        email: input.email,
        displayName: input.username,
        appPassword: input.appCode,
        makeDefault: true,
      });
    } catch (error) {
      await this.userRepository.deleteById(user._id);
      await this.workspaceRepository.deleteById(user.workspaceId);
      throw error;
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
      { userId: user._id.toString(), workspaceId: user.workspaceId.toString() },
      'User registered successfully',
    );

    return {
      user: toAuthenticatedUserDto(user),
      token: issued.token,
      expiresAt: issued.expiresAt,
      isNewUser: true,
    };
  }

  public async login(
    input: LoginInput,
    context: LoginRequestContext,
  ): Promise<LoginResult> {
    const user = await UserModel.findOne({ email: input.email.toLowerCase() }).select('+passwordHash').exec();

    if (!user) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await verifyPassword(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('This account has been disabled', 403, 'ACCOUNT_DISABLED');
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
      { userId: user._id.toString() },
      'User authenticated successfully',
    );

    return {
      user: toAuthenticatedUserDto(user),
      token: issued.token,
      expiresAt: issued.expiresAt,
      isNewUser: false,
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

  private async provisionUser(identity: {
    username: string;
    name: string;
    email: string;
    passwordHash: string;
    dateOfBirth: Date;
    phoneNumber: string;
    appCode: string;
    userType: 'root' | 'employee';
  }): Promise<UserDocument> {
    const workspaceName = `${identity.username}'s workspace`;
    const placeholderOwnerId = new mongoose.Types.ObjectId();

    const workspace = await this.workspaceRepository.create({
      name: workspaceName,
      ownerId: placeholderOwnerId,
    });

    try {
      const user = await this.userRepository.create({
        username: identity.username,
        name: identity.name,
        email: identity.email,
        passwordHash: identity.passwordHash,
        dateOfBirth: identity.dateOfBirth,
        phoneNumber: identity.phoneNumber,
        appCode: identity.appCode,
        userType: identity.userType,
        profileImageUrl: null,
        role: 'owner',
        workspaceId: workspace._id,
      });

      await this.workspaceRepository.setOwner(workspace._id, user._id);
      return user;
    } catch (error) {
      await mongoose.model('Workspace').deleteOne({ _id: workspace._id }).exec();
      throw error;
    }
  }

  private async connectDefaultEmailAccount(
    userId: mongoose.Types.ObjectId,
    workspaceId: mongoose.Types.ObjectId,
    input: {
      email: string;
      displayName: string;
      appPassword: string;
      makeDefault: boolean;
    },
  ): Promise<void> {
    if (!this.emailAccountService) {
      return;
    }

    await this.emailAccountService.connect({ workspaceId }, userId, input);
  }
}
