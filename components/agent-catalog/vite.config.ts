import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@casehubio/agent-avatar-2d': resolve(__dirname, '../../packages/agent-avatar-2d/src/index.ts'),
      '@casehubio/avatar-step': resolve(__dirname, '../avatar-step/src/index.ts'),
      '@casehubio/blocks-ui-core': resolve(__dirname, '../../packages/blocks-ui-core/src/index.ts'),
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
