import path from 'node:path';

import { env } from '../../config/environment';
import { logger } from '../../infrastructure/logger/logger';
import { InProcessQueue } from '../../infrastructure/queue/in-process-queue';
import { RedisQueue } from '../../infrastructure/queue/redis-queue';
import type { JobContext, QueueDriver } from '../../infrastructure/queue/job-queue';
import { SmtpVerifier } from '../../infrastructure/smtp/smtp-verifier';
import { LocalObjectStorage } from '../../infrastructure/storage/local-object-storage';
import type { ObjectStorage } from '../../infrastructure/storage/object-storage';
import type { EmailAccountService } from '../email-accounts/email-account.service';
import { EmailController } from './email.controller';
import { EmailRepository } from './email.repository';
import { EmailService } from './email.service';
import { EmailWorker } from './email.worker';
import type { EmailJobPayload } from './email.types';

/**
 * Composition root for AutoMail.
 *
 * The queue and storage drivers are chosen here and nowhere else, so the rest
 * of the module is identical whether it runs against Redis and S3 or against
 * the in-process fallbacks used in development.
 */
const EMAIL_QUEUE_NAME = 'automail-send';

export function createEmailModule(emailAccountService: EmailAccountService) {
  const useRedis = env.EMAIL_QUEUE_DRIVER === 'redis';

  const queue: QueueDriver<EmailJobPayload> = useRedis
    ? new RedisQueue<EmailJobPayload>({
        queueName: EMAIL_QUEUE_NAME,
        connection: { url: env.REDIS_URL },
        intervalMs: env.EMAIL_SEND_INTERVAL_MS,
        defaultAttempts: env.EMAIL_MAX_ATTEMPTS,
      })
    : new InProcessQueue<EmailJobPayload>({
        intervalMs: env.EMAIL_SEND_INTERVAL_MS,
        defaultAttempts: env.EMAIL_MAX_ATTEMPTS,
      });

  if (!useRedis) {
    logger.warn(
      'EMAIL_QUEUE_DRIVER is "memory"; queued emails are lost if the process restarts. Set it to "redis" in production.',
    );
  }

  const storage: ObjectStorage = new LocalObjectStorage(
    path.resolve(process.cwd(), env.ATTACHMENT_STORAGE_DIR),
  );

  const repository = new EmailRepository();
  const smtpVerifier = new SmtpVerifier();

  const emailService = new EmailService(repository, emailAccountService, storage, {
    enqueue: async (payload) => {
      await queue.add(payload);
    },
  });

  const worker = new EmailWorker(repository, emailAccountService, smtpVerifier, storage);

  queue.process((payload: EmailJobPayload, context: JobContext) => worker.handle(payload, context));

  return {
    emailController: new EmailController(emailService),
    emailService,
    repository,
    queue,
    storage,
    worker,
  };
}

export type EmailModule = ReturnType<typeof createEmailModule>;
