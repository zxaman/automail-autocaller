import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Types } from 'mongoose';

import type { SessionDocument } from './session.model';
import type { SessionRepository } from './session.repository';

const TOKEN_BYTES = 48;

export interface IssuedSession {
  token: string;
  expiresAt: Date;
  session: SessionDocument;
}

/**
 * Issues and validates opaque session tokens.
 *
 * An opaque random token is used instead of a self-contained JWT so that logout
 * and compromise response can revoke a session immediately server-side. Only the
 * SHA-256 hash is persisted, so a database leak does not yield usable sessions.
 */
export class SessionService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly ttlMs: number,
  ) {}

  public static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  public async issue(input: {
    userId: Types.ObjectId;
    workspaceId: Types.ObjectId;
    userAgent: string | null;
    ipAddress: string | null;
  }): Promise<IssuedSession> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);

    const session = await this.sessionRepository.create({
      tokenHash: SessionService.hashToken(token),
      userId: input.userId,
      workspaceId: input.workspaceId,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      expiresAt,
    });

    return { token, expiresAt, session };
  }

  public async resolve(token: string): Promise<SessionDocument | null> {
    if (!token) {
      return null;
    }

    const tokenHash = SessionService.hashToken(token);
    const session = await this.sessionRepository.findActiveByTokenHash(tokenHash);
    if (!session) {
      return null;
    }

    // Constant-time comparison keeps the lookup free of timing signal.
    const stored = Buffer.from(session.tokenHash, 'utf8');
    const provided = Buffer.from(tokenHash, 'utf8');
    if (stored.length !== provided.length || !timingSafeEqual(stored, provided)) {
      return null;
    }

    await this.sessionRepository.touch(session._id, new Date());
    return session;
  }

  public async revoke(token: string): Promise<void> {
    if (!token) {
      return;
    }
    await this.sessionRepository.revokeByTokenHash(SessionService.hashToken(token));
  }

  public async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await this.sessionRepository.revokeAllForUser(userId);
  }
}
