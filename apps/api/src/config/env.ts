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

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('/api'),
  FRONTEND_ORIGIN: frontendOrigins.default(['http://localhost:5173']),
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
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(72),
  MAILTRAP_WEBHOOK_SECRET: optionalMinString(16),
  MAILTRAP_AUDIT_ACTOR_EMAIL: optionalEmail.default('system+mailtrap@velocitygp.internal'),
  N8N_WEBHOOK_TOKEN: optionalMinString(16),
  N8N_HOST: optionalUrl,
  N8N_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  PIT_RELEASE_SCHEDULER_ENABLED: booleanFromEnv,
  PIT_RELEASE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
  PIT_RELEASE_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  PIT_RELEASE_WEBHOOK_URL: optionalUrl,
  PIT_RELEASE_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(3_000),
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

export const env = {
  ...parsedEnv,
  FRONTEND_ORIGIN: parsedEnv.FRONTEND_ORIGIN[0],
  FRONTEND_ORIGINS: parsedEnv.FRONTEND_ORIGIN,
};
