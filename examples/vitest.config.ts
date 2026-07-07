import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@casehubio/blocks-ui-core': resolve(__dirname, '../packages/blocks-ui-core/src'),
      '@casehubio/blocks-ui-data-table': resolve(__dirname, '../components/data-table/src'),
      '@casehubio/blocks-ui-notification-inbox': resolve(__dirname, '../components/notification-inbox/src'),
      '@casehubio/pages-ui-tokens': resolve(__dirname, '../../pages/packages/pages-ui-tokens/src'),
      '@casehubio/pages-component': resolve(__dirname, '../../pages/packages/pages-component/src'),
      '@casehubio/pages-data/dist/sse/sse-manager.js': resolve(__dirname, '../../pages/packages/pages-data/src/sse/sse-manager.ts'),
      '@casehubio/pages-data': resolve(__dirname, '../../pages/packages/pages-data/src'),
      'lit': resolve(__dirname, '../node_modules/lit'),
      'lit/decorators.js': resolve(__dirname, '../node_modules/lit/decorators.js'),
      '@lit/reactive-element': resolve(__dirname, '../node_modules/@lit/reactive-element'),
    },
  },
  test: {
    environment: 'jsdom',
  },
});
