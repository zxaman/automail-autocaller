import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { TimelineService } from './timeline.service';

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
const ownerId = new Types.ObjectId();
const contactId = new Types.ObjectId();
const scope = { workspaceId };

const contactDoc = (overrides: Record<string, unknown> = {}) => ({
  id: contactId.toString(),
  name: 'Rahul Sharma',
  email: 'rahul@example.com',
  importBatchId: null,
  ...overrides,
});

const callDoc = (overrides: Record<string, unknown> = {}) => ({
  id: new Types.ObjectId().toString(),
  direction: 'outbound',
  status: 'completed',
  durationSeconds: 125,
  failureReason: null,
  startedAt: new Date('2026-03-02T10:00:00.000Z'),
  createdAt: new Date('2026-03-02T10:00:00.000Z'),
  contactId,
  ...overrides,
});

const emailDoc = (overrides: Record<string, unknown> = {}) => ({
  id: new Types.ObjectId().toString(),
  subject: 'Proposal attached',
  recipientEmail: 'rahul@example.com',
  status: 'sent',
  attachmentIds: [],
  sentAt: new Date('2026-03-03T09:00:00.000Z'),
  createdAt: new Date('2026-03-01T09:00:00.000Z'),
  ...overrides,
});

const noteDoc = (overrides: Record<string, unknown> = {}) => ({
  id: new Types.ObjectId().toString(),
  body: 'Asked for a callback next week.',
  createdAt: new Date('2026-03-04T08:00:00.000Z'),
  ...overrides,
});

