import type { Types } from 'mongoose';

import { SessionModel, type SessionDocument } from './session.model';

/** Data access for sessions. Only token hashes are ever persisted or queried. */
export class SessionRepository {
  public async create(attributes: {
    tokenHash: string;
    userId: Types.ObjectId;
    workspaceId: Types.ObjectId;
    userAgent: string | null;
    ipAddress: string | null;
    expiresAt: Date;
  }): Promise<SessionDocument> {
    return SessionModel.create(attributes);
  }

  public async findActiveByTokenHash(tokenHash: string): Promise<SessionDocument | null> {
    return SessionModel.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).exec();
  }

  public async revokeByTokenHash(tokenHash: string): Promise<void> {
    await SessionModel.updateOne(
      { tokenHash, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    ).exec();
  }

  public async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await SessionModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    ).exec();
  }

  public async touch(sessionId: Types.ObjectId, at: Date): Promise<void> {
    await SessionModel.updateOne({ _id: sessionId }, { $set: { lastUsedAt: at } }).exec();
  }
}
