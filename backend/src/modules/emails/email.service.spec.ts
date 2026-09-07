import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { EmailService } from './email.service';

const workspaceId = new Types.ObjectId();
const ownerId = new Types.ObjectId();
const scope = { workspaceId };
const accountId = new Types.ObjectId();

function buildContact(overrides: Record<string, unknown> = {}) {
  const id = new Types.ObjectId();

  return {
    _id: id,
    id: id.toString(),
    name: 'Asha Patel',
    email: 'asha@example.com',
    phone: '+919812345678',
    company: 'Acme',
    designation: 'CTO',
    location: 'Pune',
    ...overrides,
  };
}

describe('EmailService', () => {
  let repository: Record<string, Mock>;
  let accountService: Record<string, Mock>;
  let storage: Record<string, Mock>;
  let enqueuer: { enqueue: Mock };
  let service: EmailService;

  beforeEach(() => {
    repository = {
      findContactsByIds: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue([]),
      incrementAttachmentUsage: vi.fn().mockResolvedValue(undefined),
      findDefaultSignature: vi.fn().mockResolvedValue(null),
      findSignatureById: vi.fn().mockResolvedValue(null),
      findAttachmentsByIds: vi.fn().mockResolvedValue([]),
      listAttachments: vi.fn().mockResolvedValue([]),
      findAttachmentByChecksum: vi.fn().mockResolvedValue(null),
      createAttachment: vi.fn(),
      listSignatures: vi.fn().mockResolvedValue([]),
      clearDefaultSignatureExcept: vi.fn().mockResolvedValue(undefined),
      createSignature: vi.fn(),
    };
    accountService = {
      getDefaultAccountOrThrow: vi.fn().mockResolvedValue({
        id: accountId.toString(),
        email: 'sender@gmail.com',
        displayName: 'Sender',
      }),
      getActiveAccountOrThrow: vi.fn(),
    };
    storage = { put: vi.fn(), get: vi.fn(), delete: vi.fn().mockResolvedValue(undefined) };
    enqueuer = { enqueue: vi.fn().mockResolvedValue(undefined) };

    service = new EmailService(
      repository as never,
      accountService as never,
      storage as never,
      enqueuer,
    );
  });

  const baseInput = {
    subject: 'Hello {{ contact.firstName }}',
    bodyHtml: '<p>Hi {{ contact.name }} at {{ contact.company }}</p>',
    attachmentIds: [],
  };

  function stubCreateMany() {
    repository['createMany']!.mockImplementation(
      (_scope: unknown, _owner: unknown, records: unknown[]) =>
        Promise.resolve(records.map(() => ({ _id: new Types.ObjectId() }))),
    );
  }

  describe('compose', () => {
    it('creates one email record per recipient', async () => {
      const contacts = [buildContact(), buildContact({ name: 'Ravi Kumar' })];
      repository['findContactsByIds']!.mockResolvedValue(contacts);
      stubCreateMany();

      const result = await service.compose(scope, ownerId, {
        ...baseInput,
        contactIds: contacts.map((contact) => contact.id),
      });

      expect(result.queued).toBe(2);
      const records = repository['createMany']!.mock.calls[0]?.[2] as { recipientEmail: string }[];
      expect(records).toHaveLength(2);
    });

    it('personalizes each recipient separately', async () => {
      const contacts = [
        buildContact({ name: 'Asha Patel', company: 'Acme' }),
        buildContact({ name: 'Ravi Kumar', company: 'Globex' }),
      ];
      repository['findContactsByIds']!.mockResolvedValue(contacts);
      stubCreateMany();

      await service.compose(scope, ownerId, {
        ...baseInput,
        contactIds: contacts.map((contact) => contact.id),
      });

      const records = repository['createMany']!.mock.calls[0]?.[2] as {
        subject: string;
        bodyHtml: string;
      }[];
      expect(records[0]?.subject).toBe('Hello Asha');
      expect(records[1]?.subject).toBe('Hello Ravi');
      expect(records[0]?.bodyHtml).toContain('Acme');
      expect(records[1]?.bodyHtml).toContain('Globex');
    });

    it('freezes a rendered body so a later template edit cannot change it', async () => {
      const contact = buildContact();
      repository['findContactsByIds']!.mockResolvedValue([contact]);
      stubCreateMany();

      await service.compose(scope, ownerId, { ...baseInput, contactIds: [contact.id] });

      const records = repository['createMany']!.mock.calls[0]?.[2] as {
        bodyHtml: string;
        bodyText: string;
      }[];
      expect(records[0]?.bodyHtml).not.toContain('{{');
      expect(records[0]?.bodyText).toContain('Asha Patel');
    });

    it('escapes contact data so it cannot inject markup', async () => {
      const contact = buildContact({ name: '<img src=x onerror=alert(1)>' });
      repository['findContactsByIds']!.mockResolvedValue([contact]);
      stubCreateMany();

      await service.compose(scope, ownerId, { ...baseInput, contactIds: [contact.id] });

      const records = repository['createMany']!.mock.calls[0]?.[2] as { bodyHtml: string }[];
      const bodyHtml = records[0]?.bodyHtml ?? '';

      // The payload survives as inert text, which is correct: what matters is
      // that no live <img> tag and no executable attribute reach the client.
      expect(bodyHtml).toContain('&lt;img');
      expect(bodyHtml).not.toMatch(/<img/i);

      // The only tags left are the author's own; the injected payload survives
      // purely as escaped text, so nothing of it is parsed as markup.
      const tags = bodyHtml.match(/<[^>]+>/g) ?? [];
      expect(tags).toEqual(['<p>', '</p>']);
    });

    it('skips contacts without an email instead of failing the whole send', async () => {
      const withEmail = buildContact();
      const withoutEmail = buildContact({ email: null });
      repository['findContactsByIds']!.mockResolvedValue([withEmail, withoutEmail]);
      stubCreateMany();

      const result = await service.compose(scope, ownerId, {
        ...baseInput,
        contactIds: [withEmail.id, withoutEmail.id],
      });

      expect(result.queued).toBe(1);
      expect(result.skipped).toEqual([
        { contactId: withoutEmail.id, reason: 'Contact has no email address' },
      ]);
    });

    it('treats a contact from another workspace as not found', async () => {
      // The repository is workspace-scoped, so a foreign id returns nothing.
      repository['findContactsByIds']!.mockResolvedValue([]);
      const foreignId = new Types.ObjectId().toString();

      await expect(
        service.compose(scope, ownerId, { ...baseInput, contactIds: [foreignId] }),
      ).rejects.toMatchObject({ code: 'EMAIL_NO_DELIVERABLE_RECIPIENTS' });
      expect(repository['createMany']).not.toHaveBeenCalled();
    });

    it('queues a job for every created record', async () => {
      const contacts = [buildContact(), buildContact()];
      repository['findContactsByIds']!.mockResolvedValue(contacts);
      stubCreateMany();

      await service.compose(scope, ownerId, {
        ...baseInput,
        contactIds: contacts.map((contact) => contact.id),
      });

      expect(enqueuer.enqueue).toHaveBeenCalledTimes(2);
    });

    it('enqueues only after the records exist', async () => {
      const contact = buildContact();
      repository['findContactsByIds']!.mockResolvedValue([contact]);
      stubCreateMany();

      await service.compose(scope, ownerId, { ...baseInput, contactIds: [contact.id] });

      expect(repository['createMany']!.mock.invocationCallOrder[0]).toBeLessThan(
        enqueuer.enqueue.mock.invocationCallOrder[0]!,
      );
    });

    it('rejects a send with no recipients', async () => {
      await expect(
        service.compose(scope, ownerId, { ...baseInput, contactIds: [] }),
      ).rejects.toMatchObject({ code: 'EMAIL_NO_RECIPIENTS' });
    });

    it('rejects a send above the recipient cap', async () => {
      const contactIds = Array.from({ length: 201 }, () => new Types.ObjectId().toString());

      await expect(
        service.compose(scope, ownerId, { ...baseInput, contactIds }),
      ).rejects.toMatchObject({ code: 'EMAIL_TOO_MANY_RECIPIENTS' });
    });

    it('refuses attachments the workspace does not own', async () => {
      const contact = buildContact();
      repository['findContactsByIds']!.mockResolvedValue([contact]);
      repository['findAttachmentsByIds']!.mockResolvedValue([]);

      await expect(
        service.compose(scope, ownerId, {
          ...baseInput,
          contactIds: [contact.id],
          attachmentIds: [new Types.ObjectId().toString()],
        }),
      ).rejects.toMatchObject({ code: 'ATTACHMENT_NOT_FOUND' });
    });

    it('rejects attachments beyond the total size limit', async () => {
      const contact = buildContact();
      repository['findContactsByIds']!.mockResolvedValue([contact]);
      const attachmentId = new Types.ObjectId();
      repository['findAttachmentsByIds']!.mockResolvedValue([
        { _id: attachmentId, sizeBytes: 21 * 1024 * 1024 },
      ]);

      await expect(
        service.compose(scope, ownerId, {
          ...baseInput,
          contactIds: [contact.id],
          attachmentIds: [attachmentId.toString()],
        }),
      ).rejects.toMatchObject({ code: 'EMAIL_ATTACHMENTS_TOO_LARGE' });
    });

    it('appends the default signature when none is chosen', async () => {
      const contact = buildContact();
      repository['findContactsByIds']!.mockResolvedValue([contact]);
      repository['findDefaultSignature']!.mockResolvedValue({
        bodyHtml: '<p>Regards, Sender</p>',
      });
      stubCreateMany();

      await service.compose(scope, ownerId, { ...baseInput, contactIds: [contact.id] });

      const records = repository['createMany']!.mock.calls[0]?.[2] as { bodyHtml: string }[];
      expect(records[0]?.bodyHtml).toContain('Regards, Sender');
    });
  });

  describe('preview', () => {
    it('renders against a real contact and reports unresolved variables', async () => {
      const contact = buildContact({ company: null });
      repository['findContactsByIds']!.mockResolvedValue([contact]);

      const preview = await service.preview(scope, {
        contactId: contact.id,
        subject: 'Hi {{ contact.firstName }}',
        bodyHtml: '<p>{{ contact.company }} team</p>',
      });

      expect(preview.subject).toBe('Hi Asha');
      expect(preview.unresolvedVariables).toContain('contact.company');
    });

    it('rejects a contact the workspace cannot see', async () => {
      repository['findContactsByIds']!.mockResolvedValue([]);

      await expect(
        service.preview(scope, {
          contactId: new Types.ObjectId().toString(),
          subject: 'Hi',
          bodyHtml: '<p>Hi</p>',
        }),
      ).rejects.toMatchObject({ code: 'CONTACT_NOT_FOUND' });
    });
  });

  describe('attachments', () => {
    it('reuses an existing record when identical bytes are re-uploaded', async () => {
      storage['put']!.mockResolvedValue({ key: 'ws/new.pdf', sizeBytes: 10, checksum: 'abc' });
      repository['findAttachmentByChecksum']!.mockResolvedValue({
        _id: new Types.ObjectId(),
        fileName: 'existing.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        usageCount: 2,
        createdAt: new Date(),
      });

      const result = await service.uploadAttachment(scope, ownerId, {
        originalname: 'copy.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('data'),
      });

      expect(result.fileName).toBe('existing.pdf');
      expect(repository['createAttachment']).not.toHaveBeenCalled();
      // The redundant copy is removed from storage.
      expect(storage['delete']).toHaveBeenCalledWith('ws/new.pdf');
    });
  });
});
