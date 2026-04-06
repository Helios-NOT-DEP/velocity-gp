import { Pool } from 'pg';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client.js';

import { env } from '../config/env.js';
import { resolveSeedDatabaseUrl } from './resolveSeedDatabaseUrl.js';

type PrismaClientInstance = PrismaClient;

export interface DatabaseConfig {
  readonly provider: 'postgresql';
  readonly configured: boolean;
  readonly connectionString?: string;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientInstance;
  prismaPool?: Pool;
};

function resolveRuntimeDatabaseUrl(): string {
  try {
    return resolveSeedDatabaseUrl({
      SEED_DATABASE_URL: env.SEED_DATABASE_URL,
      DIRECT_DATABASE_URL: env.DIRECT_DATABASE_URL,
      POSTGRES_URL_NON_POOLING: env.POSTGRES_URL_NON_POOLING,
      POSTGRES_URL: env.POSTGRES_URL,
      POSTGRES_PRISMA_URL: env.POSTGRES_PRISMA_URL,
      DATABASE_URL: env.DATABASE_URL,
    }).url;
  } catch (error) {
    if (env.DATABASE_URL === undefined) {
      return 'postgresql://postgres:postgres@localhost:5432/postgres';
    }

    throw error;
  }
}

const hasConfiguredDatabaseUrl = [
  env.SEED_DATABASE_URL,
  env.DIRECT_DATABASE_URL,
  env.POSTGRES_URL_NON_POOLING,
  env.POSTGRES_URL,
  env.POSTGRES_PRISMA_URL,
  env.DATABASE_URL,
].some((value) => value !== undefined);

const databaseUrl = resolveRuntimeDatabaseUrl();

const prismaPool =
  globalForPrisma.prismaPool ||
  new Pool({
    connectionString: databaseUrl,
  });

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: new PrismaPg(prismaPool),
    log: ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaPool = prismaPool;
  globalForPrisma.prisma = prisma;
}

export function getDatabaseConfig(): DatabaseConfig {
  return hasConfiguredDatabaseUrl
    ? {
        provider: 'postgresql',
        configured: true,
        connectionString: databaseUrl,
      }
    : {
        provider: 'postgresql',
        configured: false,
      };
}
