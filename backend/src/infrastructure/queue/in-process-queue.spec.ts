import { describe, expect, it, vi } from 'vitest';

import { InProcessQueue } from './in-process-queue';
import { RetryableJobError } from './job-queue';

interface TestPayload {
  id: number;
}

/** Waits for the queue to settle rather than sleeping a fixed amount. */
async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Timed out waiting for the queue');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('InProcessQueue', () => {
  it('runs a queued job', async () => {
    const queue = new InProcessQueue<TestPayload>({ intervalMs: 0 });
    const seen: number[] = [];

    queue.process(async (payload) => {
      seen.push(payload.id);
    });
    await queue.add({ id: 1 });

    await waitFor(() => seen.length === 1);
    expect(seen).toEqual([1]);
    await queue.close();
  });

  it('runs jobs one at a time, never concurrently', async () => {
    const queue = new InProcessQueue<TestPayload>({ intervalMs: 0 });
    let active = 0;
    let maxActive = 0;

    queue.process(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
    });

    await Promise.all([queue.add({ id: 1 }), queue.add({ id: 2 }), queue.add({ id: 3 })]);
    await waitFor(() => maxActive > 0 && active === 0);

    expect(maxActive).toBe(1);
    await queue.close();
  });

  it('spaces jobs apart to respect the provider rate limit', async () => {
    const queue = new InProcessQueue<TestPayload>({ intervalMs: 60 });
    const timestamps: number[] = [];

    queue.process(async () => {
      timestamps.push(Date.now());
    });

    await queue.add({ id: 1 });
    await queue.add({ id: 2 });
    await waitFor(() => timestamps.length === 2);

    expect(timestamps[1]! - timestamps[0]!).toBeGreaterThanOrEqual(50);
    await queue.close();
  });

  it('retries a retryable failure and succeeds on a later attempt', async () => {
    const queue = new InProcessQueue<TestPayload>({ intervalMs: 0, backoffBaseMs: 10 });
    const attempts: number[] = [];

    queue.process(async (_payload, context) => {
      attempts.push(context.attempt);
      if (context.attempt < 3) {
        throw new RetryableJobError('temporary');
      }
    });

    await queue.add({ id: 1 }, { attempts: 3 });
    await waitFor(() => attempts.length === 3);

    expect(attempts).toEqual([1, 2, 3]);
    await queue.close();
  });

  it('does not retry a permanent failure', async () => {
    const queue = new InProcessQueue<TestPayload>({ intervalMs: 0, backoffBaseMs: 10 });
    const handler = vi.fn().mockRejectedValue(new Error('bad credentials'));

    queue.process(handler);
    await queue.add({ id: 1 }, { attempts: 5 });

    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(handler).toHaveBeenCalledTimes(1);
    await queue.close();
  });

  it('gives up once the attempt budget is exhausted', async () => {
    const queue = new InProcessQueue<TestPayload>({ intervalMs: 0, backoffBaseMs: 5 });
    const handler = vi.fn().mockRejectedValue(new RetryableJobError('still failing'));

    queue.process(handler);
    await queue.add({ id: 1 }, { attempts: 2 });

    await waitFor(() => handler.mock.calls.length === 2);
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(handler).toHaveBeenCalledTimes(2);
    await queue.close();
  });

  it('honours an explicit retry delay from the error', async () => {
    const queue = new InProcessQueue<TestPayload>({ intervalMs: 0 });
    const times: number[] = [];

    queue.process(async (_payload, context) => {
      times.push(Date.now());
      if (context.attempt === 1) {
        throw new RetryableJobError('slow down', 80);
      }
    });

    await queue.add({ id: 1 }, { attempts: 2 });
    await waitFor(() => times.length === 2);

    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(70);
    await queue.close();
  });

  it('reports its pending size', async () => {
    const queue = new InProcessQueue<TestPayload>({ intervalMs: 10_000 });
    await queue.add({ id: 1 });
    await queue.add({ id: 2 });

    expect(await queue.size()).toBe(2);
    await queue.close();
  });

  it('refuses new jobs once closed', async () => {
    const queue = new InProcessQueue<TestPayload>();
    await queue.close();

    await expect(queue.add({ id: 1 })).rejects.toThrow(/closed/);
  });
});
