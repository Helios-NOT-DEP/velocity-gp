import { defineConfig, mergeConfig } from 'vitest/config';
import path from 'node:path';
import baseConfig from '../../vitest.config';

export default mergeConfig(
  baseConfig as any,
  defineConfig({
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      include: [
        'apps/web/tests/unit/**/*.test.ts',
        'apps/web/tests/unit/**/*.test.tsx',
        'apps/web/tests/component/**/*.test.ts',
        'apps/web/tests/component/**/*.test.tsx',
      ],
      setupFiles: ['apps/web/tests/setup/setupTests.ts'],
      exclude: ['apps/web/tests/e2e/**', 'backend/**', 'dist/**', 'node_modules/**'],
      coverage: {
        include: ['apps/web/src/**/*.{ts,tsx}'],
        reportsDirectory: './coverage/web',
      },
    },
  })
);
