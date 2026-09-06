import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { RetryableJobError, type JobContext } from '../../infrastructure/queue/job-queue';
import { EmailWorker } from './email.worker';

const workspaceId = new Types.ObjectId();
const accountId = new Types.ObjectId();
const emailId = new Types.ObjectId().toString();

function buildEmail(overrides: Record<string, unknown> = {}) {
  return {
    _id: emailId,
    status: 'queued',
    emailAccountId: accountId,
    recipientEmail: 'lead@example.com',
    recipientName: 'Lead',
    subject: 'Hello Lead',
    bodyHtml: '<p>Hi</p>',
    bodyText: 'Hi',
    attachmentIds: [],
    ...overrides,
  };
}

function context(attempt = 1, maxAttempts = 3): JobContext {
  return { jobId: 'job-1', attempt, maxAttempts };
}

describe('EmailWorker', () => {
  let repository: {
    findById: Mock;
    markSending: Mock;
    markSent: Mock;
    markFailed: Mock;
    findAttachmentsByIds: Mock;
  };
  let accountService: { getSendingCredential: Mock; recordSendFailure: Mock };
  let smtp: { sendMessage: Mock };
  let storage: { get: Mock };
  let worker: EmailWorker;

  beforeEach(() => {
    repository = {
      findById: vi.fn().mockResolvedValue(buildEmail()),
      markSending: vi.fn().mockResolvedValue(null),
      markSent: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      findAttachmentsByIds: vi.fn().mockResolvedValue([]),
    };
    accountService = {
      getSendingCredential: vi.fn().mockResolvedValue({
        email: 'sender@gmail.com',
        appPassword: 'abcdefghijklmnop',
        displayName: 'Sender',
      }),
      recordSendFailure: vi.fn().mockResolvedValue(undefined),
    };
    smtp = {
      sendMessage: vi.fn().mockResolvedValue({ success: true, providerMessageId: '<id@gmail>' }),
    };
    storage = { get: vi.fn().mockResolvedValue(Buffer.from('file')) };

    worker = new EmailWorker(
      repository as never,
      accountService as never,
      smtp as never,
      storage as never,
    );
  });

  const payload = { emailId, workspaceId: workspaceId.toString() };

  it('sends the frozen body and marks the email sent', async () => {
    await worker.handle(payload, context());

    expect(smtp.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'lead@example.com',
        subject: 'Hello Lead',
        html: '<p>Hi</p>',
        text: 'Hi',
      }),
    );
    expect(repository.markSent).toHaveBeenCalledWith(emailId, '<id@gmail>');
  });

  it('sends one message per job, never a batch', async () => {
    await worker.handle(payload, context());

    const sent = smtp.sendMessage.mock.calls[0]?.[0] as { to: string };
    expect(typeof sent.to).toBe('string');
    expect(sent).not.toHaveProperty('bcc');
    expect(sent).not.toHaveProperty('cc');
  });

  it('never re-sends an email that is already sent', async () => {
    repository.findById.mockResolvedValue(buildEmail({ status: 'sent' }));

    await worker.handle(payload, context());

    expect(smtp.sendMessage).not.toHaveBeenCalled();
    expect(repository.markSent).not.toHaveBeenCalled();
  });

  it('ignores a job whose email record no longer exists', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(worker.handle(payload, context())).resolves.toBeUndefined();
    expect(smtp.sendMessage).not.toHaveBeenCalled();
  });

  it('retries a timeout', async () => {
    smtp.sendMessage.mockResolvedValue({
      success: false,
      failure: { code: 'SMTP_TIMEOUT', message: 'Timed out', retryable: true },
    });

    await expect(worker.handle(payload, context(1))).rejects.toBeInstanceOf(RetryableJobError);
    // Still queued: the queue owns the retry, so it is not marked failed yet.
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('asks for a longer pause when Gmail rate limits us', async () => {
    smtp.sendMessage.mockResolvedValue({
      success: false,
      failure: { code: 'SMTP_RATE_LIMITED', message: 'Slow down', retryable: true },
    });

    await expect(worker.handle(payload, context(1))).rejects.toMatchObject({
      retryAfterMs: 60_000,
    });
  });

  it('does not retry an authentication failure', async () => {
    smtp.sendMessage.mockResolvedValue({
      success: false,
      failure: { code: 'SMTP_AUTH_FAILED', message: 'Bad credential', retryable: false },
    });

    await worker.handle(payload, context(1));

    expect(repository.markFailed).toHaveBeenCalledWith(
      emailId,
      'SMTP_AUTH_FAILED',
      'Bad credential',
    );
  });

  it('flags the account when its credential is rejected', async () => {
    smtp.sendMessage.mockResolvedValue({
      success: false,
      failure: { code: 'SMTP_AUTH_FAILED', message: 'Bad credential', retryable: false },
    });

    await worker.handle(payload, context(1));

    expect(accountService.recordSendFailure).toHaveBeenCalledWith(
      { workspaceId },
      accountId.toString(),
      'SMTP_AUTH_FAILED',
    );
  });

  it('marks the email failed once the last attempt is exhausted', async () => {
    smtp.sendMessage.mockResolvedValue({
      success: false,
      failure: { code: 'SMTP_TIMEOUT', message: 'Timed out', retryable: true },
    });

    await worker.handle(payload, context(3, 3));

    expect(repository.markFailed).toHaveBeenCalledWith(emailId, 'SMTP_TIMEOUT', 'Timed out');
  });

  it('fails the send when an unusable credential is stored', async () => {
    accountService.getSendingCredential.mockRejectedValue(new Error('This account is disabled'));

    await worker.handle(payload, context());

    expect(smtp.sendMessage).not.toHaveBeenCalled();
    expect(repository.markFailed).toHaveBeenCalledWith(
      emailId,
      'EMAIL_ACCOUNT_UNAVAILABLE',
      'This account is disabled',
    );
  });

  it('attaches files fetched from object storage', async () => {
    const attachmentId = new Types.ObjectId();
    repository.findById.mockResolvedValue(buildEmail({ attachmentIds: [attachmentId] }));
    repository.findAttachmentsByIds.mockResolvedValue([
      {
        _id: attachmentId,
        fileName: 'deck.pdf',
        mimeType: 'application/pdf',
        storageKey: 'ws/deck.pdf',
      },
    ]);

    await worker.handle(payload, context());

    expect(smtp.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          { filename: 'deck.pdf', content: Buffer.from('file'), contentType: 'application/pdf' },
        ],
      }),
    );
  });

  it('marks the attempt count before sending, so retries are visible', async () => {
    await worker.handle(payload, context());

    expect(repository.markSending).toHaveBeenCalledWith(emailId);
    expect(repository.markSending.mock.invocationCallOrder[0]).toBeLessThan(
      smtp.sendMessage.mock.invocationCallOrder[0]!,
    );
  });
});
