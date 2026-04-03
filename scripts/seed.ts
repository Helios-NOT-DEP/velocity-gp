#!/usr/bin/env tsx

/**
 * Legacy seed wrapper.
 *
 * Preferred command:
 * - npm run db:seed --workspace=@velocity-gp/api
 *
 * This file is kept for backward compatibility and delegates to the
 * canonical seed script at `apps/api/prisma/seed.ts`.
 */

import '../apps/api/prisma/seed.ts';
