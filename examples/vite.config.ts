import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@casehubio/blocks-ui-core': resolve(__dirname, '../packages/blocks-ui-core/src'),
      '@casehubio/blocks-ui-work-item-row': resolve(__dirname, '../components/work-item-row/src'),
      '@casehubio/blocks-ui-work-item-inbox': resolve(__dirname, '../components/work-item-inbox/src'),
      '@casehubio/blocks-ui-work-item-detail': resolve(__dirname, '../components/work-item-detail/src'),
      '@casehubio/blocks-ui-queue-board': resolve(__dirname, '../components/queue-board/src'),
      '@casehubio/blocks-ui-work-item-workbench': resolve(__dirname, '../components/work-item-workbench/src'),
      '@casehubio/blocks-ui-sla-indicator': resolve(__dirname, '../components/sla-indicator/src'),
      '@casehubio/blocks-ui-kpi-metric-row': resolve(__dirname, '../components/kpi-metric-row/src'),
      '@casehubio/blocks-ui-approval-gate': resolve(__dirname, '../components/approval-gate/src'),
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
  server: {
    port: 3000,
    open: true,
    fs: {
      allow: ['..', '../../pages'],
    },
  },
});
