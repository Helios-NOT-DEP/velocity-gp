import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['apps/web/tests/**/*.test.ts', 'apps/web/tests/**/*.test.tsx'],
      exclude: ['backend/**', 'dist/**', 'node_modules/**'],
    },
  })
);
