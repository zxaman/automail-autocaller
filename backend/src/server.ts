import { createApp, type AppResources } from './app';
import { env } from './config/environment';
import { connectToDatabase, disconnectFromDatabase } from './infrastructure/database/mongoose';
import { logger } from './infrastructure/logger/logger';

/** How long to let in-flight work finish before exiting anyway. */
const SHUTDOWN_TIMEOUT_MS = 15_000;

async function bootstrap(): Promise<void> {
  await connectToDatabase(env.MONGODB_URI);

  const app = createApp();
  const resources = (app as unknown as { resources?: AppResources }).resources;

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info({ host: env.HOST, port: env.PORT }, 'API server started');
  });

  /*
   * Graceful shutdown.
   *
   * An orchestrator sends SIGTERM and then kills the container after a grace
   * period. In that window the process must stop accepting new connections,
   * let in-flight requests finish, and close the queue so a job being sent is
   * not abandoned halfway. The forced timeout guarantees the process exits
   * even if a socket refuses to close, which otherwise leaves the container
   * hanging until it is SIGKILLed.
   */
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info({ signal }, 'Shutdown signal received; draining');

    const forced = setTimeout(() => {
      logger.error('Graceful shutdown timed out; exiting immediately');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    // Do not hold the event loop open just for the timer.
    forced.unref();

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });

      // Closed after the HTTP server, so a request already in flight can still
      // enqueue the job it was about to enqueue.
      await resources?.closeQueue();
      await disconnectFromDatabase();

      clearTimeout(forced);
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      clearTimeout(forced);
      logger.error({ err: error }, 'Shutdown failed');
      process.exit(1);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  /*
   * A rejected promise nobody handled has left the process in an unknown
   * state. Log it and exit so the orchestrator restarts a clean instance
   * rather than leaving a half-broken one serving traffic.
   */
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection; shutting down');
    void shutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception; shutting down');
    void shutdown('uncaughtException');
  });
}

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, 'API failed to start');
  process.exitCode = 1;
});
