import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: [
      { find: '@casehubio/blocks-ui-core', replacement: resolve(__dirname, '../packages/blocks-ui-core/src') },
      { find: '@casehubio/blocks-ui-work-item-row', replacement: resolve(__dirname, '../components/work-item-row/src') },
      { find: '@casehubio/blocks-ui-work-item-inbox', replacement: resolve(__dirname, '../components/work-item-inbox/src') },
      { find: '@casehubio/blocks-ui-work-item-detail', replacement: resolve(__dirname, '../components/work-item-detail/src') },
      { find: '@casehubio/blocks-ui-queue-board', replacement: resolve(__dirname, '../components/queue-board/src') },
      { find: '@casehubio/blocks-ui-work-item-workbench', replacement: resolve(__dirname, '../components/work-item-workbench/src') },
      { find: '@casehubio/blocks-ui-sla-indicator', replacement: resolve(__dirname, '../components/sla-indicator/src') },
      { find: '@casehubio/blocks-ui-kpi-metric-row', replacement: resolve(__dirname, '../components/kpi-metric-row/src') },
      { find: '@casehubio/blocks-ui-approval-gate', replacement: resolve(__dirname, '../components/approval-gate/src') },
      { find: '@casehubio/pages-table', replacement: resolve(__dirname, '../../pages/packages/pages-table/src') },
      { find: '@casehubio/pages-primitives', replacement: resolve(__dirname, '../../pages/packages/pages-primitives/src') },
      { find: '@casehubio/blocks-ui-notification-inbox', replacement: resolve(__dirname, '../components/notification-inbox/src') },
      { find: '@casehubio/blocks-ui-audit-trail-viewer', replacement: resolve(__dirname, '../components/audit-trail-viewer/src') },
      { find: '@casehubio/blocks-ui-trust-score-panel', replacement: resolve(__dirname, '../components/trust-score-panel/src') },
      { find: '@casehubio/blocks-ui-blocks-timeline', replacement: resolve(__dirname, '../components/blocks-timeline/src') },
      { find: '@casehubio/blocks-ui-channel-activity', replacement: resolve(__dirname, '../components/channel-activity/src') },
      { find: '@casehubio/blocks-ui-split-workbench', replacement: resolve(__dirname, '../components/split-workbench/src') },
      { find: '@casehubio/blocks-ui-list-pane', replacement: resolve(__dirname, '../components/list-pane/src') },
      { find: '@casehubio/blocks-ui-detail-pane', replacement: resolve(__dirname, '../components/detail-pane/src') },
      { find: '@casehubio/blocks-ui-case-explorer', replacement: resolve(__dirname, '../components/case-explorer/src') },
      { find: '@casehubio/blocks-ui-routing-rationale', replacement: resolve(__dirname, '../components/routing-rationale/src') },
      { find: '@casehubio/blocks-ui-trust-feedback-display', replacement: resolve(__dirname, '../components/trust-feedback-display/src') },
      { find: '@casehubio/blocks-ui-trust-workbench', replacement: resolve(__dirname, '../components/trust-workbench/src') },
      { find: '@casehubio/pages-ui-tokens', replacement: resolve(__dirname, '../../pages/packages/pages-ui-tokens/src') },
      { find: /^@casehubio\/pages-component\/dist\/(.*)/, replacement: resolve(__dirname, '../../pages/packages/pages-component/src/$1') },
      { find: '@casehubio/pages-component', replacement: resolve(__dirname, '../../pages/packages/pages-component/src') },
      { find: /^@casehubio\/pages-data\/dist\/(.*)/, replacement: resolve(__dirname, '../../pages/packages/pages-data/src/$1') },
      { find: '@casehubio/pages-data', replacement: resolve(__dirname, '../../pages/packages/pages-data/src') },
      { find: 'lit', replacement: resolve(__dirname, '../node_modules/lit') },
      { find: 'lit/decorators.js', replacement: resolve(__dirname, '../node_modules/lit/decorators.js') },
      { find: '@lit/reactive-element', replacement: resolve(__dirname, '../node_modules/@lit/reactive-element') },
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
  server: {
    port: 3000,
    open: true,
    fs: {
      allow: ['..', '../../pages'],
    },
  },
});
