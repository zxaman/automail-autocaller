import { Types } from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImportSessionStore, SESSION_TTL_MS } from './import-session.store';

const workspaceA = new Types.ObjectId();
const workspaceB = new Types.ObjectId();
const ownerId = new Types.ObjectId();

function input(workspaceId: Types.ObjectId, fileName = 'contacts.xlsx') {
  return {
    workspaceId,
    ownerId,
    fileName,
    fileSizeBytes: 1024,
    sheet: { sheetName: 'Sheet1', rows: [['Name'], ['Asha']] },
    sheets: [{ name: 'Sheet1', rowCount: 2 }],
    headerRowIndex: 0,
    hasHeaderRow: true,
    dataStartRowIndex: 1,
  };
}

describe('ImportSessionStore', () => {
  let store: ImportSessionStore;

  beforeEach(() => {
    store = new ImportSessionStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves a session within its workspace', () => {
    const session = store.create(input(workspaceA));
    expect(store.find(session.id, workspaceA)?.fileName).toBe('contacts.xlsx');
  });

  it('hides a session from another workspace', () => {
    const session = store.create(input(workspaceA));
    expect(store.find(session.id, workspaceB)).toBeNull();
  });

  it('expires a session once its TTL has passed', () => {
    const session = store.create(input(workspaceA));

    vi.advanceTimersByTime(SESSION_TTL_MS + 1000);

    expect(store.find(session.id, workspaceA)).toBeNull();
  });

  it('drops the oldest session when a workspace exceeds its quota', () => {
    const first = store.create(input(workspaceA, 'first.xlsx'));
    for (let index = 0; index < 5; index += 1) {
      vi.advanceTimersByTime(10);
      store.create(input(workspaceA, `file-${index}.xlsx`));
    }

    expect(store.find(first.id, workspaceA)).toBeNull();
    expect(store.size).toBeLessThanOrEqual(5);
  });

  it('deletes a session explicitly once it has been committed', () => {
    const session = store.create(input(workspaceA));
    store.delete(session.id);

    expect(store.find(session.id, workspaceA)).toBeNull();
  });
});
