import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { z } from 'zod';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const nodeEnv = process.env['NODE_ENV'];
if (nodeEnv !== 'production') {
  const envFilePath = nodeEnv === 'test' ? '../../.env.test' : '../../.env';
  config({ path: resolve(currentDirectory, envFilePath) });
}

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
  AUTH_SECRET: z.string().optional(),
  PIT_RELEASE_SCHEDULER_ENABLED: booleanFromEnv,
  PIT_RELEASE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
  PIT_RELEASE_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  PIT_RELEASE_WEBHOOK_URL: z.string().url().optional(),
  PIT_RELEASE_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(3_000),
});

export const env = envSchema.parse(process.env);
