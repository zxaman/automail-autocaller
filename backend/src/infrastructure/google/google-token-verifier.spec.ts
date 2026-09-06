import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../shared/errors/app-error';
import { GoogleIdTokenVerifier } from './google-token-verifier';

/**
 * The Google client is stubbed so these tests never reach the network and can
 * assert that no token material leaks into the thrown error.
 */
const verifyIdToken = vi.fn();

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    public verifyIdToken = verifyIdToken;
  },
}));

describe('GoogleIdTokenVerifier', () => {
  const verifier = new GoogleIdTokenVerifier('client-id.apps.googleusercontent.com');

  it('maps a verified Google payload to an identity', async () => {
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: 'google-sub-1',
        email: 'Rahul@Example.com',
        email_verified: true,
        name: 'Rahul Sharma',
        picture: 'https://example.com/avatar.png',
      }),
    });

    await expect(verifier.verify('token')).resolves.toEqual({
      googleId: 'google-sub-1',
      email: 'rahul@example.com',
      emailVerified: true,
      name: 'Rahul Sharma',
      pictureUrl: 'https://example.com/avatar.png',
    });
  });

  it('rejects an unverified email address', async () => {
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ sub: 'x', email: 'a@b.com', email_verified: false }),
    });

    await expect(verifier.verify('token')).rejects.toMatchObject({
      code: 'GOOGLE_EMAIL_UNVERIFIED',
      statusCode: 403,
    });
  });

  it('never leaks the underlying failure or the token', async () => {
    verifyIdToken.mockRejectedValueOnce(new Error('Invalid JWS signature for token abc.def.ghi'));

    const error = await verifier.verify('abc.def.ghi').catch((value: unknown) => value);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('GOOGLE_TOKEN_INVALID');
    expect((error as AppError).message).not.toContain('abc.def.ghi');
    expect((error as AppError).message).not.toContain('JWS');
  });

  it('rejects a payload without a subject', async () => {
    verifyIdToken.mockResolvedValueOnce({ getPayload: () => undefined });

    await expect(verifier.verify('token')).rejects.toMatchObject({
      code: 'GOOGLE_TOKEN_INVALID',
    });
  });

  it('falls back to the email local part when Google omits a name', async () => {
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ sub: 's', email: 'priya@example.com', email_verified: true }),
    });

    await expect(verifier.verify('token')).resolves.toMatchObject({ name: 'priya' });
  });
});
