import { randomUUID } from 'node:crypto';

import { logger } from '../logger/logger';
import {
  RetryableJobError,
  type JobHandler,
  type JobOptions,
  type QueueDriver,
} from './job-queue';

interface QueuedJob<TPayload> {
  id: string;
  payload: TPayload;
  attempt: number;
  maxAttempts: number;
  runAfter: number;
}

export interface InProcessQueueOptions {
  /** Minimum gap between two jobs starting. This is the throttle. */
  intervalMs?: number;
  defaultAttempts?: number;
  /** Base for exponential backoff between retries. */
  backoffBaseMs?: number;
}

/**
 * Single-process queue with the same semantics as the Redis driver.
 *
 * Jobs run one at a time, spaced by `intervalMs`, which is how Gmail's rate
 * limits are respected rather than bypassed. Retries use exponential backoff
 * and only ever fire for `RetryableJobError`.
 *
 * The honest tradeoff: jobs live in memory, so a restart loses anything still
 * queued and a second instance would send independently. That is why the Redis
 * driver exists for production. Records in MongoDB always reflect the true
 * outcome, so nothing is silently lost from the user's point of view.
 */
export class InProcessQueue<TPayload> implements QueueDriver<TPayload> {
  public readonly name = 'in-process';

  private readonly jobs: QueuedJob<TPayload>[] = [];
  private handler: JobHandler<TPayload> | null = null;
  private isDraining = false;
  private isClosed = false;
  private lastStartedAt = 0;
  private activeCount = 0;
  private timer: NodeJS.Timeout | null = null;

  private readonly intervalMs: number;
  private readonly defaultAttempts: number;
  private readonly backoffBaseMs: number;

  constructor(options: InProcessQueueOptions = {}) {
    this.intervalMs = options.intervalMs ?? 1200;
    this.defaultAttempts = options.defaultAttempts ?? 3;
    this.backoffBaseMs = options.backoffBaseMs ?? 5000;
  }

  public async add(payload: TPayload, options: JobOptions = {}): Promise<string> {
    if (this.isClosed) {
      throw new Error('The queue has been closed');
    }

    const job: QueuedJob<TPayload> = {
      id: randomUUID(),
      payload,
      attempt: 0,
      maxAttempts: options.attempts ?? this.defaultAttempts,
      runAfter: Date.now() + (options.delayMs ?? 0),
    };

    this.jobs.push(job);
    this.scheduleDrain();

    return job.id;
  }

  public process(handler: JobHandler<TPayload>): void {
    this.handler = handler;
    this.scheduleDrain();
  }

  public async size(): Promise<number> {
    return this.jobs.length + this.activeCount;
  }

  public async close(): Promise<void> {
    this.isClosed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.jobs.length = 0;
  }

  private scheduleDrain(): void {
    if (this.isDraining || this.isClosed || !this.handler) {
      return;
    }

    if (this.timer) {
      return;
    }

    const wait = this.nextRunDelay();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.drain();
    }, wait);

    // Never hold the process open purely for a pending queue tick.
    this.timer.unref?.();
  }

  /** Enforces both the throttle interval and any per-job delay. */
  private nextRunDelay(): number {
    const now = Date.now();
    const throttleGap = Math.max(0, this.lastStartedAt + this.intervalMs - now);

    const earliestJob = this.jobs.reduce(
      (earliest, job) => Math.min(earliest, job.runAfter),
      Number.POSITIVE_INFINITY,
    );

    if (earliestJob === Number.POSITIVE_INFINITY) {
      return throttleGap;
    }

    return Math.max(throttleGap, earliestJob - now, 0);
  }

  private async drain(): Promise<void> {
    if (this.isDraining || this.isClosed || !this.handler) {
      return;
    }

    this.isDraining = true;

    try {
      while (!this.isClosed) {
        const now = Date.now();
        const index = this.jobs.findIndex((job) => job.runAfter <= now);

        if (index === -1) {
          break;
        }

        if (now - this.lastStartedAt < this.intervalMs) {
          break;
        }

        const [job] = this.jobs.splice(index, 1);
        if (!job) {
          break;
        }

        this.lastStartedAt = Date.now();
        await this.runJob(job);
      }
    } finally {
      this.isDraining = false;
      if (this.jobs.length > 0) {
        this.scheduleDrain();
      }
    }
  }

  private async runJob(job: QueuedJob<TPayload>): Promise<void> {
    if (!this.handler) {
      return;
    }

    this.activeCount += 1;
    const attempt = job.attempt + 1;

    try {
      await this.handler(job.payload, {
        jobId: job.id,
        attempt,
        maxAttempts: job.maxAttempts,
      });
    } catch (error) {
      const isRetryable = error instanceof RetryableJobError;
      const hasAttemptsLeft = attempt < job.maxAttempts;

      if (isRetryable && hasAttemptsLeft) {
        const backoff =
          error.retryAfterMs ?? this.backoffBaseMs * Math.pow(2, attempt - 1);

        this.jobs.push({ ...job, attempt, runAfter: Date.now() + backoff });
        logger.warn(
          { jobId: job.id, attempt, backoffMs: backoff },
          'Job failed with a retryable error and was rescheduled',
        );
      } else {
        // Permanent failure, or retries exhausted. The handler is responsible
        // for having recorded the outcome durably before this point.
        logger.error(
          { jobId: job.id, attempt, retryable: isRetryable },
          'Job failed permanently',
        );
      }
    } finally {
      this.activeCount -= 1;
    }
  }
}
