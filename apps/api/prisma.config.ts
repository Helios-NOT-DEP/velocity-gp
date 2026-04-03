import 'dotenv/config';

/**
 * Prisma CLI configuration.
 *
 * Notes:
 * - This repository currently uses Prisma 5.x scripts with explicit `--schema` flags.
 * - This file is added to establish a Prisma 7-ready configuration path while remaining
 *   harmless for the current toolchain.
 */
export default {
  schema: './src/db/schema.prisma',
  migrations: {
    path: './src/db/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
};