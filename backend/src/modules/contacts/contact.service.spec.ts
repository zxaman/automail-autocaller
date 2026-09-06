import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../shared/errors/app-error';
import type { ContactDocument } from './contact.model';
import type { ContactRepository } from './contact.repository';
import { ContactService } from './contact.service';

const WORKSPACE_ID = new Types.ObjectId();
const OWNER_ID = new Types.ObjectId();
const scope = { workspaceId: WORKSPACE_ID };

function makeContact(overrides: Partial<ContactDocument> = {}): ContactDocument {
  return {
    _id: new Types.ObjectId(),
    workspaceId: WORKSPACE_ID,
    ownerId: OWNER_ID,
    name: 'Rahul Sharma',
    phone: '+91 98765 43210',
    phoneNormalized: '+919876543210',
    email: 'rahul@example.com',
    company: 'ABC Pvt Ltd',
    designation: 'Backend Engineer',
    location: null,
    tags: ['candidate'],
    notes: null,
    source: 'manual',
    importBatchId: null,
    lastContactedAt: null,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: new Date('2026-09-01T10:00:00Z'),
    ...overrides,
  } as unknown as ContactDocument;
}

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Rahul Sharma',
    phone: '9876543210',
    email: 'rahul@example.com',
    company: null,
    designation: null,
    location: null,
    tags: [],
    notes: null,
    ...overrides,
  } as never;
}

describe('ContactService', () => {
  let repository: ContactRepository;
  let service: ContactService;

  beforeEach(() => {
    repository = {
      findPaged: vi.fn(async () => ({
        items: [makeContact()],
        pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      })),
      findById: vi.fn(async () => makeContact()),
      create: vi.fn(async () => makeContact()),
      update: vi.fn(async () => makeContact()),
      delete: vi.fn(async () => true),
      findDuplicate: vi.fn(async () => null),
      listTags: vi.fn(async () => ['candidate']),
      countForWorkspace: vi.fn(async () => 1),
    } as unknown as ContactRepository;

    service = new ContactService(repository);
  });

  it('normalizes the phone number before persisting', async () => {
    await service.create(scope, OWNER_ID, makeInput({ phone: '09876543210' }));

    expect(repository.create).toHaveBeenCalledWith(
      scope,
      OWNER_ID,
      expect.objectContaining({ phoneNormalized: '+919876543210', phone: '09876543210' }),
    );
  });

  it('rejects a phone number that cannot be normalized', async () => {
    await expect(service.create(scope, OWNER_ID, makeInput({ phone: '12345' }))).rejects.toMatchObject(
      { code: 'CONTACT_PHONE_INVALID', statusCode: 400 },
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('blocks a duplicate email in the same workspace', async () => {
    repository.findDuplicate = vi.fn(async () => makeContact());

    await expect(service.create(scope, OWNER_ID, makeInput())).rejects.toMatchObject({
      code: 'CONTACT_DUPLICATE',
      statusCode: 409,
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('excludes the contact being edited from its own duplicate check', async () => {
    const id = new Types.ObjectId().toString();
    await service.update(scope, id, makeInput());

    expect(repository.findDuplicate).toHaveBeenCalledWith(scope, expect.anything(), id);
  });

  it('translates a unique-index race into a duplicate error', async () => {
    repository.create = vi.fn(async () => {
      throw Object.assign(new Error('E11000'), { code: 11000, keyPattern: { email: 1 } });
    });

    await expect(service.create(scope, OWNER_ID, makeInput())).rejects.toMatchObject({
      code: 'CONTACT_DUPLICATE',
      statusCode: 409,
    });
  });

  it('reports a contact outside the workspace as not found', async () => {
    repository.findById = vi.fn(async () => null);

    const error = await service
      .getById(scope, new Types.ObjectId().toString())
      .catch((value: unknown) => value);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(404);
    // Must not be 403: that would confirm the record exists elsewhere.
    expect((error as AppError).code).toBe('CONTACT_NOT_FOUND');
  });

  it('reports a missing contact on update and delete', async () => {
    repository.update = vi.fn(async () => null);
    repository.delete = vi.fn(async () => false);
    const id = new Types.ObjectId().toString();

    await expect(service.update(scope, id, makeInput())).rejects.toMatchObject({
      code: 'CONTACT_NOT_FOUND',
    });
    await expect(service.delete(scope, id)).rejects.toMatchObject({ code: 'CONTACT_NOT_FOUND' });
  });

  it('returns a projection without workspace or owner identifiers', async () => {
    const result = await service.list(scope, {
      page: 1,
      pageSize: 25,
      sortBy: 'createdAt',
      sortDir: 'desc',
    });

    expect(result.items[0]).not.toHaveProperty('workspaceId');
    expect(result.items[0]).not.toHaveProperty('ownerId');
    expect(result.pagination.totalItems).toBe(1);
  });

  it('always forwards the caller scope to the repository', async () => {
    const query = { page: 2, pageSize: 10, sortBy: 'name', sortDir: 'asc' } as never;
    await service.list(scope, query);

    expect(repository.findPaged).toHaveBeenCalledWith(scope, query);
  });
});
