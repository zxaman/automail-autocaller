import { env } from '../../config/environment';
import { isDatabaseReady } from '../../infrastructure/database/mongoose';
import type { QueueDriver } from '../../infrastructure/queue/job-queue';

export type DependencyStatus = 'ready' | 'not-ready' | 'degraded';

export interface DependencyReport {
  status: DependencyStatus;
  detail?: string;
}

export interface HealthReport {
  ready: boolean;
  dependencies: Record<string, DependencyReport>;
  queueDepth: number | null;
  uptimeSeconds: number;
  version: string;
}

/**
 * Builds the readiness picture used by orchestrators and by the runbook.
 *
 * A health check is only useful if failing it means something. Liveness stays
 * trivially true so a slow dependency never causes a restart loop; readiness
 * reflects whether this instance can actually serve traffic, so a broken
 * dependency takes the instance out of rotation instead of letting it accept
 * requests it cannot fulfil.
 */
export class HealthService {
  constructor(
    private readonly queue: Pick<QueueDriver<unknown>, 'name' | 'size'> | null,
    private readonly startedAt: number = Date.now(),
    private readonly version: string = env.APP_VERSION,
  ) {}

  public async report(): Promise<HealthReport> {
    const dependencies: Record<string, DependencyReport> = {};

    const databaseReady = isDatabaseReady();
    dependencies['database'] = databaseReady
      ? { status: 'ready' }
      : { status: 'not-ready', detail: 'MongoDB connection is not open' };

    let queueDepth: number | null = null;

    if (this.queue) {
      try {
        queueDepth = await this.queue.size();
        dependencies['queue'] =
          this.queue.name === 'in-process'
            ? {
                status: 'degraded',
                // Not a failure: the app works. But queued mail is lost on
                // restart, so an operator needs to see it.
                detail: 'Using the in-process queue; queued email is lost on restart',
              }
            : { status: 'ready' };
      } catch (error) {
        // The queue backend is unreachable. Email cannot be accepted, so this
        // instance is genuinely not ready.
        dependencies['queue'] = {
          status: 'not-ready',
          detail: error instanceof Error ? error.message : 'Queue backend is unreachable',
        };
      }
    }

    // Degraded is deliberately not a failure; only not-ready is.
    const ready = Object.values(dependencies).every(
      (dependency) => dependency.status !== 'not-ready',
    );

    return {
      ready,
      dependencies,
      queueDepth,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      version: this.version,
    };
  }
}
