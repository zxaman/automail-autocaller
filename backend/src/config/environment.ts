import 'dotenv/config';
import { z } from 'zod';

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
  GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),

  // Session cookie behaviour.
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((value) => value.toLowerCase() === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().trim().min(1).optional(),

  // AES-256-GCM key protecting stored Gmail App Passwords. Must live in the
  // environment (or a KMS in production) and never in MongoDB or Git.
  CREDENTIAL_ENCRYPTION_KEY: z.string().trim().min(1).optional(),

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
  EXOTEL_ACCOUNT_SID: z.string().trim().min(1).optional(),
  EXOTEL_API_KEY: z.string().trim().min(1).optional(),
  EXOTEL_API_TOKEN: z.string().trim().min(1).optional(),
  EXOTEL_SUBDOMAIN: z.string().trim().min(1).default('api.in.exotel.com'),
  EXOTEL_CALLER_ID: z.string().trim().min(1).optional(),
  DEFAULT_CALLER_ID: z.string().trim().min(1).optional(),
  // Verifies provider webhooks. Without it, call outcomes can be forged.
  TELEPHONY_WEBHOOK_SECRET: z.string().trim().min(1).optional(),

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
