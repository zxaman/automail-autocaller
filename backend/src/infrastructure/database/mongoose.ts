import mongoose from 'mongoose';

import { logger } from '../logger/logger';
import { checkServerVersion } from './server-version';

export async function connectToDatabase(uri: string): Promise<void> {
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connection established');
  });

  mongoose.connection.on('error', (error) => {
    logger.error({ err: error }, 'MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB connection disconnected');
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5_000,
    maxPoolSize: 10,
  });

  // Verified once at startup so an unsupported server is reported here rather
  // than as a confusing query failure later.
  await checkServerVersion(mongoose.connection);
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
