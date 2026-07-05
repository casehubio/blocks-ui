import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@casehubio/blocks-ui-core': resolve(__dirname, '../packages/blocks-ui-core/src'),
    },
  },
  test: {
    environment: 'jsdom',
  },
});
