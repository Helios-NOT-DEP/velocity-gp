import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/api'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().optional(),
  DIRECT_DATABASE_URL: z.string().optional(),
  POSTGRES_URL_NON_POOLING: z.string().optional(),
  POSTGRES_URL: z.string().optional(),
  POSTGRES_PRISMA_URL: z.string().optional(),
  SEED_DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  PIT_RELEASE_SCHEDULER_ENABLED: booleanFromEnv,
  PIT_RELEASE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
  PIT_RELEASE_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  PIT_RELEASE_WEBHOOK_URL: z.string().url().optional(),
  PIT_RELEASE_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(3_000),
});

export const env = envSchema.parse(process.env);
