import 'dotenv/config';

import { defineConfig } from 'prisma/config';
import { resolveSeedDatabaseUrl } from './apps/api/src/db/resolveSeedDatabaseUrl.js';

export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: {
    path: 'apps/api/prisma/migrations',
    seed: 'tsx apps/api/prisma/seed.ts',
  },
  datasource: {
    url: resolveSeedDatabaseUrl().url,
  },
});
