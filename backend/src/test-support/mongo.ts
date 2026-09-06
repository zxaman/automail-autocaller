import mongoose from 'mongoose';

/**
 * Integration tests need a real MongoDB. CI and local machines get one from
 * docker compose or an in-memory server. When neither is reachable the
 * integration suites are skipped instead of failing, and the dependency-free
 * unit suites still run.
 */
export interface TestMongo {
  readonly available: boolean;
  disconnect(): Promise<void>;
}

const EXPLICIT_URI = process.env.MONGODB_TEST_URI;

async function tryConnect(uri: string): Promise<boolean> {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
    return true;
  } catch {
    return false;
  }
}

export async function createTestMongo(): Promise<TestMongo> {
  let stopMemoryServer: (() => Promise<void>) | null = null;

  const connect = async (): Promise<boolean> => {
    if (EXPLICIT_URI) {
      return tryConnect(EXPLICIT_URI);
    }

    if (await tryConnect('mongodb://127.0.0.1:27017/automail_autocaller_test')) {
      return true;
    }

    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const server = await MongoMemoryServer.create();
      stopMemoryServer = async () => {
        await server.stop();
      };
      return tryConnect(server.getUri());
    } catch {
      return false;
    }
  };

  const available = await connect();

  return {
    available,
    disconnect: async () => {
      if (available) {
        await mongoose.disconnect();
      }
      if (stopMemoryServer) {
        await stopMemoryServer();
      }
    },
  };
}
