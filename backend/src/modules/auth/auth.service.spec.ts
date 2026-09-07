import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GoogleIdentity } from '../../infrastructure/google/google-token-verifier';
import { AppError } from '../../shared/errors/app-error';
import type { UserDocument } from '../users/user.model';
import type { UserRepository } from '../users/user.repository';
import type { WorkspaceRepository } from '../workspaces/workspace.repository';
import { AuthService } from './auth.service';
import type { SessionService } from './session.service';

function makeUser(overrides: Partial<UserDocument> = {}): UserDocument {
  return {
    _id: new Types.ObjectId(),
    googleId: 'google-sub-1',
    name: 'Rahul Sharma',
    email: 'rahul@example.com',
    profileImageUrl: null,
    role: 'owner',
    workspaceId: new Types.ObjectId(),
    preferences: { timezone: 'Asia/Kolkata', locale: 'en-IN', theme: 'light' },
    isActive: true,
    lastLoginAt: null,
    ...overrides,
  } as unknown as UserDocument;
}

const identity: GoogleIdentity = {
  googleId: 'google-sub-1',
  email: 'rahul@example.com',
  emailVerified: true,
  name: 'Rahul Sharma',
  pictureUrl: null,
};

describe('AuthService', () => {
  let userRepository: UserRepository;
  let workspaceRepository: WorkspaceRepository;
  let sessionService: SessionService;

  beforeEach(() => {
    userRepository = {
      findByGoogleId: vi.fn(async () => null),
      findByEmail: vi.fn(async () => null),
      findById: vi.fn(async () => null),
      create: vi.fn(async () => makeUser()),
      touchLogin: vi.fn(async () => undefined),
      updateProfileFromGoogle: vi.fn(async () => undefined),
    } as unknown as UserRepository;

    workspaceRepository = {
      create: vi.fn(async () => ({ _id: new Types.ObjectId() })),
      findById: vi.fn(async () => null),
      setOwner: vi.fn(async () => undefined),
    } as unknown as WorkspaceRepository;

    sessionService = {
      issue: vi.fn(async () => ({
        token: 'opaque-token',
        expiresAt: new Date(Date.now() + 86_400_000),
        session: {},
      })),
      resolve: vi.fn(),
      revoke: vi.fn(async () => undefined),
      revokeAllForUser: vi.fn(async () => undefined),
    } as unknown as SessionService;
  });

  function createService(verifier: { verify: () => Promise<GoogleIdentity> } | null): AuthService {
    return new AuthService(userRepository, workspaceRepository, sessionService, verifier);
  }

  it('fails clearly when Google sign-in is not configured', async () => {
    const service = createService(null);

    await expect(
      service.loginWithGoogle('token', { userAgent: null, ipAddress: null }),
    ).rejects.toMatchObject({ code: 'GOOGLE_AUTH_NOT_CONFIGURED', statusCode: 503 });
  });

  it('provisions a workspace and owner on first login', async () => {
    const service = createService({ verify: async () => identity });

    const result = await service.loginWithGoogle('token', { userAgent: null, ipAddress: null });

    expect(result.isNewUser).toBe(true);
    expect(workspaceRepository.create).toHaveBeenCalledOnce();
    expect(workspaceRepository.setOwner).toHaveBeenCalledOnce();
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'owner', email: 'rahul@example.com' }),
    );
  });

  it('reuses an existing account and refreshes the Google profile', async () => {
    const existing = makeUser();
    userRepository.findByGoogleId = vi.fn(async () => existing);
    const service = createService({
      verify: async () => ({ ...identity, name: 'Rahul S', pictureUrl: 'https://img/a.png' }),
    });

    const result = await service.loginWithGoogle('token', { userAgent: null, ipAddress: null });

    expect(result.isNewUser).toBe(false);
    expect(workspaceRepository.create).not.toHaveBeenCalled();
    expect(userRepository.updateProfileFromGoogle).toHaveBeenCalledWith(
      existing._id,
      expect.objectContaining({ name: 'Rahul S' }),
    );
  });

  it('refuses to auto-link an email owned by a different Google subject', async () => {
    userRepository.findByGoogleId = vi.fn(async () => null);
    userRepository.findByEmail = vi.fn(async () => makeUser({ googleId: 'other-sub' }));
    const service = createService({ verify: async () => identity });

    await expect(
      service.loginWithGoogle('token', { userAgent: null, ipAddress: null }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_EMAIL_CONFLICT', statusCode: 409 });
    expect(sessionService.issue).not.toHaveBeenCalled();
  });

  it('blocks a disabled account', async () => {
    userRepository.findByGoogleId = vi.fn(async () => makeUser({ isActive: false }));
    const service = createService({ verify: async () => identity });

    await expect(
      service.loginWithGoogle('token', { userAgent: null, ipAddress: null }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_DISABLED', statusCode: 403 });
  });

  it('returns a projection without credential or Google fields', async () => {
    userRepository.findByGoogleId = vi.fn(async () => makeUser());
    const service = createService({ verify: async () => identity });

    const result = await service.loginWithGoogle('token', { userAgent: null, ipAddress: null });

    expect(result.user).not.toHaveProperty('googleId');
    expect(result.user).not.toHaveProperty('isActive');
    expect(Object.keys(result.user).sort()).toEqual(
      ['email', 'id', 'lastLoginAt', 'name', 'preferences', 'profileImageUrl', 'role', 'workspaceId'].sort(),
    );
  });

  it('rejects the current-user lookup for a deactivated account', async () => {
    userRepository.findById = vi.fn(async () => makeUser({ isActive: false }));
    const service = createService({ verify: async () => identity });

    const error = await service.getCurrentUser(new Types.ObjectId()).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(401);
  });
});
