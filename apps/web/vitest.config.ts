import { defineConfig, mergeConfig } from 'vitest/config';
import path from 'node:path';
import baseConfig from '../../vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      include: ['apps/web/tests/**/*.test.ts', 'apps/web/tests/**/*.test.tsx'],
      exclude: ['backend/**', 'dist/**', 'node_modules/**'],
    },
  })
);
