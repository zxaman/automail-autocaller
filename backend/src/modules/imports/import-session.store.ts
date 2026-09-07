import { randomUUID } from 'node:crypto';
import type { Types } from 'mongoose';

import type { ParsedSheet, SheetSummary } from './import.types';

/** Sessions are short-lived; an abandoned upload must not linger in memory. */
export const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS_PER_WORKSPACE = 5;

export interface ImportSession {
  id: string;
  workspaceId: string;
  ownerId: string;
  fileName: string;
  fileSizeBytes: number;
  sheet: ParsedSheet;
  sheets: SheetSummary[];
  headerRowIndex: number;
  hasHeaderRow: boolean;
  dataStartRowIndex: number;
  createdAt: number;
  expiresAt: number;
}

export interface CreateSessionInput {
  workspaceId: Types.ObjectId;
  ownerId: Types.ObjectId;
  fileName: string;
  fileSizeBytes: number;
  sheet: ParsedSheet;
  sheets: SheetSummary[];
  headerRowIndex: number;
  hasHeaderRow: boolean;
  dataStartRowIndex: number;
}

/**
 * Holds parsed uploads between the analyze and commit steps.
 *
 * Deliberately in-memory: the grid is transient working state, and MongoDB is
 * the wrong place for a multi-megabyte blob (rules forbid large files there).
 * The tradeoff is that a restart or a second instance loses in-flight sessions,
 * which is acceptable because the user can simply re-upload. Moving this to
 * Redis is the natural step when the API is scaled horizontally.
 */
export class ImportSessionStore {
  private readonly sessions = new Map<string, ImportSession>();

  public create(input: CreateSessionInput): ImportSession {
    this.evictExpired();

    const workspaceId = input.workspaceId.toString();
    this.enforceWorkspaceQuota(workspaceId);

    const now = Date.now();
    const session: ImportSession = {
      id: randomUUID(),
      workspaceId,
      ownerId: input.ownerId.toString(),
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes,
      sheet: input.sheet,
      sheets: input.sheets,
      headerRowIndex: input.headerRowIndex,
      hasHeaderRow: input.hasHeaderRow,
      dataStartRowIndex: input.dataStartRowIndex,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Scoped by workspace: a session id from another workspace is indistinguishable
   * from one that never existed.
   */
  public find(sessionId: string, workspaceId: Types.ObjectId): ImportSession | null {
    this.evictExpired();

    const session = this.sessions.get(sessionId);
    if (!session || session.workspaceId !== workspaceId.toString()) {
      return null;
    }

    return session;
  }

  public delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  public get size(): number {
    return this.sessions.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(id);
      }
    }
  }

  /** Bounds memory: a workspace repeatedly uploading drops its oldest session. */
  private enforceWorkspaceQuota(workspaceId: string): void {
    const owned = [...this.sessions.values()]
      .filter((session) => session.workspaceId === workspaceId)
      .sort((a, b) => a.createdAt - b.createdAt);

    while (owned.length >= MAX_SESSIONS_PER_WORKSPACE) {
      const oldest = owned.shift();
      if (oldest) {
        this.sessions.delete(oldest.id);
      }
    }
  }
}
