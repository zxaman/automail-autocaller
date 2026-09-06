/**
 * Queue abstraction.
 *
 * The architecture calls for "BullMQ or a queue abstraction". This is the
 * abstraction: the email service depends on this interface, never on BullMQ
 * directly, so the driver can be swapped without touching business logic.
 *
 * Two drivers exist: an in-process one (development, tests, single-instance
 * deployments with no Redis) and a Redis/BullMQ one for production. Both must
 * honour the same contract, especially around retry classification.
 */

export interface JobOptions {
  /** Milliseconds to wait before the job first becomes runnable. */
  delayMs?: number;
  /** Total attempts including the first. */
  attempts?: number;
}

export interface JobContext {
  jobId: string;
  attempt: number;
  maxAttempts: number;
}

export type JobHandler<TPayload> = (payload: TPayload, context: JobContext) => Promise<void>;

/**
 * Thrown by a handler to say "this failed, but retrying could work".
 * Anything else thrown is treated as permanent and is not retried.
 */
export class RetryableJobError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'RetryableJobError';
  }
}

export interface QueueDriver<TPayload> {
  readonly name: string;
  add(payload: TPayload, options?: JobOptions): Promise<string>;
  process(handler: JobHandler<TPayload>): void;
  /** Approximate count of jobs waiting or running. */
  size(): Promise<number>;
  close(): Promise<void>;
}
