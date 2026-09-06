import { createApp } from './app';
import { env } from './config/environment';
import { connectToDatabase, disconnectFromDatabase } from './infrastructure/database/mongoose';
import { logger } from './infrastructure/logger/logger';

async function bootstrap(): Promise<void> {
  await connectToDatabase(env.MONGODB_URI);

  const app = createApp();
  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info({ host: env.HOST, port: env.PORT }, 'API server started');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received');

    server.close(async (error) => {
      if (error) {
        logger.error({ err: error }, 'HTTP server failed to close cleanly');
        process.exitCode = 1;
      }

      await disconnectFromDatabase();
    });
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, 'API failed to start');
  process.exitCode = 1;
});
