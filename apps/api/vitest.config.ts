import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['apps/api/tests/**/*.test.ts'],
      exclude: ['dist/**', 'node_modules/**'],
    },
  })
);
