import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from 'path';
import { config } from 'dotenv';
import { z } from 'zod';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const nodeEnv = process.env['NODE_ENV'];

function loadEnvironmentFiles(): void {
  if (nodeEnv === 'production') {
    return;
  }

  // Load from repo + package roots so workspace commands and direct package runs behave the same.
  const packageRoot = resolve(currentDirectory, '../..');
  const repoRoot = resolve(currentDirectory, '../../../../');
  const prioritizedEnvFiles =
    nodeEnv === 'test'
      ? [
          resolve(repoRoot, '.env.test'),
          resolve(packageRoot, '.env.test'),
          resolve(repoRoot, '.env.local'),
          resolve(packageRoot, '.env.local'),
          resolve(repoRoot, '.env'),
          resolve(packageRoot, '.env'),
        ]
      : [
          resolve(repoRoot, '.env.local'),
          resolve(packageRoot, '.env.local'),
          resolve(repoRoot, '.env'),
          resolve(packageRoot, '.env'),
        ];

  prioritizedEnvFiles
    .filter((envFilePath, index, envFilePaths) => {
      return envFilePaths.indexOf(envFilePath) === index && existsSync(envFilePath);
    })
    .forEach((envFilePath) => {
      config({ path: envFilePath });
    });
}

loadEnvironmentFiles();

const booleanFromEnv = z.preprocess(
  (value) => (typeof value === 'string' ? value.toLowerCase() : value),
  z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value !== 'false')
);

// Boolean env helper that defaults to false unless explicitly set to 'true'.
const booleanTrueOnlyIfExplicit = z.preprocess(
  (value) => (typeof value === 'string' ? value.toLowerCase() : value),
  z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true')
);

const optionalUrl = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().url().optional().nullable()
);

const optionalMinString = (min: number) =>
  z.preprocess((v) => (v === '' ? undefined : v), z.string().min(min).optional());

const optionalEmail = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().email().optional()
);

const frontendOrigins = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}, z.array(z.string().url()).min(1));

function isLoopbackHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();

  return (
    normalizedHostname === 'localhost' ||
    normalizedHostname.endsWith('.localhost') ||
    normalizedHostname === '0.0.0.0' ||
    normalizedHostname === '::1' ||
    normalizedHostname === '[::1]' ||
    normalizedHostname === '127.0.0.1' ||
    normalizedHostname.startsWith('127.')
  );
}

function assertSafeMagicLinkOriginInProduction(origin: string): void {
  const parsedOrigin = new URL(origin);

  if (parsedOrigin.protocol !== 'https:') {
    throw new Error(
      'Invalid FRONTEND_MAGIC_LINK_ORIGIN in production: callback origin must use HTTPS.'
    );
  }

  if (isLoopbackHostname(parsedOrigin.hostname)) {
    throw new Error(
      'Invalid FRONTEND_MAGIC_LINK_ORIGIN in production: callback origin cannot target localhost or loopback hosts.'
    );
  }
}

function assertRequiredSecretsInProduction(parsedEnv: { AUTH_SECRET?: string }): void {
  if (!parsedEnv.AUTH_SECRET || parsedEnv.AUTH_SECRET.trim().length === 0) {
    throw new Error(
      'AUTH_SECRET must be set in production. Sessions cannot be signed securely without it.'
    );
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('/api'),
  FRONTEND_ORIGIN: frontendOrigins.default(['http://localhost:5173']),
  FRONTEND_MAGIC_LINK_ORIGIN: optionalUrl,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().optional(),
  DIRECT_DATABASE_URL: z.string().optional(),
  POSTGRES_URL_NON_POOLING: z.string().optional(),
  POSTGRES_URL: z.string().optional(),
  POSTGRES_PRISMA_URL: z.string().optional(),
  SEED_DATABASE_URL: z.string().optional(),
  VITE_PUBLIC_POSTHOG_KEY: z.string().optional(),
  VITE_PUBLIC_POSTHOG_HOST: optionalUrl,
  SERVICE_NAME: z.string().default('velocity-gp-api'),
  AUTH_SECRET: z.string().optional(),
  MAGIC_LINK_TOKEN_EXPIRY_DATE: z.string().nullable().default(null),
  MAGIC_LINK_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_SESSION_COOKIE_TTL_DAYS: z.coerce.number().int().positive().default(5),
  MAILTRAP_WEBHOOK_SECRET: optionalMinString(16),
  MAILTRAP_AUDIT_ACTOR_EMAIL: optionalEmail.default('system+mailtrap@velocitygp.internal'),
  N8N_WEBHOOK_TOKEN: optionalMinString(16),
  N8N_HOST: optionalUrl,
  N8N_QRCODEGEN_WEBHOOK_PATH_TEMPLATE: optionalMinString(1).default('/QRCodeGen'),
  N8N_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  PIT_RELEASE_SCHEDULER_ENABLED: booleanFromEnv,
  PIT_RELEASE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
  PIT_RELEASE_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  PIT_RELEASE_WEBHOOK_URL: optionalUrl,
  PIT_RELEASE_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(3_000),
  N8N_IMAGE_API_URL: z.string().url().optional(),
  N8N_IMAGE_API_KEY: z.string().optional(),
  // Override the number of approved descriptions required before logo generation fires.
  // Defaults to 2 (real team size). Set to 1 in dev to trigger generation from a single submission.
  GARAGE_REQUIRED_PLAYER_COUNT: z.coerce.number().int().min(1).default(2),
  // Base URL for the storage bucket — used to construct the public image URL
  // from the imageFileName path returned by n8n.
  // e.g. https://velocity-app.nyc3.digitaloceanspaces.com
  STORAGE_BASE_URL: z.string().url().optional(),
  // Used by moderationService to call the OpenAI Moderations endpoint.
  // Optional — when absent the service falls back to a keyword blocklist (dev only).
  OPENAI_API_KEY: z.string().optional(),
  // When `true`, skip calling the OpenAI Moderations API and fall back to
  // the local keyword blocklist. Defaults to `false`.
  SKIP_OPENAI_MODERATION: booleanTrueOnlyIfExplicit.default(false),
});

export const packageJson = z
  .object({
    apiPath: z.string().default(path.resolve(process.cwd(), 'api/package.json')),
    webPath: z.string().default(path.resolve(process.cwd(), 'client/package.json')),
  })
  .default({
    apiPath: resolve(currentDirectory, '../../package.json'),
    webPath: resolve(currentDirectory, '../../../client/package.json'),
  });

const parsedEnv = envSchema.parse(process.env);
const frontendOriginsFromEnv = parsedEnv.FRONTEND_ORIGIN;
const frontendOrigin = frontendOriginsFromEnv[0];
// Magic-link callback defaults to primary frontend origin when no override is provided.
const frontendMagicLinkOrigin = parsedEnv.FRONTEND_MAGIC_LINK_ORIGIN ?? frontendOrigin;

if (parsedEnv.NODE_ENV === 'production') {
  assertSafeMagicLinkOriginInProduction(frontendMagicLinkOrigin);
  assertRequiredSecretsInProduction(parsedEnv);
}

export const env = {
  ...parsedEnv,
  FRONTEND_PRIMARY_ORIGIN: frontendOrigin,
  FRONTEND_ALLOWED_ORIGINS: frontendOriginsFromEnv,
  FRONTEND_MAGIC_LINK_ORIGIN: frontendMagicLinkOrigin,
};
