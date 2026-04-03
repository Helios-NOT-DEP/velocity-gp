import { createRequire } from 'node:module';
import { Pool } from 'pg';

import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '../config/env.js';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client') as typeof import('@prisma/client');
type PrismaClientInstance = InstanceType<typeof PrismaClient>;

export interface DatabaseConfig {
  readonly provider: 'postgresql';
  readonly configured: boolean;
  readonly connectionString?: string;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientInstance;
  prismaPool?: Pool;
};

const databaseUrl = env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

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
  return env.DATABASE_URL
    ? {
        provider: 'postgresql',
        configured: true,
        connectionString: env.DATABASE_URL,
      }
    : {
        provider: 'postgresql',
        configured: false,
      };
}
