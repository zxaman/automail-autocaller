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
