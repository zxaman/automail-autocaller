import request from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app';
import { createTestMongo, type TestMongo } from '../../../test/mongo';
import type { GoogleIdentity } from '../../infrastructure/google/google-token-verifier';
import { SessionModel } from './session.model';
import { UserModel } from '../users/user.model';
import { WorkspaceModel } from '../workspaces/workspace.model';

/** Google verification is stubbed so tests never touch the network. */
const verifyMock = vi.fn<(idToken: string) => Promise<GoogleIdentity>>();

vi.mock('../../infrastructure/google/google-token-verifier', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../infrastructure/google/google-token-verifier')
  >();
  return {
    ...actual,
    createGoogleTokenVerifier: () => ({ verify: verifyMock }),
  };
});

// Resolved before the suites are registered so unavailable infrastructure
// skips the integration tests rather than failing them.
const testMongo: TestMongo = await createTestMongo();
const describeWithDb = testMongo.available ? describe : describe.skip;

if (!testMongo.available) {
  console.warn(
    'Skipping authentication integration tests: no MongoDB is reachable. ' +
      'Start one with `docker compose up -d` or set MONGODB_TEST_URI.',
  );
}

const app = createApp();

function identity(overrides: Partial<GoogleIdentity> = {}): GoogleIdentity {
  return {
    googleId: 'google-sub-1',
    email: 'rahul@example.com',
    emailVerified: true,
    name: 'Rahul Sharma',
    pictureUrl: null,
    ...overrides,
  };
}

const VALID_TOKEN = 'a'.repeat(24);

function sessionCookie(response: request.Response): string {
  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cookies?.find((value) => value.startsWith('aca_session='));
  if (!cookie) {
    throw new Error('No session cookie was issued');
  }
  return cookie.split(';')[0] as string;
}

afterAll(async () => {
  await testMongo?.disconnect();
});

afterEach(async () => {
  vi.clearAllMocks();
  if (!testMongo.available) {
    return;
  }
  await Promise.all([
    UserModel.deleteMany({}),
    WorkspaceModel.deleteMany({}),
    SessionModel.deleteMany({}),
  ]);
});

describeWithDb('POST /api/v1/auth/google', () => {
  it('creates the user and a private workspace on first login', async () => {
    verifyMock.mockResolvedValue(identity());

    const response = await request(app).post('/api/v1/auth/google').send({ idToken: VALID_TOKEN });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: { email: 'rahul@example.com', name: 'Rahul Sharma', role: 'owner' },
    });

    const user = await UserModel.findOne({ email: 'rahul@example.com' }).exec();
    expect(user).not.toBeNull();

    const workspace = await WorkspaceModel.findById(user!.workspaceId).exec();
    expect(workspace).not.toBeNull();
    expect(workspace!.ownerId.toString()).toBe(user!._id.toString());
  });

  it('reuses the existing user on a subsequent login', async () => {
    verifyMock.mockResolvedValue(identity());

    const first = await request(app).post('/api/v1/auth/google').send({ idToken: VALID_TOKEN });
    const second = await request(app).post('/api/v1/auth/google').send({ idToken: VALID_TOKEN });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(await UserModel.countDocuments({})).toBe(1);
    expect(await WorkspaceModel.countDocuments({})).toBe(1);
  });

  it('issues an HttpOnly session cookie and never returns the raw token', async () => {
    verifyMock.mockResolvedValue(identity());

    const response = await request(app).post('/api/v1/auth/google').send({ idToken: VALID_TOKEN });
    const cookies = response.headers['set-cookie'] as unknown as string[];
    const cookie = cookies.find((value) => value.startsWith('aca_session='))!;

    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
    expect(JSON.stringify(response.body)).not.toContain('aca_session');

    // Only the hash is persisted.
    const session = await SessionModel.findOne({}).exec();
    const rawToken = cookie.split('=')[1]!.split(';')[0]!;
    expect(session!.tokenHash).not.toBe(rawToken);
    expect(session!.tokenHash).toHaveLength(64);
  });

  it('rejects a malformed credential before verification runs', async () => {
    const response = await request(app).post('/api/v1/auth/google').send({ idToken: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('refuses to link an email that belongs to another Google account', async () => {
    verifyMock.mockResolvedValueOnce(identity());
    await request(app).post('/api/v1/auth/google').send({ idToken: VALID_TOKEN });

    verifyMock.mockResolvedValueOnce(identity({ googleId: 'google-sub-2' }));
    const response = await request(app).post('/api/v1/auth/google').send({ idToken: VALID_TOKEN });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ACCOUNT_EMAIL_CONFLICT');
  });
});

describeWithDb('GET /api/v1/auth/me', () => {
  it('denies access without a session', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a forged session cookie', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'aca_session=not-a-real-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('returns the authenticated user for a valid session', async () => {
    verifyMock.mockResolvedValue(identity());
    const login = await request(app).post('/api/v1/auth/google').send({ idToken: VALID_TOKEN });

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie(login));

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe('rahul@example.com');
    expect(response.body.data).not.toHaveProperty('googleId');
  });

  it('rejects a session belonging to a deactivated account', async () => {
    verifyMock.mockResolvedValue(identity());
    const login = await request(app).post('/api/v1/auth/google').send({ idToken: VALID_TOKEN });

    await UserModel.updateOne({ email: 'rahul@example.com' }, { $set: { isActive: false } }).exec();

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie(login));

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SESSION_INVALID');
  });
});

describeWithDb('POST /api/v1/auth/logout', () => {
  it('revokes the session so the cookie can no longer be replayed', async () => {
    verifyMock.mockResolvedValue(identity());
    const login = await request(app).post('/api/v1/auth/google').send({ idToken: VALID_TOKEN });
    const cookie = sessionCookie(login);

    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);

    const replay = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(replay.status).toBe(401);

    const session = await SessionModel.findOne({}).exec();
    expect(session!.revokedAt).not.toBeNull();
  });

  it('requires authentication', async () => {
    const response = await request(app).post('/api/v1/auth/logout');
    expect(response.status).toBe(401);
  });
});

describeWithDb('workspace isolation', () => {
  it('gives each user a distinct workspace and session identity', async () => {
    verifyMock.mockResolvedValueOnce(identity());
    const userA = await request(app).post('/api/v1/auth/google').send({ idToken: VALID_TOKEN });

    verifyMock.mockResolvedValueOnce(
      identity({ googleId: 'google-sub-2', email: 'priya@example.com', name: 'Priya Singh' }),
    );
    const userB = await request(app).post('/api/v1/auth/google').send({ idToken: VALID_TOKEN });

    expect(userA.body.data.workspaceId).not.toBe(userB.body.data.workspaceId);

    // User A's cookie must never resolve to user B's identity.
    const meA = await request(app).get('/api/v1/auth/me').set('Cookie', sessionCookie(userA));
    expect(meA.body.data.email).toBe('rahul@example.com');
    expect(meA.body.data.workspaceId).toBe(userA.body.data.workspaceId);

    const meB = await request(app).get('/api/v1/auth/me').set('Cookie', sessionCookie(userB));
    expect(meB.body.data.email).toBe('priya@example.com');
  });
});
