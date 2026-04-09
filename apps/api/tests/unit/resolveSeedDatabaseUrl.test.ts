import { describe, expect, it } from 'vitest';

import { resolveSeedDatabaseUrl } from '../../src/db/resolveSeedDatabaseUrl.js';

describe('resolveSeedDatabaseUrl', () => {
  it('prefers SEED_DATABASE_URL when provided', () => {
    const result = resolveSeedDatabaseUrl({
      SEED_DATABASE_URL: 'postgresql://seed-user:seed-pass@localhost:5432/seed_db',
      DATABASE_URL: 'postgresql://db-user:db-pass@localhost:5432/app_db',
    });

    expect(result.url).toBe('postgresql://seed-user:seed-pass@localhost:5432/seed_db');
    expect(result.source).toBe('SEED_DATABASE_URL');
  });

  it('uses DATABASE_URL when it is a direct postgres URL', () => {
    const result = resolveSeedDatabaseUrl({
      DATABASE_URL: 'postgresql://db-user:db-pass@localhost:5432/app_db',
    });

    expect(result.url).toBe('postgresql://db-user:db-pass@localhost:5432/app_db');
    expect(result.source).toBe('DATABASE_URL');
  });

  it('uses POSTGRES_URL_NON_POOLING before DATABASE_URL', () => {
    const result = resolveSeedDatabaseUrl({
      DATABASE_URL: 'prisma+postgres://accelerate.prisma-data.net/?api_key=test-key',
      POSTGRES_URL_NON_POOLING: 'postgresql://direct-user:direct-pass@localhost:5432/direct_db',
    });

    expect(result.url).toBe('postgresql://direct-user:direct-pass@localhost:5432/direct_db');
    expect(result.source).toBe('POSTGRES_URL_NON_POOLING');
  });

  it('throws a clear error when only prisma+postgres URL is available', () => {
    expect(() =>
      resolveSeedDatabaseUrl({
        DATABASE_URL: 'prisma+postgres://accelerate.prisma-data.net/?api_key=test-key',
      })
    ).toThrowError(/requires a direct Postgres URL/i);
  });
});
