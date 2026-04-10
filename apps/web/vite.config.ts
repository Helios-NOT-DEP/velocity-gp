import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

const buildSourceMapEnabled = process.env.SOURCEMAP === 'true';

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Enable production source maps only when explicitly requested.
  build: {
    sourcemap: buildSourceMapEnabled,
  },

  // Disable source maps in dev
  css: {
    devSourcemap: false,
  },

  esbuild: {
    sourcemap: false,
  },

  // Ignore source maps for node_modules
  server: {
    sourcemapIgnoreList: (sourcePath) => sourcePath.includes('node_modules'),
  },
});
