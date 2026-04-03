import { PrismaClient } from '@prisma/client';

import { env } from '../config/env.js';

export interface DatabaseConfig {
  readonly provider: 'postgresql';
  readonly configured: boolean;
  readonly connectionString?: string;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
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
