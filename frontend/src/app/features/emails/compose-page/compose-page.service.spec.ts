import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../core/models/api-error.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ContactService } from '../../contacts/services/contact.service';
import { EmailService } from '../services/email.service';
import { ComposePageService } from './compose-page.service';

function contact(id: string, name: string, email: string | null) {
  return {
    id,
    name,
    email,
    phone: null,
    company: 'Acme',
    designation: null,
    location: null,
    tags: [],
    notes: null,
    source: 'manual',
    importBatchId: null,
    lastContactedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('ComposePageService', () => {
  let emailService: {
    listTemplates: ReturnType<typeof vi.fn>;
    listSignatures: ReturnType<typeof vi.fn>;
    listAttachments: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    preview: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    retry: ReturnType<typeof vi.fn>;
    uploadAttachment: ReturnType<typeof vi.fn>;
  };
  let contactService: { list: ReturnType<typeof vi.fn> };
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let service: ComposePageService;

  beforeEach(async () => {
    emailService = {
      listTemplates: vi.fn().mockReturnValue(of({ items: [] })),
      listSignatures: vi.fn().mockReturnValue(of({ items: [] })),
      listAttachments: vi.fn().mockReturnValue(of({ items: [] })),
      list: vi.fn().mockReturnValue(
        of({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } }),
      ),
      preview: vi.fn(),
      send: vi.fn(),
      retry: vi.fn().mockReturnValue(of({})),
      uploadAttachment: vi.fn(),
    };
    contactService = {
      list: vi.fn().mockReturnValue(
        of({
          items: [
            contact('c1', 'Asha Patel', 'asha@example.com'),
            contact('c2', 'Ravi Kumar', 'ravi@example.com'),
            contact('c3', 'No Email', null),
          ],
          pagination: { page: 1, pageSize: 100, totalItems: 3, totalPages: 1 },
        }),
      ),
    };
    notifications = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ComposePageService,
        { provide: EmailService, useValue: emailService },
        { provide: ContactService, useValue: contactService },
        { provide: NotificationService, useValue: notifications },
      ],
    });

    service = TestBed.inject(ComposePageService);
    await service.load();
  });

  it('loads contacts, templates, signatures, and history', () => {
    expect(service.contacts()).toHaveLength(3);
    expect(service.isLoading()).toBe(false);
    expect(service.errorMessage()).toBeNull();
  });

  it('selects only contacts that have an email address', () => {
    service.selectAllReachable();

    expect(service.recipientCount()).toBe(2);
    expect(service.selectedIds().has('c3')).toBe(false);
  });

  it('reports selected contacts that cannot be reached', () => {
    service.toggleRecipient('c1');
    service.toggleRecipient('c3');

    expect(service.unreachableCount()).toBe(1);
  });

  it('does not allow sending without a subject and body', () => {
    service.selectAllReachable();

    expect(service.canSend()).toBe(false);

    service.setSubject('Hello');
    service.setBodyHtml('<p>Hi</p>');

    expect(service.canSend()).toBe(true);
  });

  it('does not allow sending with no recipients', () => {
    service.setSubject('Hello');
    service.setBodyHtml('<p>Hi</p>');

    expect(service.canSend()).toBe(false);
  });

  it('sends every selected recipient in one request', async () => {
    emailService.send.mockReturnValue(of({ queued: 2, skipped: [], emailIds: ['e1', 'e2'] }));
    service.selectAllReachable();
    service.setSubject('Hello {{ contact.firstName }}');
    service.setBodyHtml('<p>Hi</p>');

    await service.send();

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ contactIds: ['c1', 'c2'] }),
    );
  });

  it('clears the selection after a successful send', async () => {
    emailService.send.mockReturnValue(of({ queued: 2, skipped: [], emailIds: [] }));
    service.selectAllReachable();
    service.setSubject('Hello');
    service.setBodyHtml('<p>Hi</p>');

    await service.send();

    expect(service.recipientCount()).toBe(0);
    expect(notifications.success).toHaveBeenCalled();
  });

  it('reports skipped recipients to the user', async () => {
    emailService.send.mockReturnValue(
      of({ queued: 1, skipped: [{ contactId: 'c3', reason: 'no email' }], emailIds: ['e1'] }),
    );
    service.selectAllReachable();
    service.setSubject('Hello');
    service.setBodyHtml('<p>Hi</p>');

    await service.send();

    expect(notifications.success).toHaveBeenCalledWith(
      expect.stringContaining('1 contact(s) were skipped'),
    );
  });

  it('keeps the draft when sending fails', async () => {
    emailService.send.mockReturnValue(
      throwError(() => new AppError({
        message: 'Connect a Gmail account',
        status: 409,
        code: 'EMAIL_ACCOUNT_NOT_CONNECTED',
      })),
    );
    service.selectAllReachable();
    service.setSubject('Hello');
    service.setBodyHtml('<p>Hi</p>');

    await service.send();

    expect(notifications.error).toHaveBeenCalledWith('Connect a Gmail account');
    // The work is not lost: the user can fix the problem and resend.
    expect(service.recipientCount()).toBe(2);
    expect(service.subject()).toBe('Hello');
  });

  it('applying a template replaces the draft', () => {
    const template = {
      id: 't1',
      name: 'Intro',
      subject: 'Hi {{ contact.firstName }}',
      bodyHtml: '<p>Intro</p>',
      variables: [],
      createdAt: '',
      updatedAt: '',
    };
    emailService.listTemplates.mockReturnValue(of({ items: [template] }));

    return service.load().then(() => {
      service.applyTemplate('t1');

      expect(service.subject()).toBe('Hi {{ contact.firstName }}');
      expect(service.bodyHtml()).toBe('<p>Intro</p>');
    });
  });

  it('previews against the first selected recipient', async () => {
    emailService.preview.mockReturnValue(
      of({
        recipientEmail: 'asha@example.com',
        recipientName: 'Asha Patel',
        subject: 'Hi Asha',
        bodyHtml: '<p>Hi</p>',
        bodyText: 'Hi',
        unresolvedVariables: [],
      }),
    );
    service.toggleRecipient('c1');
    service.setSubject('Hi {{ contact.firstName }}');
    service.setBodyHtml('<p>Hi</p>');

    await service.refreshPreview();

    expect(emailService.preview).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 'c1' }),
    );
    expect(service.preview()?.subject).toBe('Hi Asha');
  });

  it('refuses more attachments than an email may carry', () => {
    for (const id of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']) {
      service.toggleAttachment(id);
    }

    expect(service.selectedAttachmentIds().size).toBe(5);
    expect(notifications.error).toHaveBeenCalledWith(
      expect.stringContaining('at most 5 attachments'),
    );
  });

  it('surfaces a load failure with a retry path', async () => {
    contactService.list.mockReturnValue(
      throwError(() => new AppError({
        message: 'Server unavailable',
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
      })),
    );

    await service.load();

    expect(service.errorMessage()).toBe('Server unavailable');
    expect(service.isLoading()).toBe(false);
  });
});
