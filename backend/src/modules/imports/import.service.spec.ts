import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ImportSessionStore } from './import-session.store';
import { ImportService } from './import.service';
import type { ImportRepository, ImportScope } from './import.repository';
import type { ColumnAssignment } from './import.types';

const scope: ImportScope = { workspaceId: new Types.ObjectId() };
const ownerId = new Types.ObjectId();
const batchId = new Types.ObjectId();

function createRepository() {
  return {
    loadExistingIndex: vi.fn().mockResolvedValue({ byEmail: new Map(), byPhone: new Map() }),
    insertContacts: vi.fn().mockResolvedValue({ insertedCount: 0, failedIndexes: new Map() }),
    updateContact: vi.fn().mockResolvedValue(undefined),
    createBatch: vi.fn().mockResolvedValue({ _id: batchId }),
    completeBatch: vi.fn().mockResolvedValue(null),
    listBatches: vi.fn().mockResolvedValue([]),
    findBatchById: vi.fn().mockResolvedValue(null),
  };
}

function mappingFor(fields: ColumnAssignment[]) {
  return fields.map((field, columnIndex) => ({ columnIndex, field }));
}

describe('ImportService', () => {
  let repository: ReturnType<typeof createRepository>;
  let store: ImportSessionStore;
  let service: ImportService;

  beforeEach(() => {
    repository = createRepository();
    store = new ImportSessionStore();
    service = new ImportService(repository as unknown as ImportRepository, store);
  });

  function seedSession(rows: string[][], dataStartRowIndex = 1) {
    return store.create({
      workspaceId: scope.workspaceId,
      ownerId,
      fileName: 'contacts.xlsx',
      fileSizeBytes: 2048,
      sheet: { sheetName: 'Sheet1', rows },
      sheets: [{ name: 'Sheet1', rowCount: rows.length }],
      headerRowIndex: 0,
      hasHeaderRow: true,
      dataStartRowIndex,
    });
  }

  const validRows = [
    ['Name', 'Phone', 'Email'],
    ['Asha Menon', '9812345678', 'asha@example.com'],
    ['Ravi Kumar', '9812345679', 'ravi@example.com'],
  ];

  it('imports valid rows and records the batch', async () => {
    const session = seedSession(validRows);

    const result = await service.commit(scope, ownerId, {
      sessionId: session.id,
      mapping: mappingFor(['name', 'phone', 'email']),
      duplicateStrategy: 'skip',
      tags: [],
    });

    expect(repository.insertContacts).toHaveBeenCalled();
    const inserted = repository.insertContacts.mock.calls[0]![3] as { name: string }[];
    expect(inserted).toHaveLength(2);
    expect(result.successfulRows).toBe(2);
    expect(result.failedRows).toBe(0);
  });

  it('reports invalid rows with their spreadsheet row numbers', async () => {
    const session = seedSession([
      ['Name', 'Phone', 'Email'],
      ['Asha Menon', '9812345678', 'asha@example.com'],
      ['Broken Row', '12', 'not-an-email'],
    ]);

    const result = await service.commit(scope, ownerId, {
      sessionId: session.id,
      mapping: mappingFor(['name', 'phone', 'email']),
      duplicateStrategy: 'skip',
      tags: [],
    });

    expect(result.failedRows).toBe(1);
    expect(result.errors[0]?.rowNumber).toBe(3);
    expect(result.errors[0]?.reason).toContain('not a valid phone number');
  });

  it('skips contacts that already exist when the strategy is skip', async () => {
    repository.loadExistingIndex = vi.fn().mockResolvedValue({
      byEmail: new Map([['asha@example.com', { _id: new Types.ObjectId(), tags: [] }]]),
      byPhone: new Map(),
    });

    const session = seedSession(validRows);
    const result = await service.commit(scope, ownerId, {
      sessionId: session.id,
      mapping: mappingFor(['name', 'phone', 'email']),
      duplicateStrategy: 'skip',
      tags: [],
    });

    expect(result.duplicateRows).toBe(1);
    expect(repository.insertContacts.mock.calls[0]![3]).toHaveLength(1);
  });

  it('updates existing contacts when the strategy is update, merging tags', async () => {
    const existingId = new Types.ObjectId();
    repository.loadExistingIndex = vi.fn().mockResolvedValue({
      byEmail: new Map([['asha@example.com', { _id: existingId, tags: ['existing'] }]]),
      byPhone: new Map(),
    });

    const session = seedSession(validRows);
    const result = await service.commit(scope, ownerId, {
      sessionId: session.id,
      mapping: mappingFor(['name', 'phone', 'email']),
      duplicateStrategy: 'update',
      tags: ['q3'],
    });

    expect(result.updatedRows).toBe(1);
    const updateArgs = repository.updateContact.mock.calls[0]!;
    expect(updateArgs[1]).toBe(existingId);
    expect((updateArgs[2] as { tags: string[] }).tags).toEqual(['existing', 'q3']);
  });

  it('treats repeats inside the same file as duplicates', async () => {
    const session = seedSession([
      ['Name', 'Phone', 'Email'],
      ['Asha Menon', '9812345678', 'asha@example.com'],
      ['Asha Menon Again', '9812345678', 'asha@example.com'],
    ]);

    const result = await service.commit(scope, ownerId, {
      sessionId: session.id,
      mapping: mappingFor(['name', 'phone', 'email']),
      duplicateStrategy: 'import',
      tags: [],
    });

    expect(result.duplicateRows).toBe(1);
    expect(repository.insertContacts.mock.calls[0]![3]).toHaveLength(1);
  });

  it('refuses a mapping with no name column', async () => {
    const session = seedSession(validRows);

    await expect(
      service.commit(scope, ownerId, {
        sessionId: session.id,
        mapping: mappingFor(['ignore', 'phone', 'email']),
        duplicateStrategy: 'skip',
        tags: [],
      }),
    ).rejects.toThrow(/name/i);
  });

  it('refuses a mapping with neither a phone nor an email column', async () => {
    const session = seedSession(validRows);

    await expect(
      service.commit(scope, ownerId, {
        sessionId: session.id,
        mapping: mappingFor(['name', 'ignore', 'ignore']),
        duplicateStrategy: 'skip',
        tags: [],
      }),
    ).rejects.toThrow(/phone number or an email/i);
  });

  it('rejects a session belonging to another workspace', async () => {
    const session = seedSession(validRows);

    await expect(
      service.commit({ workspaceId: new Types.ObjectId() }, ownerId, {
        sessionId: session.id,
        mapping: mappingFor(['name', 'phone', 'email']),
        duplicateStrategy: 'skip',
        tags: [],
      }),
    ).rejects.toThrow(/expired/i);
  });

  it('applies import-wide tags to every created contact', async () => {
    const session = seedSession(validRows);

    await service.commit(scope, ownerId, {
      sessionId: session.id,
      mapping: mappingFor(['name', 'phone', 'email']),
      duplicateStrategy: 'skip',
      tags: ['q3-campaign'],
    });

    const inserted = repository.insertContacts.mock.calls[0]![3] as { tags: string[] }[];
    expect(inserted.every((entry) => entry.tags.includes('q3-campaign'))).toBe(true);
  });

  it('stores phoneNormalized in the same E.164 form the contacts module uses', async () => {
    const session = seedSession(validRows);

    await service.commit(scope, ownerId, {
      sessionId: session.id,
      mapping: mappingFor(['name', 'phone', 'email']),
      duplicateStrategy: 'skip',
      tags: [],
    });

    const inserted = repository.insertContacts.mock.calls[0]![3] as {
      phone: string;
      phoneNormalized: string;
    }[];
    expect(inserted[0]?.phoneNormalized).toBe('+919812345678');
    expect(inserted[0]?.phoneNormalized).toBe(inserted[0]?.phone);
  });

  it('consumes the session so a commit cannot be replayed', async () => {
    const session = seedSession(validRows);
    const request = {
      sessionId: session.id,
      mapping: mappingFor(['name', 'phone', 'email']),
      duplicateStrategy: 'skip' as const,
      tags: [],
    };

    await service.commit(scope, ownerId, request);

    await expect(service.commit(scope, ownerId, request)).rejects.toThrow(/expired/i);
  });

  it('marks rows that fail the database write as failed', async () => {
    repository.insertContacts = vi.fn().mockResolvedValue({
      insertedCount: 1,
      failedIndexes: new Map([[1, 'A contact with this email or phone number already exists']]),
    });

    const session = seedSession(validRows);
    const result = await service.commit(scope, ownerId, {
      sessionId: session.id,
      mapping: mappingFor(['name', 'phone', 'email']),
      duplicateStrategy: 'skip',
      tags: [],
    });

    expect(result.successfulRows).toBe(1);
    expect(result.failedRows).toBe(1);
  });
});
