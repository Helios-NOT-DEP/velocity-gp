import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/api-client/tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    coverage: {
      enabled: false,
    },
  },
});
