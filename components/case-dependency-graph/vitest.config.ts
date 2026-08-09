import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@casehubio/blocks-ui-core', replacement: path.resolve(__dirname, '../../packages/blocks-ui-core/src') },
      { find: '@casehubio/graph-core', replacement: path.resolve(__dirname, '../../.casehub-packages/packages/graph-core/dist') },
    ],
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
