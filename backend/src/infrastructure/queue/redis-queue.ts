import { Queue, Worker, type ConnectionOptions } from 'bullmq';

import { logger } from '../logger/logger';
import {
  RetryableJobError,
  type JobHandler,
  type JobOptions,
  type QueueDriver,
} from './job-queue';

export interface RedisQueueOptions {
  queueName: string;
  connection: ConnectionOptions;
  intervalMs?: number;
  defaultAttempts?: number;
  backoffBaseMs?: number;
}

/**
 * BullMQ-backed driver for production and any multi-instance deployment.
 *
 * Jobs survive restarts and the rate limiter is shared across workers, so
 * throttling holds even when several API instances are sending. The retry
 * contract matches the in-process driver: a permanent failure is discarded
 * immediately rather than consuming the attempt budget.
 */
export class RedisQueue<TPayload extends object> implements QueueDriver<TPayload> {
  public readonly name = 'redis';

  private readonly queue: Queue<TPayload>;
  private worker: Worker<TPayload> | null = null;
  private readonly options: Required<Omit<RedisQueueOptions, 'connection' | 'queueName'>>;

  constructor(private readonly config: RedisQueueOptions) {
    this.options = {
      intervalMs: config.intervalMs ?? 1200,
      defaultAttempts: config.defaultAttempts ?? 3,
      backoffBaseMs: config.backoffBaseMs ?? 5000,
    };

    this.queue = new Queue<TPayload>(config.queueName, {
      connection: config.connection,
      defaultJobOptions: {
        attempts: this.options.defaultAttempts,
        backoff: { type: 'exponential', delay: this.options.backoffBaseMs },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86_400 },
      },
    });
  }

  public async add(payload: TPayload, options: JobOptions = {}): Promise<string> {
    // BullMQ's generic name/data inference does not survive this wrapper's own
    // generic, so the call is asserted at this single boundary.
    const job = await (this.queue.add as unknown as (
      name: string,
      data: TPayload,
      options: Record<string, unknown>,
    ) => Promise<{ id?: string }>)(this.config.queueName, payload, {
      delay: options.delayMs,
      attempts: options.attempts ?? this.options.defaultAttempts,
    });

    return job.id ?? '';
  }

  public process(handler: JobHandler<TPayload>): void {
    this.worker = new Worker<TPayload>(
      this.config.queueName,
      async (job) => {
        try {
          await handler(job.data, {
            jobId: job.id ?? '',
            attempt: job.attemptsMade + 1,
            maxAttempts: job.opts.attempts ?? this.options.defaultAttempts,
          });
        } catch (error) {
          if (error instanceof RetryableJobError) {
            throw error;
          }

          // Permanent: stop BullMQ from burning the remaining attempts.
          await (job as unknown as { discard: () => void }).discard();
          throw error;
        }
      },
      {
        connection: this.config.connection,
        concurrency: 1,
        // Shared across workers, which is the point of using Redis here.
        limiter: { max: 1, duration: this.options.intervalMs },
      },
    );

    this.worker.on('failed', (job, error) => {
      logger.error(
        { jobId: job?.id, attempt: job?.attemptsMade, reason: error.message },
        'Email job failed',
      );
    });
  }

  public async size(): Promise<number> {
    const counts = await this.queue.getJobCounts('waiting', 'active', 'delayed');
    return (counts['waiting'] ?? 0) + (counts['active'] ?? 0) + (counts['delayed'] ?? 0);
  }

  public async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}
