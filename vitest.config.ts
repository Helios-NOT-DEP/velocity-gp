import { defineConfig } from 'vitest/config';
import path from 'path';

const repoRoot = path.resolve(__dirname);

export default defineConfig({
  root: repoRoot, // Force vitest to run from project root regardless of workspace execution path
  test: {
    globals: true,
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/prisma.ts',
        '**/*.generated.ts',
        '**/types/**',
        'tests/**',
        '**/logger.ts',
        '**/infrastructure/**',
        'apps/api/src/domain/mcp/tool.service.ts',
        'apps/api/src/api/middleware/posthog.middleware.ts',
        'apps/api/src/shared/validation/index.ts',
        'apps/api/src/api/mcp/tools/**',
      ],
    },
  },
});
