import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

import { defineConfig, env } from 'prisma/config';

const configDirectory = dirname(fileURLToPath(import.meta.url));

const prioritizedEnvFiles = [
  resolve(configDirectory, '.env.local'),
  resolve(configDirectory, '.env'),
  resolve(configDirectory, 'apps/api/.env.local'),
  resolve(configDirectory, 'apps/api/.env'),
].filter((envFilePath, index, envFilePaths) => {
  return envFilePaths.indexOf(envFilePath) === index && existsSync(envFilePath);
});

prioritizedEnvFiles.forEach((envFilePath) => {
  config({ path: envFilePath });
});

export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: {
    path: 'apps/api/prisma/migrations',
    seed: 'tsx apps/api/prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
