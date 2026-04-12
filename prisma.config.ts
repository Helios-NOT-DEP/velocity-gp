import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';

import { resolveSeedDatabaseUrl } from './apps/api/prisma/resolveSeedDatabaseUrl';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const nodeEnv = process.env['NODE_ENV'];

function loadEnvironmentFiles(): void {
  const packageRoot = resolve(currentDirectory, 'apps/api');
  const prioritizedEnvFiles =
    nodeEnv === 'test'
      ? [
          resolve(currentDirectory, '.env.test'),
          resolve(packageRoot, '.env.test'),
          resolve(currentDirectory, '.env.local'),
          resolve(packageRoot, '.env.local'),
          resolve(currentDirectory, '.env'),
          resolve(packageRoot, '.env'),
        ]
      : [
          resolve(currentDirectory, '.env.local'),
          resolve(packageRoot, '.env.local'),
          resolve(currentDirectory, '.env'),
          resolve(packageRoot, '.env'),
        ];

  prioritizedEnvFiles
    .filter((envFilePath, index, envFilePaths) => {
      return envFilePaths.indexOf(envFilePath) === index && existsSync(envFilePath);
    })
    .forEach((envFilePath) => {
      loadDotenv({ path: envFilePath });
    });
}

loadEnvironmentFiles();

function resolveDatasourceUrl(): string {
  try {
    return resolveSeedDatabaseUrl().url;
  } catch {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is required. Set a direct Postgres URL or configure SEED_DATABASE_URL / DIRECT_DATABASE_URL.'
      );
    }

    return databaseUrl;
  }
}

export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: {
    path: 'apps/api/prisma/migrations',
    seed: 'tsx apps/api/prisma/seed.ts',
  },
  datasource: {
    url: resolveDatasourceUrl(),
  },
});
