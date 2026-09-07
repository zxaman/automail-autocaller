import 'dotenv/config';
import { z } from 'zod';

/**
 * Preprocessor that treats empty / whitespace-only strings the same as a
 * missing value.  dotenv loads `KEY=` as `""`, which Zod considers a present
 * string and then fails `.min(1)`.  Wrapping optional env vars with this
 * transform lets both `KEY=` and an entirely absent key resolve to `undefined`.
 */
const emptyToUndefined = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
  z.string().trim().min(1).optional(),
);

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/automail_autocaller'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  CORS_ORIGINS: z.string().default('http://localhost:4200'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((value) => value.toLowerCase() === 'true'),

  // Google sign-in. The client ID is public; no client secret is needed for the
  // ID-token flow used by the SPA and the Capacitor shell.
  GOOGLE_CLIENT_ID: emptyToUndefined,

  // Session cookie behaviour.
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((value) => value.toLowerCase() === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: emptyToUndefined,

  // AES-256-GCM key protecting stored Gmail App Passwords. Must live in the
  // environment (or a KMS in production) and never in MongoDB or Git.
  CREDENTIAL_ENCRYPTION_KEY: emptyToUndefined,

  // AutoMail queue and attachment storage.
  // Redis is the production driver; the in-process driver keeps development
  // working without extra infrastructure, at the cost of losing queued jobs
  // on restart.
  EMAIL_QUEUE_DRIVER: z.enum(['memory', 'redis']).default('memory'),
  // Gmail's limits are per-day, but pacing sends also avoids tripping its
  // per-connection throttles. 1200ms ≈ 50 messages a minute.
  EMAIL_SEND_INTERVAL_MS: z.coerce.number().int().min(0).max(60_000).default(1200),
  EMAIL_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  ATTACHMENT_STORAGE_DIR: z.string().trim().min(1).default('storage/attachments'),

  // Telephony (AutoCall). Provider is resolved per call by destination country.
  EXOTEL_ACCOUNT_SID: emptyToUndefined,
  EXOTEL_API_KEY: emptyToUndefined,
  EXOTEL_API_TOKEN: emptyToUndefined,
  EXOTEL_SUBDOMAIN: z.string().trim().min(1).default('api.in.exotel.com'),
  EXOTEL_CALLER_ID: emptyToUndefined,
  DEFAULT_CALLER_ID: emptyToUndefined,
  // Verifies provider webhooks. Without it, call outcomes can be forged.
  TELEPHONY_WEBHOOK_SECRET: emptyToUndefined,

  // Bearer token protecting /api/v1/metrics. Unset disables the endpoint.
  METRICS_TOKEN: emptyToUndefined,

  // Surfaced by /health/ready so an incident can be tied to a deploy.
  APP_VERSION: z.string().trim().min(1).default('dev'),

  // SMTP transport defaults. Overridable for testing against a local catcher.
  SMTP_HOST: z.string().trim().min(1).default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(465),
  SMTP_SECURE: z
    .string()
    .default('true')
    .transform((value) => value.toLowerCase() === 'true'),
  SMTP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(15_000),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  console.error('Invalid environment configuration:', parsedEnvironment.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

/**
 * Settings that are optional in development but must be present in production.
 *
 * Every one of these is optional in the schema above so that a developer can
 * run the app without a Google project, an Exotel account or a KMS key. That
 * convenience becomes a hazard at deploy time: without this check a production
 * container starts happily and only reveals the missing value when a user
 * tries to sign in or send mail. Failing at boot turns a silent runtime
 * outage into an obvious failed deploy.
 */
type ProductionRequirement = {
  readonly key: string;
  readonly value: unknown;
  readonly why: string;
};

export function findMissingProductionSettings(
  config: z.infer<typeof environmentSchema>,
): ProductionRequirement[] {
  const required: ProductionRequirement[] = [
    {
      key: 'GOOGLE_CLIENT_ID',
      value: config.GOOGLE_CLIENT_ID,
      why: 'Google sign-in is the only way into the app; without it nobody can authenticate.',
    },
    {
      key: 'CREDENTIAL_ENCRYPTION_KEY',
      value: config.CREDENTIAL_ENCRYPTION_KEY,
      why: 'Gmail App Passwords cannot be encrypted at rest, so the API would refuse every connection attempt.',
    },
    {
      key: 'MONGODB_URI',
      value: config.MONGODB_URI.includes('localhost') ? undefined : config.MONGODB_URI,
      why: 'The default points at localhost, which in a container is the container itself.',
    },
  ];

  // Telephony is all-or-nothing: a half-configured provider fails at dial time.
  const telephonyKeys = [
    ['EXOTEL_ACCOUNT_SID', config.EXOTEL_ACCOUNT_SID],
    ['EXOTEL_API_KEY', config.EXOTEL_API_KEY],
    ['EXOTEL_API_TOKEN', config.EXOTEL_API_TOKEN],
    ['TELEPHONY_WEBHOOK_SECRET', config.TELEPHONY_WEBHOOK_SECRET],
  ] as const;

  const configuredCount = telephonyKeys.filter(([, value]) => Boolean(value)).length;

  if (configuredCount > 0 && configuredCount < telephonyKeys.length) {
    for (const [key, value] of telephonyKeys) {
      required.push({
        key,
        value,
        why: 'Telephony is partially configured; calling needs every Exotel value including the webhook secret.',
      });
    }
  }

  if (config.COOKIE_SECURE !== true) {
    required.push({
      key: 'COOKIE_SECURE',
      value: undefined,
      why: 'Session cookies would be sent over plaintext HTTP and could be stolen in transit.',
    });
  }

  if (config.EMAIL_QUEUE_DRIVER === 'memory') {
    required.push({
      key: 'EMAIL_QUEUE_DRIVER',
      value: undefined,
      why: 'The in-process queue loses every queued email on restart; production needs the redis driver.',
    });
  }

  return required.filter((requirement) => !requirement.value);
}

if (parsedEnvironment.data.NODE_ENV === 'production') {
  const missing = findMissingProductionSettings(parsedEnvironment.data);

  if (missing.length > 0) {
    console.error(
      'Refusing to start in production. The following settings are missing or unsafe:\n' +
        missing.map((item) => `  - ${item.key}: ${item.why}`).join('\n'),
    );
    throw new Error(`Missing production configuration: ${missing.map((i) => i.key).join(', ')}`);
  }
}

export const env = {
  ...parsedEnvironment.data,
  corsOrigins: parsedEnvironment.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export type Environment = typeof env;

/** True when Google sign-in has been configured for this deployment. */
export const isGoogleAuthConfigured = Boolean(env.GOOGLE_CLIENT_ID);

/**
 * True when Gmail sending can be configured. Without a key the API refuses to
 * accept App Passwords at all rather than storing them weakly.
 */
export const isCredentialEncryptionConfigured = Boolean(env.CREDENTIAL_ENCRYPTION_KEY);
