import mongoose from 'mongoose';

import { logger } from '../logger/logger';

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
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
