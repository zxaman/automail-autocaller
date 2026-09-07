import mongoose from 'mongoose';

import { logger } from '../logger/logger';
import { checkServerVersion } from './server-version';
import { UserModel } from '../../modules/users/user.model';

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

  // Keep the user collection aligned with the current auth model.
  // Older databases can still carry a unique `googleId` index from the
  // previous Google-only auth flow, which breaks password registration by
  // treating every new user as `googleId = null`. Syncing the model drops the
  // stale index and applies the sparse replacement declared on the schema.
  await UserModel.syncIndexes();
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
