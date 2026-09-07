import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionDocument } from './session.model';
import type { SessionRepository } from './session.repository';
import { SessionService } from './session.service';

/**
 * In-memory session repository so token issuance and revocation can be verified
 * without a database.
 */
function createFakeRepository() {
  const rows: Array<{ tokenHash: string; revokedAt: Date | null; expiresAt: Date; _id: Types.ObjectId }> =
    [];

  const repository: SessionRepository = {
    create: vi.fn(async (attributes) => {
      const row = {
        _id: new Types.ObjectId(),
        tokenHash: attributes.tokenHash,
        revokedAt: null,
        expiresAt: attributes.expiresAt,
      };
      rows.push(row);
      return row as unknown as SessionDocument;
    }),
    findActiveByTokenHash: vi.fn(async (tokenHash: string) => {
      const row = rows.find(
        (item) => item.tokenHash === tokenHash && !item.revokedAt && item.expiresAt > new Date(),
      );
      return (row ?? null) as unknown as SessionDocument | null;
    }),
    revokeByTokenHash: vi.fn(async (tokenHash: string) => {
      const row = rows.find((item) => item.tokenHash === tokenHash);
      if (row) {
        row.revokedAt = new Date();
      }
    }),
    revokeAllForUser: vi.fn(async () => undefined),
    touch: vi.fn(async () => undefined),
  } as unknown as SessionRepository;

  return { repository, rows };
}

describe('SessionService', () => {
  let fake: ReturnType<typeof createFakeRepository>;
  let service: SessionService;

  beforeEach(() => {
    fake = createFakeRepository();
    service = new SessionService(fake.repository, 7 * 86_400_000);
  });

  it('stores only the hash of the issued token', async () => {
    const issued = await service.issue({
      userId: new Types.ObjectId(),
      workspaceId: new Types.ObjectId(),
      userAgent: null,
      ipAddress: null,
    });

    expect(issued.token).toBeTruthy();
    expect(fake.rows[0]?.tokenHash).not.toBe(issued.token);
    expect(fake.rows[0]?.tokenHash).toBe(SessionService.hashToken(issued.token));
    expect(fake.rows[0]?.tokenHash).toHaveLength(64);
  });

  it('issues a unique token every time', async () => {
    const input = {
      userId: new Types.ObjectId(),
      workspaceId: new Types.ObjectId(),
      userAgent: null,
      ipAddress: null,
    };
    const first = await service.issue(input);
    const second = await service.issue(input);

    expect(first.token).not.toBe(second.token);
  });

  it('resolves a valid token and records usage', async () => {
    const issued = await service.issue({
      userId: new Types.ObjectId(),
      workspaceId: new Types.ObjectId(),
      userAgent: null,
      ipAddress: null,
    });

    await expect(service.resolve(issued.token)).resolves.not.toBeNull();
    expect(fake.repository.touch).toHaveBeenCalledOnce();
  });

  it('does not resolve an unknown or empty token', async () => {
    await expect(service.resolve('not-a-token')).resolves.toBeNull();
    await expect(service.resolve('')).resolves.toBeNull();
  });

  it('does not resolve a revoked token', async () => {
    const issued = await service.issue({
      userId: new Types.ObjectId(),
      workspaceId: new Types.ObjectId(),
      userAgent: null,
      ipAddress: null,
    });

    await service.revoke(issued.token);

    await expect(service.resolve(issued.token)).resolves.toBeNull();
  });

  it('applies the configured expiry window', async () => {
    const before = Date.now();
    const issued = await service.issue({
      userId: new Types.ObjectId(),
      workspaceId: new Types.ObjectId(),
      userAgent: null,
      ipAddress: null,
    });

    const ttl = issued.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThan(6.9 * 86_400_000);
    expect(ttl).toBeLessThanOrEqual(7 * 86_400_000 + 1000);
  });
});
