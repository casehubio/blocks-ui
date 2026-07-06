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
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
