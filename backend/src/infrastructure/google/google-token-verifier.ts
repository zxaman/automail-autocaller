import { OAuth2Client, type TokenPayload } from 'google-auth-library';

import { env } from '../../config/environment';
import { AppError } from '../../shared/errors/app-error';

export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  pictureUrl: string | null;
}

/**
 * Isolates the Google integration behind one interface so the OAuth provider can
 * be swapped or extended (for example adding the authorization-code flow for
 * Gmail OAuth later) without touching authentication business logic.
 */
export interface GoogleTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

export class GoogleIdTokenVerifier implements GoogleTokenVerifier {
  private readonly client: OAuth2Client;

  constructor(private readonly clientId: string) {
    this.client = new OAuth2Client(clientId);
  }

  public async verify(idToken: string): Promise<GoogleIdentity> {
    let payload: TokenPayload | undefined;

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      // The underlying error can contain token material, so it is never surfaced.
      throw new AppError('Google sign-in could not be verified', 401, 'GOOGLE_TOKEN_INVALID');
    }

    if (!payload?.sub || !payload.email) {
      throw new AppError('Google sign-in did not return an account', 401, 'GOOGLE_TOKEN_INVALID');
    }

    if (payload.email_verified !== true) {
      throw new AppError(
        'This Google account does not have a verified email address',
        403,
        'GOOGLE_EMAIL_UNVERIFIED',
      );
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: true,
      name: payload.name?.trim() || payload.email.split('@')[0] || 'User',
      pictureUrl: payload.picture ?? null,
    };
  }
}

/** Returns null when Google sign-in has not been configured for this deployment. */
export function createGoogleTokenVerifier(): GoogleTokenVerifier | null {
  if (!env.GOOGLE_CLIENT_ID) {
    return null;
  }
  return new GoogleIdTokenVerifier(env.GOOGLE_CLIENT_ID);
}
