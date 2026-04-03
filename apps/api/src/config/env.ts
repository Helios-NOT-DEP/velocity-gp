import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { z } from 'zod';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(currentDirectory, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/api'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  AUTH_EVENT_ID: z.string().optional(),
  AUTH_SESSION_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  AUTH_SESSION_UPDATE_AGE_SECONDS: z.coerce.number().int().nonnegative().default(60 * 60 * 12),
  AUTH_MAGIC_LINK_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(60 * 15),
  AUTH_EMAIL_FROM: z.string().email().optional(),
  AUTH_SENDGRID_API_KEY: z.string().optional(),
  AUTH_DEBUG: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const env = envSchema.parse(process.env);
