import { Types } from 'mongoose';

import { RetryableJobError, type JobContext } from '../../infrastructure/queue/job-queue';
import type { ObjectStorage } from '../../infrastructure/storage/object-storage';
import type { OutboundAttachment, SmtpVerifier } from '../../infrastructure/smtp/smtp-verifier';
import { logger } from '../../infrastructure/logger/logger';
import type { EmailAccountService } from '../email-accounts/email-account.service';
import type { EmailRepository } from './email.repository';
import type { EmailJobPayload } from './email.types';

/**
 * Failures worth another attempt: the message itself is fine, the transport
 * was momentarily not. Everything else (bad credential, rejected recipient) is
 * permanent, and retrying it only burns quota against Gmail's limits.
 */
const RETRYABLE_FAILURE_CODES = new Set(['SMTP_TIMEOUT', 'SMTP_RATE_LIMITED', 'SMTP_UNAVAILABLE', 'SMTP_CONNECTION_FAILED']);

/** Extra pause once Gmail has told us to slow down. */
const RATE_LIMIT_BACKOFF_MS = 60_000;

/**
 * Sends one queued email.
 *
 * The body was rendered and frozen at compose time, so this only resolves the
 * credential and attachments and hands the message to SMTP. That keeps the
 * decrypted App Password inside a single short-lived call.
 */
export class EmailWorker {
  constructor(
    private readonly repository: EmailRepository,
    private readonly emailAccountService: EmailAccountService,
    private readonly smtpVerifier: SmtpVerifier,
    private readonly storage: ObjectStorage,
  ) {}

  public handle = async (payload: EmailJobPayload, context: JobContext): Promise<void> => {
    const scope = { workspaceId: new Types.ObjectId(payload.workspaceId) };
    const email = await this.repository.findById(scope, payload.emailId);

    if (!email) {
      // The record was deleted after the job was queued. Nothing to do, and
      // retrying would never succeed.
      logger.warn({ emailId: payload.emailId }, 'Skipping email job: record no longer exists');
      return;
    }

    if (email.status === 'sent') {
      // A duplicate job must never send the same message twice.
      logger.info({ emailId: payload.emailId }, 'Skipping email job: already sent');
      return;
    }

    const accountId = email.emailAccountId?.toString();

    if (!accountId) {
      await this.repository.markFailed(
        scope,
        payload.emailId,
        'EMAIL_ACCOUNT_MISSING',
        'No sending account is associated with this email',
      );
      return;
    }

    await this.repository.markSending(scope, payload.emailId);

    let credential;
    try {
      credential = await this.emailAccountService.getSendingCredential(scope, accountId);
    } catch (error) {
      // No usable credential is a permanent condition until the user acts.
      await this.repository.markFailed(
        scope,
        payload.emailId,
        'EMAIL_ACCOUNT_UNAVAILABLE',
        error instanceof Error ? error.message : 'The sending account is unavailable',
      );
      return;
    }

    const attachments = await this.loadAttachments(scope, email.attachmentIds);

    const result = await this.smtpVerifier.sendMessage({
      email: credential.email,
      appPassword: credential.appPassword,
      fromName: credential.displayName,
      to: email.recipientEmail,
      toName: email.recipientName,
      subject: email.subject,
      html: email.bodyHtml,
      text: email.bodyText,
      attachments,
    });

    if (result.success) {
      await this.repository.markSent(scope, payload.emailId, result.providerMessageId ?? '');
      logger.info(
        { emailId: payload.emailId, attempt: context.attempt },
        'Email accepted by the provider',
      );
      return;
    }

    const failure = result.failure!;
    const isLastAttempt = context.attempt >= context.maxAttempts;
    const isRetryable = RETRYABLE_FAILURE_CODES.has(failure.code);

    if (failure.code === 'SMTP_AUTH_FAILED') {
      // The App Password was revoked or changed: flag the account so the user
      // sees why, instead of every subsequent message failing silently.
      await this.emailAccountService.recordSendFailure(scope, accountId, failure.code);
    }

    if (!isRetryable || isLastAttempt) {
      await this.repository.markFailed(scope, payload.emailId, failure.code, failure.message);
      logger.warn(
        { emailId: payload.emailId, code: failure.code, attempt: context.attempt, isRetryable },
        'Email delivery failed permanently',
      );
      return;
    }

    // Leave the record queued: the queue owns the retry, and the UI keeps
    // showing the message as in flight rather than as a failure.
    logger.warn(
      { emailId: payload.emailId, code: failure.code, attempt: context.attempt },
      'Email delivery failed, will retry',
    );

    throw new RetryableJobError(
      failure.message,
      failure.code === 'SMTP_RATE_LIMITED' ? RATE_LIMIT_BACKOFF_MS : undefined,
    );
  };

  private async loadAttachments(
    scope: { workspaceId: Types.ObjectId },
    attachmentIds: readonly Types.ObjectId[],
  ): Promise<OutboundAttachment[]> {
    if (attachmentIds.length === 0) {
      return [];
    }

    const records = await this.repository.findAttachmentsByIds(scope, attachmentIds);
    const attachments: OutboundAttachment[] = [];

    for (const record of records) {
      try {
        attachments.push({
          filename: record.fileName,
          content: await this.storage.get(record.storageKey),
          contentType: record.mimeType,
        });
      } catch {
        // A missing object must not silently drop the attachment: fail the
        // send so the user knows the message went out incomplete — it did not.
        throw new Error(`Attachment "${record.fileName}" could not be read from storage`);
      }
    }

    return attachments;
  }
}
