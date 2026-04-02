/**
 * Database Client
 *
 * Centralized Prisma client instance for all database access.
 * Import from here instead of generating your own instance.
 *
 * ⚠️ BACKEND-ONLY: This file should only be imported in server-side code.
 * Do not import this in React components or client-side code.
 *
 * @module db/client
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
