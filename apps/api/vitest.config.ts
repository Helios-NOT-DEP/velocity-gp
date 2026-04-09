import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['apps/api/tests/unit/**/*.test.ts', 'apps/api/tests/integration/**/*.test.ts'],
      exclude: ['dist/**', 'node_modules/**'],
    },
  })
);
