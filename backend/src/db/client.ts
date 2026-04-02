import { env } from '../config/env.js';

export interface DatabaseConfig {
  readonly provider: 'postgresql';
  readonly configured: boolean;
  readonly connectionString?: string;
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
