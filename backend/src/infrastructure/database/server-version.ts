import type mongoose from 'mongoose';

import { logger } from '../logger/logger';

/**
 * Lowest MongoDB version the application can run on.
 *
 * The analytics most-contacted ranking uses `$unionWith`, introduced in
 * MongoDB 4.4. On an older server that pipeline fails at query time with an
 * unrecognised-stage error, which would surface as a broken analytics page
 * long after deployment. Checking at startup turns that into one clear log
 * line instead.
 */
export const MINIMUM_MONGODB_VERSION = '4.4.0';

export interface VersionCheckResult {
  readonly version: string | null;
  readonly satisfiesMinimum: boolean;
}

/** Compares dotted version strings numerically, e.g. 4.10 > 4.9. */
export function isVersionAtLeast(actual: string, minimum: string): boolean {
  const parse = (value: string): number[] =>
    value
      .split('.')
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isNaN(part) ? 0 : part));

  const left = parse(actual);
  const right = parse(minimum);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;

    if (a !== b) {
      return a > b;
    }
  }

  return true;
}

/**
 * Reads the server version and warns when it is too old.
 *
 * This warns rather than throws: an operator running an older server should
 * still get a working app, with one feature degraded and a loud explanation,
 * rather than a process that refuses to boot.
 */
export async function checkServerVersion(
  connection: mongoose.Connection,
): Promise<VersionCheckResult> {
  try {
    const admin = connection.db?.admin();

    if (!admin) {
      return { version: null, satisfiesMinimum: true };
    }

    const info = (await admin.serverInfo()) as { version?: string };
    const version = info.version ?? null;

    if (!version) {
      return { version: null, satisfiesMinimum: true };
    }

    const satisfiesMinimum = isVersionAtLeast(version, MINIMUM_MONGODB_VERSION);

    if (!satisfiesMinimum) {
      logger.warn(
        { version, required: MINIMUM_MONGODB_VERSION },
        'MongoDB is older than the supported minimum; the analytics most-contacted ranking uses $unionWith and will fail on this server',
      );
    } else {
      logger.info({ version }, 'MongoDB server version verified');
    }

    return { version, satisfiesMinimum };
  } catch (error) {
    // A failed check must never prevent startup.
    logger.warn({ err: error }, 'Could not determine the MongoDB server version');
    return { version: null, satisfiesMinimum: true };
  }
}