describe('TimelineService', () => {
  let repository: {
    findContact: Mock;
    findCalls: Mock;
    findEmails: Mock;
    findNotes: Mock;
    findImportBatch: Mock;
    findAttachments: Mock;
    createNote: Mock;
    deleteNote: Mock;
    findCallById: Mock;
  };
  let service: TimelineService;

  beforeEach(() => {
    repository = {
      findContact: vi.fn().mockResolvedValue(contactDoc()),
      findCalls: vi.fn().mockResolvedValue([]),
      findEmails: vi.fn().mockResolvedValue([]),
      findNotes: vi.fn().mockResolvedValue([]),
      findImportBatch: vi.fn().mockResolvedValue(null),
      findAttachments: vi.fn().mockResolvedValue([]),
      createNote: vi.fn(),
      deleteNote: vi.fn().mockResolvedValue(true),
      findCallById: vi.fn().mockResolvedValue(null),
    };
    service = new TimelineService(repository as never);
  });

  describe('getContactTimeline', () => {
    it('merges every source into one chronological list, newest first', async () => {
      repository.findCalls.mockResolvedValue([callDoc()]);
      repository.findEmails.mockResolvedValue([emailDoc()]);
      repository.findNotes.mockResolvedValue([noteDoc()]);

      const result = await service.getContactTimeline(scope, contactId.toString());

      expect(result.entries.map((entry) => entry.kind)).toEqual(['note', 'email', 'call']);
    });

    it('orders an email by when it was sent, not when it was drafted', async () => {
      // Drafted Mar 1, sent Mar 3: it belongs after a Mar 2 call.
      repository.findCalls.mockResolvedValue([callDoc()]);
      repository.findEmails.mockResolvedValue([emailDoc()]);

      const result = await service.getContactTimeline(scope, contactId.toString());

      expect(result.entries[0]?.kind).toBe('email');
      expect(result.entries[0]?.occurredAt).toBe('2026-03-03T09:00:00.000Z');
    });

    it('refuses a contact from another workspace as not found', async () => {
      repository.findContact.mockResolvedValue(null);

      await expect(
        service.getContactTimeline({ workspaceId: otherWorkspaceId }, contactId.toString()),
      ).rejects.toMatchObject({ statusCode: 404, code: 'CONTACT_NOT_FOUND' });
    });

    it('reads nothing else when the contact is not accessible', async () => {
      repository.findContact.mockResolvedValue(null);

      await expect(
        service.getContactTimeline(scope, contactId.toString()),
      ).rejects.toThrow();

      expect(repository.findCalls).not.toHaveBeenCalled();
      expect(repository.findEmails).not.toHaveBeenCalled();
      expect(repository.findNotes).not.toHaveBeenCalled();
    });

    it('scopes every read to the workspace', async () => {
      await service.getContactTimeline(scope, contactId.toString());

      expect(repository.findCalls).toHaveBeenCalledWith(scope, contactId.toString(), 50);
      expect(repository.findEmails).toHaveBeenCalledWith(scope, contactId.toString(), 50);
    });

    it('includes the import that created the contact', async () => {
      const batchId = new Types.ObjectId();
      repository.findContact.mockResolvedValue(contactDoc({ importBatchId: batchId }));
      repository.findImportBatch.mockResolvedValue({
        id: batchId.toString(),
        fileName: 'leads-march.xlsx',
        importedAt: new Date('2026-02-01T00:00:00.000Z'),
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      });

      const result = await service.getContactTimeline(scope, contactId.toString());

      const entry = result.entries.find((item) => item.kind === 'import');
      expect(entry?.description).toBe('leads-march.xlsx');
    });

    it('attaches email attachment metadata without exposing storage keys', async () => {
      const attachmentId = new Types.ObjectId();
      repository.findEmails.mockResolvedValue([emailDoc({ attachmentIds: [attachmentId] })]);
      repository.findAttachments.mockResolvedValue([
        { _id: attachmentId, fileName: 'proposal.pdf', sizeBytes: 2048 },
      ]);

      const result = await service.getContactTimeline(scope, contactId.toString());
      const attachment = result.entries[0]?.attachments[0];

      expect(attachment).toEqual({
        id: attachmentId.toString(),
        fileName: 'proposal.pdf',
        sizeBytes: 2048,
      });
      expect(JSON.stringify(result)).not.toContain('storageKey');
    });

    it('applies a kinds filter without querying the excluded sources', async () => {
      await service.getContactTimeline(scope, contactId.toString(), { kinds: ['note'] });

      expect(repository.findNotes).toHaveBeenCalled();
      expect(repository.findCalls).not.toHaveBeenCalled();
      expect(repository.findEmails).not.toHaveBeenCalled();
    });

    it('caps an oversized limit', async () => {
      await service.getContactTimeline(scope, contactId.toString(), { limit: 5000 });

      expect(repository.findCalls).toHaveBeenCalledWith(scope, contactId.toString(), 200);
    });

    it('marks a completed call as followable but a ringing one as not', async () => {
      repository.findCalls.mockResolvedValue([
        callDoc({ status: 'completed' }),
        callDoc({ status: 'ringing', startedAt: new Date('2026-03-05T10:00:00.000Z') }),
      ]);

      const result = await service.getContactTimeline(scope, contactId.toString());
      const ringing = result.entries.find((entry) => entry.status === 'Ringing');
      const completed = result.entries.find((entry) => entry.status === 'Completed');

      expect(completed?.canFollowUp).toBe(true);
      expect(ringing?.canFollowUp).toBe(false);
    });

    it('returns an empty timeline rather than failing for a contact with no history', async () => {
      const result = await service.getContactTimeline(scope, contactId.toString());

      expect(result.entries).toEqual([]);
      expect(result.contactName).toBe('Rahul Sharma');
    });
  });

  describe('addNote', () => {
    it('saves a trimmed note', async () => {
      repository.createNote.mockResolvedValue(noteDoc({ body: 'Call back Monday' }));

      const entry = await service.addNote(scope, ownerId, contactId.toString(), {
        body: '  Call back Monday  ',
      });

      expect(repository.createNote).toHaveBeenCalledWith(scope, ownerId, {
        contactId: contactId.toString(),
        body: 'Call back Monday',
        callId: null,
      });
      expect(entry.kind).toBe('note');
    });

    it('rejects a whitespace-only note', async () => {
      await expect(
        service.addNote(scope, ownerId, contactId.toString(), { body: '   ' }),
      ).rejects.toMatchObject({ code: 'NOTE_BODY_REQUIRED' });

      expect(repository.createNote).not.toHaveBeenCalled();
    });

    it('rejects a note linked to a call outside the workspace', async () => {
      repository.findCallById.mockResolvedValue(null);

      await expect(
        service.addNote(scope, ownerId, contactId.toString(), {
          body: 'Outcome',
          callId: new Types.ObjectId().toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'CALL_NOT_FOUND' });

      expect(repository.createNote).not.toHaveBeenCalled();
    });

    it('refuses to attach a note to a contact in another workspace', async () => {
      repository.findContact.mockResolvedValue(null);

      await expect(
        service.addNote(scope, ownerId, contactId.toString(), { body: 'Hello' }),
      ).rejects.toMatchObject({ code: 'CONTACT_NOT_FOUND' });
    });
  });

  describe('deleteNote', () => {
    it('reports a note that does not exist in this workspace', async () => {
      repository.deleteNote.mockResolvedValue(false);

      await expect(
        service.deleteNote(scope, new Types.ObjectId().toString()),
      ).rejects.toMatchObject({ statusCode: 404, code: 'NOTE_NOT_FOUND' });
    });
  });

  describe('buildFollowUpDraft', () => {
    it('prefills the draft with the contact first name', async () => {
      const draft = await service.buildFollowUpDraft(scope, contactId.toString());

      expect(draft.body).toContain('Hi Rahul,');
      expect(draft.email).toBe('rahul@example.com');
      expect(draft.canSend).toBe(true);
    });

    it('explains why a contact without an email cannot be mailed', async () => {
      repository.findContact.mockResolvedValue(contactDoc({ email: null }));

      const draft = await service.buildFollowUpDraft(scope, contactId.toString());

      expect(draft.canSend).toBe(false);
      expect(draft.reason).toMatch(/no email address/i);
    });

    it('rejects a call that belongs to a different contact', async () => {
      repository.findCallById.mockResolvedValue(
        callDoc({ contactId: new Types.ObjectId() }),
      );

      await expect(
        service.buildFollowUpDraft(scope, contactId.toString(), new Types.ObjectId().toString()),
      ).rejects.toMatchObject({ code: 'CALL_CONTACT_MISMATCH' });
    });

    it('does not send anything itself', async () => {
      const draft = await service.buildFollowUpDraft(scope, contactId.toString());

      // The draft is only a starting point handed to the composer.
      expect(draft).not.toHaveProperty('sentAt');
      expect(draft.subject.length).toBeGreaterThan(0);
    });
  });
});
