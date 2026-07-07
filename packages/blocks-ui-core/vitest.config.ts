import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@casehubio/pages-ui-tokens': path.resolve(__dirname, '../../../pages/packages/pages-ui-tokens/src'),
      '@casehubio/pages-component': path.resolve(__dirname, '../../../pages/packages/pages-component/src'),
      '@casehubio/pages-data': path.resolve(__dirname, '../../../pages/packages/pages-data/src'),
    },
  },
  esbuild: {
    target: 'es2022',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
